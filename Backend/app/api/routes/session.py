# app/api/routes/session.py

from datetime import datetime, timezone
from fastapi import APIRouter, Cookie, Response
from app.schemas.session import SessionResponse
from app.config import SESSION_COOKIE_NAME, SESSION_DURATION
from app.services.SessionManager import session_manager

session_router = APIRouter(prefix='/session', tags=['Session'])

@session_router.get('', response_model=SessionResponse)
async def restore_session(
    response: Response,
    resviz_session: str | None = Cookie(default=None),
) -> SessionResponse:
    """
    Implements a "get or create" session pattern.
    """
    now = datetime.now(timezone.utc)

    # Restore an exisiting session if one exists.
    if resviz_session:
        existing = await session_manager.get(resviz_session, now)
        if existing:
            return existing

        new_session = await session_manager.create(now)
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=new_session.session_id,
            httponly=True,
            secure=False,
            samesite='lax',
            max_age=int(SESSION_DURATION.total_seconds()),
            path='/'
        )

        return new_session
