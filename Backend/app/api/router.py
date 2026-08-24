# api.router.py
# All endpoint routers are combined in one place

from fastapi import APIRouter
from app.config import router as session_router

api_router = APIRouter(prefix='/api')
api_router.include_router(session_router)