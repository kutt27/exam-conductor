import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class QuestionType(str, Enum):
    MCQ = "MCQ"
    CODE_DOC = "CODE_DOC"

class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(SQLEnum(QuestionType, name="question_type"), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    prompt = Column(Text, nullable=False)
    max_marks = Column(Float, default=10.0, nullable=False)
    
    # MCQ Fields
    mcq_options = Column(JSON, nullable=True)  # List of string options
    mcq_correct_key = Column(String(50), nullable=True) # e.g., "A" or "0"

    # Code Doc Evaluation rubric
    rubric_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    exam = relationship("Exam", back_populates="questions")
    answers = relationship("SubmissionAnswer", back_populates="question", cascade="all, delete-orphan")
