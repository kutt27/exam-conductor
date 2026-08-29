import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class SubmissionStatus(str, Enum):
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    EVALUATED = "EVALUATED"

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(SubmissionStatus, name="submission_status"), nullable=False, default=SubmissionStatus.IN_PROGRESS)
    total_score = Column(Float, default=0.0, nullable=False)
    cheat_flags = Column(JSON, default=dict, nullable=False)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    exam = relationship("Exam", back_populates="submissions", lazy="joined")
    student = relationship("User", backref="submissions", lazy="joined")
    answers = relationship("SubmissionAnswer", back_populates="submission", cascade="all, delete-orphan", lazy="selectin")

class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_answer = Column(Text, nullable=True)
    auto_score = Column(Float, default=0.0, nullable=False)
    llm_feedback = Column(JSON, nullable=True) # Full JSON from Groq CodeEvaluationSchema
    teacher_override_score = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)

    submission = relationship("Submission", back_populates="answers")
    question = relationship("Question", back_populates="answers", lazy="joined")
