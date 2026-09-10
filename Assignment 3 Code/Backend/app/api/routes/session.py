# app/api/routes/session.py
import os
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from app.schemas.session import SessionResponse
from app.config import SESSION_COOKIE_NAME
from app.services.SessionManager import session_manager

session_router = APIRouter(prefix='/session', tags=['Session'])
IS_PRODUCTION = os.environ.get('ENVIRONMENT') == 'production'

@session_router.get('', response_model=SessionResponse)
async def restore_session(
    x_tab_id: str | None = Header(default=None),
) -> SessionResponse:
    """
    Implements a "get or create" session pattern.
    """
    # Restore an exisiting session if one exists.
    if not x_tab_id:
        raise HTTPException(status_code=400, detail='Missing X-Tab-ID header')

    now = datetime.now(timezone.utc)

    return await session_manager.get_or_create(x_tab_id, now)

@session_router.delete("", status_code=204)
async def delete_session(x_session_id: str | None = Header(default=None)) -> None:
    if not x_session_id:
        return

    await session_manager.delete(x_session_id)