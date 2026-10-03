import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.question import Question, QuestionType
from app.core.security import get_password_hash

async def seed_initial_data(db: AsyncSession):
    """
    Ensure at least one System Administrator account exists for initial deployment.
    """
    res = await db.execute(select(User).where(User.email == "admin@exam.com"))
    admin = res.scalar_one_or_none()
    if not admin:
        admin = User(
            id=uuid.uuid4(),
            email="admin@exam.com",
            password_hash=get_password_hash("admin123"),
            full_name="System Administrator",
            role=UserRole.ADMIN
        )
        db.add(admin)
        await db.commit()
