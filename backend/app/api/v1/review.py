import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.submission import Submission, SubmissionAnswer
from app.schemas.submission import SubmissionOut, SubmissionAnswerOut, ScoreOverride
from app.api.deps import require_role

router = APIRouter(prefix="/review", tags=["review"])

@router.get("/exam/{exam_id}/submissions", response_model=List[SubmissionOut])
async def get_exam_submissions_for_teacher(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Retrieve all student submissions for a specific exam with student details & telemetry"""
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student)
    ).where(Submission.exam_id == exam_id).order_by(Submission.submitted_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/submission/{submission_id}", response_model=SubmissionOut)
async def get_submission_for_review(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Detailed view for teacher grading including rubric notes, student code, Groq JSON breakdown, and cheat strikes"""
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student),
        selectinload(Submission.exam)
    ).where(Submission.id == submission_id)
    
    result = await db.execute(query)
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return sub

@router.patch("/answer/{answer_id}/override", response_model=SubmissionAnswerOut)
async def override_answer_score(
    answer_id: uuid.UUID,
    override: ScoreOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Teacher manual score override & feedback for an individual answer"""
    query = select(SubmissionAnswer).options(
        selectinload(SubmissionAnswer.question),
        selectinload(SubmissionAnswer.submission)
    ).where(SubmissionAnswer.id == answer_id)
    result = await db.execute(query)
    ans = result.scalar_one_or_none()
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found.")

    ans.teacher_override_score = override.teacher_override_score
    ans.teacher_feedback = override.teacher_feedback

    # Recalculate submission total score
    submission_id = ans.submission_id
    await db.flush()

    sub_query = select(Submission).options(selectinload(Submission.answers)).where(Submission.id == submission_id)
    sub_res = await db.execute(sub_query)
    sub = sub_res.scalar_one()

    new_total = sum(
        (a.teacher_override_score if a.teacher_override_score is not None else a.auto_score)
        for a in sub.answers
    )
    sub.total_score = round(new_total, 2)
    await db.commit()
    await db.refresh(ans)
    return ans
