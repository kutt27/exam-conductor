import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.models.question import QuestionType
from app.schemas.auth import UserOut

class QuestionBase(BaseModel):
    type: QuestionType
    order_index: int = 0
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
    created_at: datetime

    class Config:
        from_attributes = True

# For students: omit mcq_correct_key & rubric_notes to avoid leaking answers
class StudentQuestionOut(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
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
    duration_minutes: int = 60
    is_active: bool = True

class ExamCreate(ExamBase):
    questions: List[QuestionCreate] = []

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None

class ExamOut(ExamBase):
    id: uuid.UUID
    teacher_id: uuid.UUID
    created_at: datetime
    teacher: Optional[UserOut] = None
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True

class StudentExamOut(ExamBase):
    id: uuid.UUID
    teacher_id: uuid.UUID
    created_at: datetime
    questions: List[StudentQuestionOut] = []

    class Config:
        from_attributes = True
