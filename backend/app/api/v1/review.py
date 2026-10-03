import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.question import Question
from app.models.submission import Submission, SubmissionAnswer
from app.schemas.submission import SubmissionOut, SubmissionAnswerOut, ScoreOverride
from app.services.queue_engine import queue_manager
from app.api.deps import require_role

router = APIRouter(prefix="/review", tags=["review"])

@router.get("/exam/{exam_id}/submissions", response_model=List[SubmissionOut])
async def get_exam_submissions_for_teacher(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Retrieve all student submissions for a specific exam with student details & telemetry"""
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student)
    ).where(Submission.exam_id == exam_id).order_by(Submission.submitted_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

import io
import csv
from datetime import datetime, timezone
from fastapi.responses import StreamingResponse

@router.get("/exam/{exam_id}/live-roster")
async def get_exam_live_roster(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """
    Live candidate pooling endpoint for teachers.
    Aggregates all candidate accounts, their real-time exam status,
    live elapsed times, security strike telemetry, and scores without loading heavy answer payloads.
    """
    # 1. Fetch Exam (selective columns)
    exam_res = await db.execute(
        select(
            Exam.id,
            Exam.title,
            Exam.access_code,
            Exam.duration_minutes,
            Exam.timer_mode,
            Exam.is_active
        ).where(Exam.id == exam_id)
    )
    exam = exam_res.first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    # Calculate max marks efficiently
    marks_res = await db.execute(
        select(func.coalesce(func.sum(Question.max_marks), 0)).where(Question.exam_id == exam_id)
    )
    max_marks = marks_res.scalar() or 0

    # 2. Fetch all registered students (selective columns)
    students_res = await db.execute(
        select(User.id, User.full_name, User.email)
        .where(User.role == UserRole.STUDENT)
        .order_by(User.full_name.asc())
    )
    students = students_res.all()

    # 3. Fetch submissions (selective columns only, no answer/question payloads)
    subs_res = await db.execute(
        select(
            Submission.id,
            Submission.student_id,
            Submission.status,
            Submission.started_at,
            Submission.submitted_at,
            Submission.cheat_flags,
            Submission.total_score
        ).where(Submission.exam_id == exam_id)
    )
    submissions = subs_res.all()
    subs_by_student = {s.student_id: s for s in submissions}

    # 4. Build live roster and statistics
    now_utc = datetime.now(timezone.utc)
    roster_list = []
    in_prog_count = 0
    sub_count = 0
    not_started_count = 0
    total_strikes = 0
    flagged_students = 0

    for std in students:
        sub = subs_by_student.get(std.id)
        if not sub:
            part_status = "NOT_STARTED"
            not_started_count += 1
            started_iso = None
            submitted_iso = None
            elapsed_sec = None
            strikes_num = 0
            strike_events = []
            score = None
            sub_id = None
        else:
            raw_status = sub.status.value if hasattr(sub.status, "value") else str(sub.status)
            part_status = raw_status
            sub_id = str(sub.id)
            started_iso = sub.started_at.isoformat() if sub.started_at else None
            submitted_iso = sub.submitted_at.isoformat() if sub.submitted_at else None
            
            # Calculate elapsed time
            if sub.started_at:
                end_time = sub.submitted_at if sub.submitted_at else now_utc
                st_time = sub.started_at if sub.started_at.tzinfo else sub.started_at.replace(tzinfo=timezone.utc)
                elapsed_sec = max(0, int((end_time - st_time).total_seconds()))
            else:
                elapsed_sec = None

            cheat_dict = sub.cheat_flags or {}
            strikes_num = cheat_dict.get("total_strikes", 0)
            strike_events = [e.get("reason", "Violation") for e in cheat_dict.get("events", [])]
            total_strikes += strikes_num
            if strikes_num > 0:
                flagged_students += 1

            if raw_status == "IN_PROGRESS":
                in_prog_count += 1
                score = None
            else:
                sub_count += 1
                score = sub.total_score if raw_status == "EVALUATED" else None

        roster_list.append({
            "student_id": str(std.id),
            "full_name": std.full_name,
            "email": std.email,
            "status": part_status,
            "submission_id": sub_id,
            "started_at": started_iso,
            "submitted_at": submitted_iso,
            "elapsed_seconds": elapsed_sec,
            "total_strikes": strikes_num,
            "strike_events": strike_events,
            "total_score": score,
            "max_marks": max_marks
        })

    return {
        "exam": {
            "id": str(exam.id),
            "title": exam.title,
            "access_code": exam.access_code,
            "duration_minutes": exam.duration_minutes,
            "total_marks": max_marks,
            "timer_mode": exam.timer_mode,
            "is_active": exam.is_active
        },
        "summary": {
            "total_candidates": len(students),
            "in_progress_count": in_prog_count,
            "submitted_count": sub_count,
            "not_started_count": not_started_count,
            "total_strikes": total_strikes,
            "flagged_candidates_count": flagged_students
        },
        "roster": roster_list
    }

@router.get("/exam/{exam_id}/export-csv")
async def export_exam_results_csv(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """
    Downloads full exam dashboard and candidate results spreadsheet.
    Can be downloaded at any time (pre-exam, during exam, or post-evaluation).
    """
    exam_res = await db.execute(
        select(Exam.id, Exam.title, Exam.access_code).where(Exam.id == exam_id)
    )
    exam = exam_res.first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    marks_res = await db.execute(
        select(func.coalesce(func.sum(Question.max_marks), 0)).where(Question.exam_id == exam_id)
    )
    max_marks = marks_res.scalar() or 0

    # Fetch students & submissions (selective columns)
    students_res = await db.execute(
        select(User.id, User.full_name, User.email)
        .where(User.role == UserRole.STUDENT)
        .order_by(User.full_name.asc())
    )
    students = students_res.all()

    subs_res = await db.execute(
        select(
            Submission.student_id,
            Submission.status,
            Submission.started_at,
            Submission.submitted_at,
            Submission.cheat_flags,
            Submission.total_score
        ).where(Submission.exam_id == exam_id)
    )
    submissions = subs_res.all()
    subs_by_student = {s.student_id: s for s in submissions}

    now_utc = datetime.now(timezone.utc)
    output = io.StringIO()
    writer = csv.writer(output)

    # Write CSV Header
    writer.writerow([
        "Student ID",
        "Candidate Name",
        "Email",
        "Exam Title",
        "Access Code",
        "Participation Status",
        "Started At (UTC)",
        "Submitted At (UTC)",
        "Elapsed Time (Minutes)",
        "Total Score",
        "Max Marks",
        "Security Strikes",
        "Violation Log"
    ])

    for std in students:
        sub = subs_by_student.get(std.id)
        if not sub:
            writer.writerow([
                str(std.id),
                std.full_name,
                std.email,
                exam.title,
                exam.access_code or "",
                "NOT_STARTED",
                "",
                "",
                "",
                "",
                max_marks,
                0,
                ""
            ])
        else:
            raw_status = sub.status.value if hasattr(sub.status, "value") else str(sub.status)
            cheat_dict = sub.cheat_flags or {}
            strikes_num = cheat_dict.get("total_strikes", 0)
            events = cheat_dict.get("events", [])
            violation_summary = " | ".join([f"{e.get('reason')} ({e.get('timestamp', '')})" for e in events])

            elapsed_mins_str = ""
            if sub.started_at:
                end_t = sub.submitted_at if sub.submitted_at else now_utc
                st_t = sub.started_at if sub.started_at.tzinfo else sub.started_at.replace(tzinfo=timezone.utc)
                elapsed_mins = round((end_t - st_t).total_seconds() / 60.0, 1)
                elapsed_mins_str = str(elapsed_mins)

            score_val = str(sub.total_score) if raw_status == "EVALUATED" else ("Pending Evaluation" if raw_status != "IN_PROGRESS" else "In Progress")

            writer.writerow([
                str(std.id),
                std.full_name,
                std.email,
                exam.title,
                exam.access_code or "",
                raw_status,
                sub.started_at.isoformat() if sub.started_at else "",
                sub.submitted_at.isoformat() if sub.submitted_at else "",
                elapsed_mins_str,
                score_val,
                max_marks,
                strikes_num,
                violation_summary
            ])

    output.seek(0)
    filename = f"exam_results_{exam.access_code or 'export'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/exam/{exam_id}/evaluation-status")
async def get_exam_evaluation_status(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
) -> Dict[str, Any]:
    """Returns live batch evaluation statistics (total, pending, evaluating, evaluated, progress_percent)"""
    return await queue_manager.get_exam_batch_status(db, exam_id)

@router.post("/exam/{exam_id}/start-evaluation")
async def start_exam_batch_evaluation(
    exam_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """
    Triggers fair, serialized batch evaluation for all pending submissions of this exam.
    Enforces strictly 1 paper evaluated at a time for this exam.
    """
    exam_res = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    background_tasks.add_task(queue_manager.evaluate_exam_batch, exam_id)
    return {
        "message": f"Batch evaluation started for exam '{exam.title}'",
        "exam_id": str(exam_id),
        "status": "processing"
    }

@router.post("/submission/{submission_id}/evaluate-now")
async def evaluate_single_submission_now(
    submission_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Evaluates a single specific submission on demand"""
    sub_res = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = sub_res.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    background_tasks.add_task(queue_manager.evaluate_single_submission, submission_id, f"teacher-manual-{current_user.id}")
    return {"message": "Evaluation queued for submission", "submission_id": str(submission_id)}

@router.get("/submission/{submission_id}", response_model=SubmissionOut)
async def get_submission_for_review(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Detailed view for teacher grading including rubric notes, student code, Groq JSON breakdown, and cheat strikes"""
    query = select(Submission).options(
        selectinload(Submission.answers).selectinload(SubmissionAnswer.question),
        selectinload(Submission.student),
        selectinload(Submission.exam)
    ).where(Submission.id == submission_id)
    
    result = await db.execute(query)
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return sub

@router.patch("/answer/{answer_id}/override", response_model=SubmissionAnswerOut)
async def override_answer_score(
    answer_id: uuid.UUID,
    override: ScoreOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))
):
    """Teacher manual score override & feedback for an individual answer"""
    query = select(SubmissionAnswer).options(
        selectinload(SubmissionAnswer.question),
        selectinload(SubmissionAnswer.submission)
    ).where(SubmissionAnswer.id == answer_id)
    result = await db.execute(query)
    ans = result.scalar_one_or_none()
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found.")

    ans.teacher_override_score = override.teacher_override_score
    ans.teacher_feedback = override.teacher_feedback

    # Recalculate submission total score
    submission_id = ans.submission_id
    await db.flush()

    sub_query = select(Submission).options(selectinload(Submission.answers)).where(Submission.id == submission_id)
    sub_res = await db.execute(sub_query)
    sub = sub_res.scalar_one()

    new_total = sum(
        (a.teacher_override_score if a.teacher_override_score is not None else a.auto_score)
        for a in sub.answers
    )
    sub.total_score = round(new_total, 2)
    await db.commit()
    await db.refresh(ans)
    return ans
