# app/schemas/knowledge_base.py

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