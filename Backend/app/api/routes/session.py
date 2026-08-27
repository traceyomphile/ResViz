# app/api/routes/session.py
import os
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Cookie, Header, Response
from app.schemas.session import SessionResponse
from app.config import SESSION_COOKIE_NAME
from app.services.SessionManager import session_manager

session_router = APIRouter(prefix='/session', tags=['Session'])
IS_PRODUCTION = os.environ.get('ENVIRONMENT') == 'production'

@session_router.get('', response_model=SessionResponse)
async def restore_session(
    response: Response,
    tab_id: str = Header(alias='X-Tab-ID'),
    browser_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> SessionResponse:
    """
    Implements a "get or create" session pattern.
    """
    now = datetime.now(timezone.utc)

    # Restore an exisiting session if one exists.
    if not browser_id:
        browser_id = secrets.token_urlsafe(32)

        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=browser_id,
            httponly=True,
            secure=IS_PRODUCTION,
            samesite='lax',
            path='/'
        )

    return await session_manager.get_or_create(
        browser_id=browser_id,
        tab_id=tab_id,
        now=now
    )
