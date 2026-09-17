# app/schemas/session.py

from datetime import datetime
from pydantic import BaseModel, Field

class SessionErrorResponse(BaseModel):
    detail: str
    
class SessionResponse(BaseModel):
    """
    Defines the data returned by the API when the frontend
    requests info about the current user session.
    """
    session_id: str 
    active_project_id: str | None = None
    project_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    expires_at: datetime