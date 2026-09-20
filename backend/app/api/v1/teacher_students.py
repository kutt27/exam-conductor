import asyncio
import csv
import io
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.api.deps import require_role

router = APIRouter(prefix="/teacher/students", tags=["teacher-students"])

class StudentCreateManual(BaseModel):
    full_name: str
    email: EmailStr
    password: Optional[str] = None

class StudentCredentialItem(BaseModel):
    id: str
    full_name: str
    email: str
    password: str
    role: str
    created_at: str

@router.get("/", response_model=List[dict])
async def list_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """List all registered students"""
    query = select(User).where(User.role == UserRole.STUDENT).order_by(User.created_at.desc())
    result = await db.execute(query)
    students = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "full_name": s.full_name,
            "email": s.email,
            "role": s.role.value if hasattr(s.role, "value") else str(s.role),
            "created_at": s.created_at.isoformat()
        }
        for s in students
    ]

@router.post("/", response_model=StudentCredentialItem, status_code=status.HTTP_201_CREATED)
async def create_single_student(
    payload: StudentCreateManual,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Create an individual student account"""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"User with email '{payload.email}' already exists.")

    plain_pass = payload.password.strip() if payload.password and payload.password.strip() else f"Pass-{secrets.token_hex(3).upper()}"
    new_student = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=get_password_hash(plain_pass),
        role=UserRole.STUDENT
    )
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)

    return StudentCredentialItem(
        id=str(new_student.id),
        full_name=new_student.full_name,
        email=new_student.email,
        password=plain_pass,
        role="STUDENT",
        created_at=new_student.created_at.isoformat()
    )

@router.post("/upload-csv", response_model=List[StudentCredentialItem], status_code=status.HTTP_201_CREATED)
async def upload_students_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """
    Bulk creates student accounts from a CSV file.
    Expected CSV headers: full_name, email, password (optional)
    Returns list of generated student credentials.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .csv file.")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers.")

    # Normalize header names (lowercase & stripped)
    headers_map = {name.strip().lower(): name for name in reader.fieldnames if name}
    if "email" not in headers_map or "full_name" not in headers_map:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain 'full_name' and 'email' column headers."
        )

    full_name_col = headers_map["full_name"]
    email_col = headers_map["email"]
    pass_col = headers_map.get("password")

    created_list: List[StudentCredentialItem] = []
    skipped_count = 0

    parsed_rows = []
    emails_to_check = set()
    for row in reader:
        name = row.get(full_name_col, "").strip()
        email = row.get(email_col, "").strip().lower()
        custom_pass = row.get(pass_col, "").strip() if pass_col else ""
        if name and email:
            parsed_rows.append((name, email, custom_pass))
            emails_to_check.add(email)

    if not parsed_rows:
        return []

    # Batch check existing emails in one single query
    existing_result = await db.execute(select(User.email).where(User.email.in_(emails_to_check)))
    existing_emails = set(existing_result.scalars().all())

    # Filter unique and non-existing candidate rows
    valid_rows = []
    for name, email, custom_pass in parsed_rows:
        if email in existing_emails:
            skipped_count += 1
            continue
        existing_emails.add(email)  # Prevent duplicates within the same CSV
        plain_pass = custom_pass if custom_pass else f"Pass-{secrets.token_hex(3).upper()}"
        valid_rows.append((name, email, plain_pass))

    if not valid_rows:
        return []

    # Parallelize bcrypt hashing across CPU threads
    hashed_passwords = await asyncio.gather(*[
        asyncio.to_thread(get_password_hash, plain_pass)
        for _, _, plain_pass in valid_rows
    ])

    new_users = []
    for (name, email, plain_pass), pwd_hash in zip(valid_rows, hashed_passwords):
        student_user = User(
            full_name=name,
            email=email,
            password_hash=pwd_hash,
            role=UserRole.STUDENT
        )
        new_users.append((student_user, plain_pass))
        db.add(student_user)

    await db.commit()

    for student_user, plain_pass in new_users:
        created_list.append(
            StudentCredentialItem(
                id=str(student_user.id),
                full_name=student_user.full_name,
                email=student_user.email,
                password=plain_pass,
                role="STUDENT",
                created_at=student_user.created_at.isoformat() if student_user.created_at else ""
            )
        )

    return created_list

@router.get("/export-csv")
async def export_students_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Download CSV of all registered students"""
    query = select(User).where(User.role == UserRole.STUDENT).order_by(User.created_at.desc())
    result = await db.execute(query)
    students = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["full_name", "email", "role", "created_at"])
    for s in students:
        writer.writerow([
            s.full_name,
            s.email,
            s.role.value if hasattr(s.role, "value") else str(s.role),
            s.created_at.isoformat()
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_export.csv"}
    )
