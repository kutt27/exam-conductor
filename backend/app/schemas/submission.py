import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.models.submission import SubmissionStatus
from app.schemas.auth import UserOut
from app.schemas.exam import QuestionOut

class AnswerSubmitItem(BaseModel):
    question_id: uuid.UUID
    student_answer: Optional[str] = ""

class SubmissionCreate(BaseModel):
    exam_id: uuid.UUID
    answers: List[AnswerSubmitItem] = []
    cheat_flags: Dict[str, Any] = {}

class ScoreOverride(BaseModel):
    teacher_override_score: float
    teacher_feedback: Optional[str] = None

class SubmissionAnswerOut(BaseModel):
    id: uuid.UUID
    submission_id: uuid.UUID
    question_id: uuid.UUID
    student_answer: Optional[str] = None
    auto_score: float = 0.0
    llm_feedback: Optional[Dict[str, Any]] = None
    teacher_override_score: Optional[float] = None
    teacher_feedback: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    question: Optional[QuestionOut] = None

    class Config:
        from_attributes = True

class SubmissionOut(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    student_id: uuid.UUID
    status: SubmissionStatus
    total_score: float
    cheat_flags: Dict[str, Any]
    started_at: datetime
    submitted_at: Optional[datetime] = None
    student: Optional[UserOut] = None
    answers: List[SubmissionAnswerOut] = []

    class Config:
        from_attributes = True
