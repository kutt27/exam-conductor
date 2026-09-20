import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_access_code():
    return f"EXAM-{secrets.token_hex(3).upper()}"

class Exam(Base):
    __tablename__ = "exams"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    teacher_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=45, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Unique Access Code required by students to enter exam room
    access_code = Column(String(30), unique=True, nullable=False, default=generate_access_code, index=True)

    # Timing configuration: LOCAL (per student) or GLOBAL (synchronized shared clock)
    timer_mode = Column(String(20), default="LOCAL", nullable=False)
    scheduled_start_time = Column(DateTime(timezone=True), nullable=True)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    teacher = relationship("User", back_populates="exams")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan", lazy="selectin")
    submissions = relationship("Submission", back_populates="exam", cascade="all, delete-orphan", lazy="selectin")
