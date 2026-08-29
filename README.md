# CognitiveExam - Fast Groq LLM Evaluated Exam Platform

An enterprise-ready, interview-style examination software built with **FastAPI**, **Next.js 14**, **Supabase (PostgreSQL)**, and **Groq API** (`llama-3.3-70b-versatile`).

---

## Features

1. **Near-Instant Groq Rubric Evaluation (~500 tokens/sec)**:
   - Plain-text interview document evaluation with structured Pydantic schema validation.
   - Separate scoring for **Logic Correctness (60%)**, **Syntax Resilience (20%)**, and **Edge Case Guarding (20%)**.
   - Mental test-case tracing with passed/failed execution traces and constructive feedback.

2. **Deterministic MCQ Grader**:
   - Zero-latency auto-grading of multiple-choice questions.

3. **Client-Side Anti-Cheat Telemetry (`useExamSecurity`)**:
   - Fullscreen enforcement & exit detection.
   - Tab switch & window blur detection via `visibilitychange`.
   - Disabled clipboard (cut, copy, paste) and right-click context menu.
   - Comprehensive telemetry event audit trail logged for teacher review.

4. **Monospace Interview Doc Editor (`CodeDocEditor`)**:
   - Native Tab key indentation support (`preventDefault` on Tab).
   - Spellcheck and autocomplete disabled for distraction-free algorithmic writing.

5. **Teacher Split-Screen Review Portal**:
   - Left: Problem statement, rubric notes, and candidate's raw answer.
   - Right: Groq evaluation breakdown with mental test cases, AI summary, and manual teacher score override controls.

6. **Admin Console**:
   - Account provisioning, role modification (`ADMIN`, `TEACHER`, `STUDENT`), and platform-wide statistics.

## Supabase PostgreSQL Setup

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Navigate to the **SQL Editor** in Supabase and run the migration script located at:
   `backend/supabase_schema.sql`
3. Copy your project connection string from **Project Settings > Database > Connection String (URI)**:
   - Format: `postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## Guide

### 1. Backend Setup (FastAPI)

```bash
cd backend

# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables (.env)
cp .env.example .env
# Edit .env and set your DATABASE_URL and GROQ_API_KEY
```
```

# 4. Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`

### 2. Frontend Setup (Next.js)

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Next.js development server
npm run dev
```
- App URL: `http://localhost:3000`

---

## 🔑 Pre-Seeded Demo Credentials

| Role | Email | Password | Dashboard |
| :--- | :--- | :--- | :--- |
| **Student** | `student@exam.com` | `student123` | `/student/exams` |
| **Teacher** | `teacher@exam.com` | `teacher123` | `/teacher/dashboard` |
| **Admin** | `admin@exam.com` | `admin123` | `/admin/users` |
