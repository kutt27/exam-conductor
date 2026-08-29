import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.question import Question
from app.schemas.exam import (
    ExamCreate, ExamOut, StudentExamOut, ExamUpdate, QuestionCreate
)
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/exams", tags=["exams"])

@router.get("/", response_model=List[ExamOut])
async def list_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List exams. Teachers/Admins see all their exams, Students see active exams."""
    query = select(Exam).options(selectinload(Exam.questions), selectinload(Exam.teacher))
    if current_user.role == UserRole.TEACHER:
        query = query.where(Exam.teacher_id == current_user.id)
    elif current_user.role == UserRole.STUDENT:
        query = query.where(Exam.is_active == True)
    
    result = await db.execute(query.order_by(Exam.created_at.desc()))
    return result.scalars().all()

@router.get("/student/{exam_id}", response_model=StudentExamOut)
async def get_exam_for_student(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve sanitized exam for test-taking (without mcq correct keys or rubric notes)"""
    query = select(Exam).options(selectinload(Exam.questions)).where(Exam.id == exam_id, Exam.is_active == True)
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found or inactive.")
    return exam

@router.get("/{exam_id}", response_model=ExamOut)
async def get_exam_detail(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full exam details (Teachers/Admin only for full rubric & MCQ answer keys)"""
    query = select(Exam).options(selectinload(Exam.questions), selectinload(Exam.teacher)).where(Exam.id == exam_id)
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    
    if current_user.role == UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Access denied. Use student exam endpoint.")
        
    return exam

@router.post("/", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam(
    exam_in: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Create a new exam with its questions"""
    exam = Exam(
        teacher_id=current_user.id,
        title=exam_in.title,
        description=exam_in.description,
        duration_minutes=exam_in.duration_minutes,
        is_active=exam_in.is_active
    )
    db.add(exam)
    await db.flush()

    for idx, q in enumerate(exam_in.questions):
        question = Question(
            exam_id=exam.id,
            type=q.type,
            order_index=q.order_index or (idx + 1),
            prompt=q.prompt,
            max_marks=q.max_marks,
            mcq_options=q.mcq_options,
            mcq_correct_key=q.mcq_correct_key,
            rubric_notes=q.rubric_notes
        )
        db.add(question)

    await db.commit()
    
    # Reload with relationships
    query = select(Exam).options(selectinload(Exam.questions), selectinload(Exam.teacher)).where(Exam.id == exam.id)
    result = await db.execute(query)
    return result.scalar_one()

@router.patch("/{exam_id}/toggle-active")
async def toggle_exam_active(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    query = select(Exam).where(Exam.id == exam_id)
    result = await db.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    
    exam.is_active = not exam.is_active
    await db.commit()
    return {"message": "Exam status updated", "is_active": exam.is_active}
