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

## Initial Administrator Setup

When initializing a fresh database, an initial System Administrator account is provisioned:

- **Email**: `admin@exam.com`
- Set `INITIAL_ADMIN_PASSWORD` in your `.env` file before launching to customize the initial password.
- Log in and change credentials immediately from the Admin Console (`/admin/users`).

