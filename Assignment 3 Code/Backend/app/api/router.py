# api.router.py
# All endpoint routers are combined in one place

from fastapi import APIRouter
from app.api.routes.session import session_router
from app.api.routes.health import health_router
from app.api.routes.project import project_router
from app.api.routes.knowledge_base import knowledge_base_router
from app.api.routes.conversion import conversion_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(session_router)
api_router.include_router(project_router)
api_router.include_router(knowledge_base_router)
api_router.include_router(conversion_router)
