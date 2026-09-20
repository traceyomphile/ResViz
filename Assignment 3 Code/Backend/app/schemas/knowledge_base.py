# app/schemas/knowledge_base.py
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator, model_validator
from app.src.parser import Node

def align_annotations(annotations: list[str], count: int) -> list[str]:
    if not annotations:
        return [''] * count
    if len(annotations) != count:
        raise ValueError('Annotations must contain one text value per formula')
    return [annotation.strip() for annotation in annotations]


class KnowledgeBasePayload(BaseModel):
    formulas: list[str] = Field(min_length=1)
    annotations: list[str] | None = None

    @model_validator(mode='after')
    def match_annotations(self):
        if self.annotations is not None:
            self.annotations = align_annotations(self.annotations, len(self.formulas))
        return self

class KnowledgeBaseResponse(BaseModel):
    project_id: str
    formulas: list[Node]
    annotations: list[str] = Field(default_factory=list)
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
    goal: Node | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode='after')
    def match_annotations(self):
        self.annotations = align_annotations(self.annotations, len(self.formulas))
        return self

class KnowledgeBaseEntrySummary(BaseModel):
    """Lightweight representation used to populate the sidebar."""
    id: str
    name: str
    formula_count: int
    created_at: datetime

class SaveKnowledgeBasePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    formulas: list[str]
    annotations: list[str] | None = None
    goal: str | None = None

    @model_validator(mode='after')
    def match_annotations(self):
        if self.annotations is not None:
            self.annotations = align_annotations(self.annotations, len(self.formulas))
        return self

    @field_validator('name')
    @classmethod
    def strip_name(cls, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError('Enter a knowledge base name')
        return name

class KnowledgeBaseListResponse(BaseModel):
    project_id: str
    knowledge_bases: list[KnowledgeBaseEntrySummary]