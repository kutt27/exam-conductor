import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.submission import Submission
from app.schemas.auth import UserOut
from app.api.deps import require_role

router = APIRouter(prefix="/admin", tags=["admin"])

class CreateUserByAdmin(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole

class RoleUpdate(BaseModel):
    role: UserRole

class SystemStats(BaseModel):
    total_users: int
    total_students: int
    total_teachers: int
    total_exams: int
    total_submissions: int

@router.get("/users", response_model=List[UserOut])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: CreateUserByAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    exists = await db.execute(select(User).where(User.email == payload.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=get_password_hash(payload.password),
        role=payload.role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    students_count = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.STUDENT))).scalar() or 0
    teachers_count = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.TEACHER))).scalar() or 0
    exams_count = (await db.execute(select(func.count(Exam.id)))).scalar() or 0
    submissions_count = (await db.execute(select(func.count(Submission.id)))).scalar() or 0

    return SystemStats(
        total_users=users_count,
        total_students=students_count,
        total_teachers=teachers_count,
        total_exams=exams_count,
        total_submissions=submissions_count
    )
