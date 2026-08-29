import uuid
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db, AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.question import Question, QuestionType
from app.models.submission import Submission, SubmissionAnswer, SubmissionStatus
from app.schemas.submission import SubmissionCreate, SubmissionOut
from app.services.evaluator import evaluate_mcq, evaluate_code_doc_with_groq
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["submissions"])

async def run_submission_evaluation(submission_id: uuid.UUID):
    """Background task to run Groq LLM evaluation and calculate total scores"""
    async with AsyncSessionLocal() as db:
        try:
            query = select(Submission).options(
                selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
                selectinload(Submission.exam)
            ).where(Submission.id == submission_id)
            result = await db.execute(query)
            submission = result.scalar_one_or_none()
            if not submission:
                return

            total_score = 0.0
            for ans in submission.answers:
                q = ans.question
                if not q:
                    continue

                if q.type == QuestionType.MCQ:
                    score = evaluate_mcq(ans.student_answer, q.mcq_correct_key, q.max_marks)
                    ans.auto_score = score
                    ans.evaluated_at = datetime.now(timezone.utc)
                    total_score += score
                elif q.type == QuestionType.CODE_DOC:
                    evaluation_dict = await evaluate_code_doc_with_groq(
                        prompt=q.prompt,
                        student_answer=ans.student_answer,
                        max_marks=q.max_marks,
                        rubric_notes=q.rubric_notes
                    )
                    score = float(evaluation_dict.get("total_awarded_marks", 0.0))
                    ans.auto_score = score
                    ans.llm_feedback = evaluation_dict
                    ans.evaluated_at = datetime.now(timezone.utc)
                    total_score += score

            submission.total_score = round(total_score, 2)
            submission.status = SubmissionStatus.EVALUATED
            await db.commit()
            logger.info(f"Successfully evaluated submission {submission_id} with score {total_score}")
        except Exception as e:
            logger.error(f"Error during submission evaluation for {submission_id}: {e}", exc_info=True)

@router.post("/", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
async def submit_exam(
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit exam answers with anti-cheat telemetry data and trigger Groq evaluation"""
    # Verify exam exists
    exam_res = await db.execute(
        select(Exam).options(selectinload(Exam.questions)).where(Exam.id == payload.exam_id)
    )
    exam = exam_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    # Create submission record
    submission = Submission(
        exam_id=payload.exam_id,
        student_id=current_user.id,
        status=SubmissionStatus.SUBMITTED,
        cheat_flags=payload.cheat_flags,
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc)
    )
    db.add(submission)
    await db.flush()

    # Create answers
    for item in payload.answers:
        ans = SubmissionAnswer(
            submission_id=submission.id,
            question_id=item.question_id,
            student_answer=item.student_answer
        )
        db.add(ans)

    await db.commit()

    # Trigger Groq & MCQ evaluation in background task or immediately
    background_tasks.add_task(run_submission_evaluation, submission.id)

    # Return refreshed submission
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student)
    ).where(Submission.id == submission.id)
    res = await db.execute(query)
    return res.scalar_one()

@router.get("/my", response_model=List[SubmissionOut])
async def get_my_submissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all submissions for the logged in student"""
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student)
    ).where(Submission.student_id == current_user.id).order_by(Submission.submitted_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{submission_id}", response_model=SubmissionOut)
async def get_submission(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed submission info"""
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student)
    ).where(Submission.id == submission_id)
    result = await db.execute(query)
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if current_user.role == UserRole.STUDENT and sub.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this submission.")

    return sub
