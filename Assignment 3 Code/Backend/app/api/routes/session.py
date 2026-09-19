# app/api/routes/session.py
import os
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Request, Response, status
from app.schemas.session import SessionResponse, SessionErrorResponse
from app.config import SESSION_COOKIE_NAME
from app.services.SessionManager import session_manager, SessionLimitExceededError

session_router = APIRouter(prefix='/session', tags=['Session'])
IS_PRODUCTION = os.environ.get('ENVIRONMENT') == 'production'

def _get_or_create_browser_id(request: Request, response: Response) -> str:
    """
    Return the browser identifier stored in the HTTPOnly session cookie.
    """
    browser_id = request.cookies.get(SESSION_COOKIE_NAME)
    if browser_id:
        return browser_id
    browser_id = secrets.token_urlsafe(32)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=browser_id,
        httponly=True,
        secure=False,
        samesite='lax',
        path='/',
    )
    return browser_id

@session_router.get('', response_model=SessionResponse, responses={400: {'model': SessionErrorResponse}, 429: {'model': SessionErrorResponse}})
async def restore_session(
    request: Request,
    response: Response,
    x_tab_id: str | None = Header(default=None),
) -> SessionResponse:
    """
    Implements a "get or create" session pattern.
    """
    # Restore an exisiting session if one exists.
    if not x_tab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Missing X-Tab-ID header')

    browser_id = _get_or_create_browser_id(request, response)
    now = datetime.now(timezone.utc)

    try:
        return await session_manager.get_or_create(browser_id, x_tab_id, now)
    
    except SessionLimitExceededError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

@session_router.delete("", status_code=status.HTTP_204_NO_CONTENT, responses={400: {'model': SessionErrorResponse}})
async def delete_session(request: Request, x_tab_id: str | None = Header(default=None)) -> None:
    if not x_tab_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Missing X-Tab-ID header',
        )
    browser_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not browser_id:
        return

    session_id = session_manager._session_id(browser_id, x_tab_id)
    await session_manager.delete(session_id)