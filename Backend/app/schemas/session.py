# app/schemas/session.py

from datetime import datetime
from pydantic import BaseModel

class SessionResponse(BaseModel):
    """
    Defines the data returned by the API when the frontend
    requests info about the current user session.
    """
    session_id: str 
    active_project_id: str | None    
    project_ids: list[str]
    created_at: datetime
    expires_at: datetime