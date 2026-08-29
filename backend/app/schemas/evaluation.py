from pydantic import BaseModel, Field
from typing import List, Optional

class CodeEvaluationSchema(BaseModel):
    logic_correctness_score: float = Field(
        description="Score based on whether the algorithmic logic solves the problem (0 to max_marks * 0.6)"
    )
    syntax_resilience_score: float = Field(
        description="Score for basic structure and readability, ignoring minor typos or missing semicolons (0 to max_marks * 0.2)"
    )
    edge_case_score: float = Field(
        description="Score for handling basic constraints/null checks/empty inputs (0 to max_marks * 0.2)"
    )
    total_awarded_marks: float = Field(
        description="Sum of awarded sub-scores"
    )
    passed_mental_test_cases: List[str] = Field(
        default_factory=list,
        description="Short descriptions of test cases the logic passes"
    )
    failed_mental_test_cases: List[str] = Field(
        default_factory=list,
        description="Short descriptions of test cases where logic fails"
    )
    teacher_summary: str = Field(
        description="2-sentence actionable summary for the teacher"
    )
    student_constructive_feedback: str = Field(
        description="Constructive guidance without revealing direct solutions"
    )

class EvaluationRequest(BaseModel):
    prompt: str
    student_answer: str
    max_marks: float = 10.0
    rubric_notes: Optional[str] = None
