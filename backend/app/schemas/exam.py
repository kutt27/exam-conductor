import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.models.question import QuestionType

class QuestionBase(BaseModel):
    type: QuestionType = QuestionType.CODE_DOC
    order_index: int = 1
    prompt: str
    max_marks: float = 10.0
    mcq_options: Optional[List[str]] = None
    mcq_correct_key: Optional[str] = None
    rubric_notes: Optional[str] = None

class QuestionCreate(QuestionBase):
    pass

class QuestionOut(QuestionBase):
    id: uuid.UUID
    exam_id: uuid.UUID

    class Config:
        from_attributes = True

class StudentQuestionOut(BaseModel):
    id: uuid.UUID
    type: QuestionType
    order_index: int
    prompt: str
    max_marks: float
    mcq_options: Optional[List[str]] = None

    class Config:
        from_attributes = True

class ExamBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int = 45
    is_active: bool = True
    access_code: Optional[str] = None
    timer_mode: str = "LOCAL"
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None

class ExamCreate(ExamBase):
    questions: List[QuestionCreate] = []

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None
    access_code: Optional[str] = None
    timer_mode: Optional[str] = None
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None

class ExamOut(ExamBase):
    id: uuid.UUID
    teacher_id: uuid.UUID
    access_code: str
    created_at: datetime
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True

class StudentExamOut(ExamBase):
    id: uuid.UUID
    access_code: str
    created_at: datetime
    questions: List[StudentQuestionOut] = []

    class Config:
        from_attributes = True
