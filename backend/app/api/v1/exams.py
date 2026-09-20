import uuid
import secrets
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam, generate_access_code
from app.models.question import Question
from app.models.submission import Submission, SubmissionStatus
from app.schemas.exam import ExamCreate, ExamOut, StudentExamOut
from app.api.deps import require_role, get_current_user

router = APIRouter(prefix="/exams", tags=["exams"])

@router.get("/", response_model=List[ExamOut])
async def list_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List exams available for the user (teachers see their exams, admins see all, students see active)"""
    query = select(Exam).options(selectinload(Exam.questions))
    
    if current_user.role == UserRole.TEACHER:
        query = query.where(Exam.teacher_id == current_user.id)
    elif current_user.role == UserRole.STUDENT:
        query = query.where(Exam.is_active == True)
        
    result = await db.execute(query.order_by(Exam.created_at.desc()))
    return result.scalars().all()

@router.get("/code/{access_code}", response_model=StudentExamOut)
async def get_exam_by_access_code(
    access_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lookup and unlock an exam using its unique access code"""
    clean_code = access_code.strip().upper()
    query = select(Exam).options(selectinload(Exam.questions)).where(
        Exam.access_code == clean_code,
        Exam.is_active == True
    )
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active assessment found matching access code '{clean_code}'. Please check and try again."
        )

    # Check if student already completed this exam
    if current_user.role == UserRole.STUDENT:
        existing_sub = await db.execute(
            select(Submission).where(
                Submission.exam_id == exam.id,
                Submission.student_id == current_user.id
            )
        )
        sub = existing_sub.scalar_one_or_none()
        if sub and sub.status != SubmissionStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already completed and submitted this examination."
            )

    return exam

@router.get("/student/{exam_id}", response_model=StudentExamOut)
async def get_student_exam_detail(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve exam details for student without teacher rubrics / correct answers"""
    query = select(Exam).options(selectinload(Exam.questions)).where(Exam.id == exam_id)
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam or not exam.is_active:
        raise HTTPException(status_code=404, detail="Exam not found or inactive.")

    # Check if student already completed this exam
    if current_user.role == UserRole.STUDENT:
        existing_sub = await db.execute(
            select(Submission).where(
                Submission.exam_id == exam_id,
                Submission.student_id == current_user.id
            )
        )
        sub = existing_sub.scalar_one_or_none()
        if sub and sub.status != SubmissionStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already completed and submitted this examination."
            )

    return exam

@router.post("/", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam(
    payload: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Create a new examination with questions and unique access code"""
    access_code = payload.access_code.strip().upper() if payload.access_code and payload.access_code.strip() else generate_access_code()

    # Check for access code collision
    existing = await db.execute(select(Exam).where(Exam.access_code == access_code))
    if existing.scalar_one_or_none():
        access_code = f"EXAM-{secrets.token_hex(3).upper()}"

    exam = Exam(
        teacher_id=current_user.id,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        is_active=payload.is_active,
        access_code=access_code,
        timer_mode=payload.timer_mode or "LOCAL",
        scheduled_start_time=payload.scheduled_start_time,
        scheduled_end_time=payload.scheduled_end_time,
    )
    db.add(exam)
    await db.flush()

    # Add questions
    for q_data in payload.questions:
        q = Question(
            exam_id=exam.id,
            type=q_data.type,
            order_index=q_data.order_index,
            prompt=q_data.prompt,
            max_marks=q_data.max_marks,
            mcq_options=q_data.mcq_options,
            mcq_correct_key=q_data.mcq_correct_key,
            rubric_notes=q_data.rubric_notes,
        )
        db.add(q)

    await db.commit()
    
    # Reload with relationships
    query = select(Exam).options(selectinload(Exam.questions)).where(Exam.id == exam.id)
    res = await db.execute(query)
    return res.scalar_one()

@router.patch("/{exam_id}/toggle-status", response_model=ExamOut)
async def toggle_exam_status(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Toggle exam active status (end early / close or reopen)"""
    query = select(Exam).options(selectinload(Exam.questions)).where(Exam.id == exam_id)
    if current_user.role == UserRole.TEACHER:
        query = query.where(Exam.teacher_id == current_user.id)
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found or access denied.")
    
    exam.is_active = not exam.is_active
    await db.commit()
    await db.refresh(exam)
    return exam

@router.get("/{exam_id}", response_model=ExamOut)
async def get_exam(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Get exam details with rubrics and answer keys for teacher"""
    query = select(Exam).options(selectinload(Exam.questions)).where(Exam.id == exam_id)
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return exam

