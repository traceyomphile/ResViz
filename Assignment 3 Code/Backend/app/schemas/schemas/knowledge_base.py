# app/schemas/knowledge_base.py
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.src.parser import Node

class KnowledgeBasePayload(BaseModel):
    formulas: list[str] = Field(min_length=1)

class KnowledgeBaseResponse(BaseModel):
    project_id: str
    formulas: list[Node]
    goal: Node | None = None

class QueryPayload(BaseModel):
    query: str

class QueryResponse(BaseModel):
    project_id: str
    query: Node | None

class ValidationPayload(BaseModel):
    formulas: list[str] = Field(min_length=1)

class FormulaValidationResult(BaseModel):
    formula: str
    valid: bool
    error: str | None = None

class ValidationResponse(BaseModel):
    valid: bool
    results: list[FormulaValidationResult]

"""Named, saved knowledge bases (sidebat library)"""
class KnowledgeBaseEntry(BaseModel):
    """A n amed snapshot of formulas that a user has saved to a project."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    formulas: list[Node]

    annotations: list[str] = Field(default_factory=list)
    goal: Node | Node = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class KnowledgeBaseEntrySummary(BaseModel):
    """Lightweight representation used to populate the sidebar."""
    id: str
    name: str
    formula_count: int
    created_at: datetime

class SaveKnowledgeBasePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    formulas: list[str] = Field(min_length=1)
    annotations: list[str] | None = None
    goal: str | None

class KnowledgeBaseListResponse(BaseModel):
    project_id: str
    knowledge_bases: list[KnowledgeBaseEntrySummary]