# app/api/routes/project.py

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.schemas.project import Project
from app.services.ProjectManager import project_manager
from app.services.SessionManager import session_manager

project_router = APIRouter(prefix='/projects', tags=['Projects'])

async def require_session(session_id: str = Header(alias='X-Session-ID')) -> str:
    """
    Ensure that the request belongs to a valid, non-expired ResViz session.
    Returns the session ID if the session exists.
    """
    now = datetime.now(timezone.utc)

    session = await session_manager.get(session_id, now)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Session not found or expired'
        )

    return session_id

@project_router.get('', response_model=list[Project])
async def get_projects(session_id: str = Depends(require_session)) -> list[Project]:
    """Return all projects belonging to the current session."""
    return await project_manager.get_all(session_id)

@project_router.get('/{project_id}', response_model=Project)
async def get_project(project_id: str, session_id: str = Depends(require_session)) -> Project:
    """Return a project of the given project ID belonging to the current session."""
    project = await project_manager.get(session_id, project_id)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Project not found'
        )

    return project

@project_router.post('', response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(project: Project, session_id: str = Depends(require_session)) -> Project:
    """Create a new project for the current session."""
    created_project = await project_manager.create(session_id, project)

    if created_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Session not found or expired.'
        )

    return create_project

@project_router.delete('/{project_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, session_id: str = Depends(require_session)) -> None:
    """Delete the project of the specified ID from the current session."""
    deleted = await project_manager.delete(session_id, project_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail='Project not found'
        )