# app/schemas/project.py

from pydantic import BaseModel, ConfigDict, Field
from app.src.parser import Node
from app.schemas.knowledge_base import KnowledgeBaseEntry

class Project(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    project_id: str
    name: str = 'Untitled Project'
    description: str = ''
    knowledge_base: list[Node]
    knowledge_bases: list[KnowledgeBaseEntry] = Field(default_factory=list)
    cnf_kb: list[str] | None
    cnf_steps: list[dict[str, str | int]] = Field(default_factory=list)
    goal: Node | None
    status: str
    resolution_result: str
