from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.exams import router as exams_router
from app.api.v1.submissions import router as submissions_router
from app.api.v1.review import router as review_router
from app.api.v1.admin import router as admin_router
from app.api.v1.teacher_students import router as teacher_students_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(exams_router)
api_router.include_router(submissions_router)
api_router.include_router(review_router)
api_router.include_router(admin_router)
api_router.include_router(teacher_students_router)
