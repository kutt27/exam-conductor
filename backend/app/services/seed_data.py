import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.question import Question, QuestionType
from app.core.security import get_password_hash

async def seed_initial_data(db: AsyncSession):
    # Check if admin exists
    res = await db.execute(select(User).where(User.email == "admin@exam.com"))
    admin = res.scalar_one_or_none()
    if not admin:
        admin = User(
            id=uuid.uuid4(),
            email="admin@exam.com",
            password_hash=get_password_hash("admin123"),
            full_name="System Admin",
            role=UserRole.ADMIN
        )
        db.add(admin)

    res_teacher = await db.execute(select(User).where(User.email == "teacher@exam.com"))
    teacher = res_teacher.scalar_one_or_none()
    if not teacher:
        teacher = User(
            id=uuid.uuid4(),
            email="teacher@exam.com",
            password_hash=get_password_hash("teacher123"),
            full_name="Professor Turing",
            role=UserRole.TEACHER
        )
        db.add(teacher)

    res_student = await db.execute(select(User).where(User.email == "student@exam.com"))
    student = res_student.scalar_one_or_none()
    if not student:
        student = User(
            id=uuid.uuid4(),
            email="student@exam.com",
            password_hash=get_password_hash("student123"),
            full_name="Alex Student",
            role=UserRole.STUDENT
        )
        db.add(student)

    await db.commit()

    # Seed a sample exam if none exists
    res_exam = await db.execute(select(Exam))
    first_exam = res_exam.scalars().first()
    if not first_exam and teacher:
        sample_exam = Exam(
            id=uuid.uuid4(),
            teacher_id=teacher.id,
            title="Software Engineering & Algorithms Assessment",
            description="Interview-style technical screening covering data structures and plain-text code logic.",
            duration_minutes=45,
            is_active=True
        )
        db.add(sample_exam)
        await db.flush()

        # Add MCQ question
        q1 = Question(
            id=uuid.uuid4(),
            exam_id=sample_exam.id,
            type=QuestionType.MCQ,
            order_index=1,
            prompt="What is the average time complexity of searching for an element in a balanced Binary Search Tree (BST)?",
            max_marks=5.0,
            mcq_options=[
                "A) O(1)",
                "B) O(log N)",
                "C) O(N)",
                "D) O(N log N)"
            ],
            mcq_correct_key="B",
            rubric_notes="Standard BST complexity theory"
        )
        db.add(q1)

        # Add Code Doc question
        q2 = Question(
            id=uuid.uuid4(),
            exam_id=sample_exam.id,
            type=QuestionType.CODE_DOC,
            order_index=2,
            prompt="Write a function `find_first_unique_char(s: str) -> int` that returns the index of the first non-repeating character in a string. If none exists, return -1. Describe your algorithmic approach and time/space complexity.",
            max_marks=15.0,
            rubric_notes="Expect O(N) frequency map or two-pass approach. Check for empty string, single character string, and strings with no repeating elements.",
        )
        db.add(q2)

        await db.commit()
