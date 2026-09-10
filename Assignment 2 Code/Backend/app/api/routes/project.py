# app/api/routes/project.py

from datetime import datetime, timezone
from fastapi import (
    APIRouter, 
    Depends, 
    Header, 
    HTTPException, 
    UploadFile,
    status,
)
from fastapi.responses import Response
from pydantic import ValidationError
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

@project_router.post('/import', response_model=Project, status_code=status.HTTP_201_CREATED)
async def import_project(file: UploadFile, overwrite: bool=False, session_id: str = Depends(require_session)) -> Project:
    """
    Import a ResViz project from a JSON file.
    By default, importing a project whose project_id already exists returns HTTP 409.
    Set ?overwrite=true to replace the existing project.
    """
    # We expect the exported ResViz project files to be JSON files.
    if file.filename and not file.filename.lower().endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, 
            detail='Project import must be a .json file'
        )

    try:
        contents = await file.read()
        raw_json = contents.decode('utf-8', errors='replace')

        imported_project = await project_manager.import_project(
            session_id=session_id,
            raw_json=raw_json,
            overwrite=overwrite,
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Project file must be valid UTF-8 JSON'
        )

    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                'message': (
                    'Project JSON does not match the '
                    'ResViz project format'
                ),
                'errors': exc.errors(),
            },
        )

    except FileExistsError:
        raise HTTPException(    # Instead of raise an Exception, I would overwrite if the case.
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                'A project with this project_id already exists. '
                'Use overwrite=true to replace it.'
            )
        )

    if imported_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Session not found or expired.'
        )

    return imported_project

@project_router.get('/{project_id}/export', response_class=Response)
async def export_project(project_id: str, session_id: str = Depends(require_session)) -> Response:
    """Export a project belonging to the current session as a JSON file"""
    raw_json = await project_manager.export_project(session_id, project_id)

    if raw_json is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Project not found'
        )

    # Prevent weird project IDs from becoming weird filenames.
    sane_project_id = ''.join(c if c.isalnum() or c in ('-', '_') else '_' for c in project_id)

    return Response(
        content=raw_json,
        media_type='application/json',
        headers={
            'Content-Disposition': (
                f'attachment; filename={sane_project_id}.json'
            )
        },
    )

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

    return created_project

@project_router.delete('/{project_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, session_id: str = Depends(require_session)) -> None:
    """Delete the project of the specified ID from the current session."""
    deleted = await project_manager.delete(session_id, project_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail='Project not found'
        )