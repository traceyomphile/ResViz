# app.api.routes.health.py

from fastapi import APIRouter

health_router = APIRouter(prefix='/health', tags=['Health'])

@health_router.get('')
async def health_check() -> dict[str, str]:
    return {
        'status': 'healthy',
        'message': 'ResViz backend is running',
    }
