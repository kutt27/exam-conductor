import uuid
import logging
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.question import Question, QuestionType
from app.models.submission import Submission, SubmissionAnswer, SubmissionStatus
from app.schemas.submission import SubmissionCreate, SubmissionOut
from app.services.evaluator import evaluate_mcq
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["submissions"])

class SessionStartRequest(BaseModel):
    exam_id: uuid.UUID

class SessionHeartbeatRequest(BaseModel):
    exam_id: uuid.UUID
    cheat_flags: Optional[Dict[str, Any]] = None

@router.post("/start-session", status_code=status.HTTP_200_OK)
async def start_exam_session(
    payload: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registers or confirms the student has started taking an exam.
    Sets status to IN_PROGRESS and records started_at timestamp.
    """
    exam_res = await db.execute(select(Exam).where(Exam.id == payload.exam_id))
    exam = exam_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if not exam.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This assessment has been closed by the instructor and can no longer be started."
        )

    existing_sub = await db.execute(
        select(Submission).where(
            Submission.exam_id == payload.exam_id,
            Submission.student_id == current_user.id
        )
    )
    sub = existing_sub.scalar_one_or_none()

    if sub and sub.status != SubmissionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already completed and submitted this examination. Re-taking exams is not permitted."
        )

    # Check if student currently has another exam in progress
    if current_user.role == UserRole.STUDENT and not sub:
        active_other_res = await db.execute(
            select(Submission).join(Exam, Submission.exam_id == Exam.id).where(
                Submission.student_id == current_user.id,
                Submission.exam_id != payload.exam_id,
                Submission.status == SubmissionStatus.IN_PROGRESS,
                Exam.is_active == True
            )
        )
        other_active_sub = active_other_res.scalars().first()
        if other_active_sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have another assessment in progress. Attending multiple exams concurrently is prohibited."
            )

    if not sub:
        sub = Submission(
            exam_id=payload.exam_id,
            student_id=current_user.id,
            status=SubmissionStatus.IN_PROGRESS,
            started_at=datetime.now(timezone.utc),
            cheat_flags={"total_strikes": 0, "events": []}
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)

    return {
        "status": "success",
        "submission_id": str(sub.id),
        "exam_id": str(payload.exam_id),
        "submission_status": sub.status.value if hasattr(sub.status, "value") else str(sub.status),
        "started_at": sub.started_at.isoformat() if sub.started_at else None
    }

@router.post("/heartbeat", status_code=status.HTTP_200_OK)
async def exam_session_heartbeat(
    payload: SessionHeartbeatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Student periodic heartbeat / live security strike synchronization.
    Returns exam active status to prevent out-of-time submission manipulation.
    """
    exam_res = await db.execute(select(Exam).where(Exam.id == payload.exam_id))
    exam = exam_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    existing_sub = await db.execute(
        select(Submission).where(
            Submission.exam_id == payload.exam_id,
            Submission.student_id == current_user.id
        )
    )
    sub = existing_sub.scalar_one_or_none()
    if sub and sub.status == SubmissionStatus.IN_PROGRESS:
        if payload.cheat_flags is not None:
            sub.cheat_flags = payload.cheat_flags
        await db.commit()

    return {"status": "ok", "is_active": exam.is_active}

@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
async def submit_exam(
    payload: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit student exam responses.
    - Deterministic MCQs are graded immediately.
    - Code Document questions are placed into PENDING_EVALUATION (Lazy Evaluation).
    - Prevents overwhelming LLM endpoints at submission time.
    """
    # 1. Verify exam exists and is active
    exam_res = await db.execute(
        select(Exam).options(selectinload(Exam.questions)).where(Exam.id == payload.exam_id)
    )
    exam = exam_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if not exam.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This examination has been closed by the instructor. Submissions are no longer accepted."
        )

    # 2. Check for duplicate active submission
    existing_sub = await db.execute(
        select(Submission).where(
            Submission.exam_id == payload.exam_id,
            Submission.student_id == current_user.id
        )
    )
    sub_record = existing_sub.scalar_one_or_none()

    if sub_record and sub_record.status != SubmissionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This examination has already been submitted and cannot be resubmitted."
        )

    if not sub_record:
        # Create new submission record
        sub_record = Submission(
            exam_id=payload.exam_id,
            student_id=current_user.id,
            status=SubmissionStatus.PENDING_EVALUATION,
            cheat_flags=payload.cheat_flags,
            started_at=datetime.now(timezone.utc),
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(sub_record)
        await db.flush()
    else:
        # Update existing in-progress submission to PENDING_EVALUATION
        sub_record.status = SubmissionStatus.PENDING_EVALUATION
        sub_record.cheat_flags = payload.cheat_flags
        sub_record.submitted_at = datetime.now(timezone.utc)
        sub_record.eval_error = None
        # Explicit atomic delete of old answers without triggering greenlet lazy loads
        await db.execute(
            delete(SubmissionAnswer).where(SubmissionAnswer.submission_id == sub_record.id)
        )
        await db.flush()

    # Create answer records and grade MCQs instantly
    initial_score = 0.0
    for item in payload.answers:
        q = next((q_obj for q_obj in exam.questions if q_obj.id == item.question_id), None)
        auto_score = 0.0
        evaluated_at = None

        if q and q.type == QuestionType.MCQ:
            auto_score = evaluate_mcq(item.student_answer, q.mcq_correct_key, q.max_marks)
            evaluated_at = datetime.now(timezone.utc)
            initial_score += auto_score

        ans = SubmissionAnswer(
            submission_id=sub_record.id,
            question_id=item.question_id,
            student_answer=item.student_answer,
            auto_score=auto_score,
            evaluated_at=evaluated_at
        )
        db.add(ans)

    sub_record.total_score = round(initial_score, 2)
    await db.commit()

    # Return refreshed submission with all eager loaded relations
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student)
    ).where(Submission.id == sub_record.id)
    res = await db.execute(query)
    return res.scalar_one()

@router.get("", response_model=List[SubmissionOut], include_in_schema=False)
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
