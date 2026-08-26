# api.router.py
# All endpoint routers are combined in one place

from fastapi import APIRouter
from app.api.routes.session import session_router
from app.api.routes.health import health_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(session_router)