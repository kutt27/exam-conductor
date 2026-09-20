import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.core.database import AsyncSessionLocal
from app.models.submission import Submission, SubmissionAnswer, SubmissionStatus, EvaluationCache
from app.models.question import Question, QuestionType
from app.services.evaluator import evaluate_code_doc_with_groq, evaluate_mcq

logger = logging.getLogger("queue_engine")

def compute_content_hash(question_id: uuid.UUID, student_answer: Optional[str], rubric_notes: Optional[str]) -> str:
    """Computes a deterministic SHA256 signature for deduplication & caching"""
    raw_str = f"{question_id}:{student_answer.strip() if student_answer else ''}:{rubric_notes.strip() if rubric_notes else ''}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

class ExamEvaluationQueueManager:
    def __init__(self, max_global_concurrent_evals: int = 5):
        # Per-exam locks ensure only ONE paper is evaluated at a time from the same exam
        self._exam_locks: Dict[uuid.UUID, asyncio.Lock] = {}
        # Global semaphore prevents overwhelming Groq API rate limits across all exams
        self._global_semaphore = asyncio.Semaphore(max_global_concurrent_evals)
        self._active_exam_batches: set = set()

    def _get_exam_lock(self, exam_id: uuid.UUID) -> asyncio.Lock:
        if exam_id not in self._exam_locks:
            self._exam_locks[exam_id] = asyncio.Lock()
        return self._exam_locks[exam_id]

    async def is_exam_batch_running(self, exam_id: uuid.UUID) -> bool:
        return exam_id in self._active_exam_batches

    async def evaluate_single_submission(
        self,
        submission_id: uuid.UUID,
        worker_id: str = "evaluator-worker"
    ) -> bool:
        """
        Idempotently evaluates a single submission.
        Guarantees:
        1. Atomic state transition: Only claims if PENDING_EVALUATION (or expired lease).
        2. Content-hash deduplication using evaluation_cache table.
        3. Declarative snapshot score aggregation.
        """
        async with AsyncSessionLocal() as db:
            # 1. Fetch and acquire lease lock
            query = select(Submission).options(
                selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
                selectinload(Submission.exam)
            ).where(Submission.id == submission_id)
            
            res = await db.execute(query)
            submission = res.scalar_one_or_none()
            if not submission:
                logger.warning(f"Submission {submission_id} not found.")
                return False

            # Check if already completed or actively locked by a recent worker
            now = datetime.now(timezone.utc)
            if submission.status == SubmissionStatus.EVALUATED:
                logger.info(f"Submission {submission_id} is already EVALUATED. Skipping.")
                return True

            if submission.status == SubmissionStatus.EVALUATING:
                if submission.locked_at and (now - submission.locked_at) < timedelta(seconds=90):
                    logger.info(f"Submission {submission_id} is actively being evaluated by {submission.locked_by}. Skipping.")
                    return False

            # Claim lease
            submission.status = SubmissionStatus.EVALUATING
            submission.locked_at = now
            submission.locked_by = worker_id
            submission.eval_error = None
            await db.commit()

            # 2. Process answers
            try:
                total_score = 0.0
                for ans in submission.answers:
                    q = ans.question
                    if not q:
                        continue

                    if q.type == QuestionType.MCQ:
                        score = evaluate_mcq(ans.student_answer, q.mcq_correct_key, q.max_marks)
                        ans.auto_score = score
                        ans.evaluated_at = datetime.now(timezone.utc)
                        total_score += (ans.teacher_override_score if ans.teacher_override_score is not None else score)

                    elif q.type == QuestionType.CODE_DOC:
                        # Compute content hash for deduplication
                        c_hash = compute_content_hash(q.id, ans.student_answer, q.rubric_notes)
                        
                        # Check cache
                        cache_res = await db.execute(select(EvaluationCache).where(EvaluationCache.content_hash == c_hash))
                        cached = cache_res.scalar_one_or_none()

                        if cached:
                            eval_dict = cached.evaluation_result
                            logger.info(f"Reused cached evaluation for question {q.id} (hash: {c_hash[:8]}...)")
                        else:
                            # Call Groq under global rate limiter semaphore
                            async with self._global_semaphore:
                                eval_dict = await evaluate_code_doc_with_groq(
                                    prompt=q.prompt,
                                    student_answer=ans.student_answer,
                                    max_marks=q.max_marks,
                                    rubric_notes=q.rubric_notes
                                )
                            
                            # Save to cache table
                            new_cache = EvaluationCache(
                                content_hash=c_hash,
                                evaluation_result=eval_dict,
                                created_at=datetime.now(timezone.utc)
                            )
                            db.add(new_cache)

                        score = float(eval_dict.get("total_awarded_marks", 0.0))
                        ans.auto_score = score
                        ans.llm_feedback = eval_dict
                        ans.evaluated_at = datetime.now(timezone.utc)
                        total_score += (ans.teacher_override_score if ans.teacher_override_score is not None else score)

                # 3. Finalize submission state
                submission.total_score = round(total_score, 2)
                submission.status = SubmissionStatus.EVALUATED
                submission.locked_at = None
                submission.locked_by = None
                submission.eval_error = None
                await db.commit()
                logger.info(f"Successfully completed evaluation for submission {submission_id}, total: {total_score}")
                return True

            except Exception as e:
                logger.error(f"Error evaluating submission {submission_id}: {e}", exc_info=True)
                submission.status = SubmissionStatus.FAILED
                submission.eval_error = str(e)
                submission.locked_at = None
                await db.commit()
                return False

    async def evaluate_exam_batch(self, exam_id: uuid.UUID) -> Dict[str, Any]:
        """
        Executes lazy batch evaluation for an entire exam.
        Enforces: ONE paper at a time per exam via per-exam lock.
        """
        exam_lock = self._get_exam_lock(exam_id)
        if exam_lock.locked():
            logger.info(f"Batch evaluation for exam {exam_id} is already in progress.")
            return {"status": "already_running", "exam_id": str(exam_id)}

        async with exam_lock:
            self._active_exam_batches.add(exam_id)
            try:
                processed_count = 0
                while True:
                    # Query next pending submission for this exam
                    async with AsyncSessionLocal() as db:
                        query = select(Submission.id).where(
                            Submission.exam_id == exam_id,
                            Submission.status.in_([SubmissionStatus.PENDING_EVALUATION, SubmissionStatus.FAILED])
                        ).order_by(Submission.started_at.asc()).limit(1)
                        
                        res = await db.execute(query)
                        next_sub_id = res.scalar_one_or_none()

                    if not next_sub_id:
                        break

                    logger.info(f"[Exam {exam_id}] Serial evaluation of paper: {next_sub_id}")
                    await self.evaluate_single_submission(next_sub_id, worker_id=f"batch-{exam_id}")
                    processed_count += 1

                    # Polite breath between papers in the same exam
                    await asyncio.sleep(0.3)

                logger.info(f"Finished batch evaluation for exam {exam_id}. Total evaluated: {processed_count}")
                return {"status": "completed", "exam_id": str(exam_id), "processed_count": processed_count}

            finally:
                self._active_exam_batches.discard(exam_id)

    async def get_exam_batch_status(self, db: AsyncSession, exam_id: uuid.UUID) -> Dict[str, Any]:
        """Returns live statistics of submission states for an exam"""
        total = (await db.execute(select(func.count(Submission.id)).where(Submission.exam_id == exam_id))).scalar() or 0
        pending = (await db.execute(select(func.count(Submission.id)).where(Submission.exam_id == exam_id, Submission.status == SubmissionStatus.PENDING_EVALUATION))).scalar() or 0
        evaluating = (await db.execute(select(func.count(Submission.id)).where(Submission.exam_id == exam_id, Submission.status == SubmissionStatus.EVALUATING))).scalar() or 0
        evaluated = (await db.execute(select(func.count(Submission.id)).where(Submission.exam_id == exam_id, Submission.status == SubmissionStatus.EVALUATED))).scalar() or 0
        failed = (await db.execute(select(func.count(Submission.id)).where(Submission.exam_id == exam_id, Submission.status == SubmissionStatus.FAILED))).scalar() or 0

        is_running = await self.is_exam_batch_running(exam_id) or evaluating > 0

        return {
            "exam_id": str(exam_id),
            "total": total,
            "pending": pending,
            "evaluating": evaluating,
            "evaluated": evaluated,
            "failed": failed,
            "is_evaluating": is_running,
            "progress_percent": round((evaluated / total * 100), 1) if total > 0 else 100.0
        }

# Global singleton queue manager
queue_manager = ExamEvaluationQueueManager()
