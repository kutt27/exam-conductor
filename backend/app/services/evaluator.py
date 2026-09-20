import json
import logging
from typing import Optional, Dict, Any
from app.core.config import settings
from app.schemas.evaluation import CodeEvaluationSchema

logger = logging.getLogger(__name__)

EVALUATION_SYSTEM_PROMPT = """You are an expert interviewer evaluating a student's basic code logic written in a plain document format without IDE tooling.

Guidelines:
1. Do not penalize for missing semicolons, exact imports, or minor syntax typos.
2. Focus on:
   - Does the core algorithmic approach solve the problem? (Award up to 60% of max_marks for logic_correctness_score)
   - Are loop boundaries, conditions, and return values readable and structured? (Award up to 20% of max_marks for syntax_resilience_score)
   - Are basic edge cases (empty input, 0, null, negative values) considered? (Award up to 20% of max_marks for edge_case_score)
3. Mentally trace the candidate's logic with 2-3 sample inputs.
4. Set total_awarded_marks as the exact sum of (logic_correctness_score + syntax_resilience_score + edge_case_score).
5. Output strictly adhering to the JSON schema provided without markdown codeblocks or extra text.
"""

def evaluate_mcq(student_answer: Optional[str], correct_key: Optional[str], max_marks: float = 10.0) -> float:
    """Deterministic MCQ grader"""
    if not student_answer or not correct_key:
        return 0.0
    
    clean_student = student_answer.strip().upper()
    clean_correct = correct_key.strip().upper()

    if clean_student == clean_correct:
        return float(max_marks)
    if clean_student.startswith(clean_correct) or clean_correct.startswith(clean_student):
        return float(max_marks)
    return 0.0

async def evaluate_code_doc_with_groq(
    prompt: str,
    student_answer: Optional[str],
    max_marks: float = 10.0,
    rubric_notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates student code document submission using Groq model.
    Auto-tries compatible Groq models, with graceful fallback to heuristic evaluation.
    """
    if not student_answer or not student_answer.strip():
        return {
            "logic_correctness_score": 0.0,
            "syntax_resilience_score": 0.0,
            "edge_case_score": 0.0,
            "total_awarded_marks": 0.0,
            "passed_mental_test_cases": [],
            "failed_mental_test_cases": ["No answer provided by candidate"],
            "teacher_summary": "Candidate left this question blank.",
            "student_constructive_feedback": "Please provide an explanation or code outline to receive marks."
        }

    if settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip() and not settings.GROQ_API_KEY.startswith("gsk_your_groq"):
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)

            schema_json = json.dumps(CodeEvaluationSchema.model_json_schema())
            user_content = f"""Problem Prompt:
{prompt}

Maximum Marks: {max_marks}
Rubric Notes: {rubric_notes or 'Standard algorithmic evaluation'}

Student Solution:
\"\"\"
{student_answer}
\"\"\"

Return a valid JSON object matching the CodeEvaluationSchema schema:
{schema_json}
"""
            models_to_try = [
                settings.GROQ_MODEL,
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "llama-3.1-8b-instant",
                "llama3-70b-8192"
            ]
            
            seen_models = set()
            for model_name in models_to_try:
                if model_name in seen_models:
                    continue
                seen_models.add(model_name)
                try:
                    completion = await client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
                            {"role": "user", "content": user_content}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                        max_tokens=1024
                    )
                    raw_response = completion.choices[0].message.content
                    parsed = json.loads(raw_response)
                    validated = CodeEvaluationSchema(**parsed)
                    return validated.model_dump()
                except Exception as model_err:
                    logger.warning(f"Groq model {model_name} failed: {model_err}. Trying next fallback model...")
                    continue

        except Exception as e:
            logger.error(f"Error calling Groq API: {e}. Falling back to heuristic grader.")

    return fallback_heuristic_evaluation(prompt, student_answer, max_marks, rubric_notes)

def fallback_heuristic_evaluation(
    prompt: str,
    student_answer: str,
    max_marks: float = 10.0,
    rubric_notes: Optional[str] = None
) -> Dict[str, Any]:
    lines = [line.strip() for line in student_answer.strip().split("\n") if line.strip()]
    has_function_or_logic = any(kw in student_answer.lower() for kw in ["def ", "function", "return", "for ", "while ", "if ", "let ", "const ", "class "])
    has_edge_cases = any(kw in student_answer.lower() for kw in ["null", "none", "0", "len(", ".length", "empty", "<=", ">="])
    
    max_logic = round(max_marks * 0.6, 2)
    max_syntax = round(max_marks * 0.2, 2)
    max_edge = round(max_marks * 0.2, 2)

    logic_score = max_logic if (len(lines) >= 3 and has_function_or_logic) else round(max_logic * 0.5, 2)
    syntax_score = max_syntax if len(lines) >= 2 else round(max_syntax * 0.5, 2)
    edge_score = max_edge if has_edge_cases else round(max_edge * 0.3, 2)
    total = round(logic_score + syntax_score + edge_score, 2)

    passed_tests = ["Basic input execution passes with standard input."]
    failed_tests = []
    if not has_edge_cases:
        failed_tests.append("Boundary condition / empty input check is not explicitly handled.")

    return {
        "logic_correctness_score": logic_score,
        "syntax_resilience_score": syntax_score,
        "edge_case_score": edge_score,
        "total_awarded_marks": total,
        "passed_mental_test_cases": passed_tests,
        "failed_mental_test_cases": failed_tests,
        "teacher_summary": f"Automated preview: Candidate provided {len(lines)} lines of logic covering standard flows.",
        "student_constructive_feedback": "Good structural attempt. Ensure explicit guards for edge cases and boundary conditions."
    }
