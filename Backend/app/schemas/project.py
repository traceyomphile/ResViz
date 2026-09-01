# app/schemas/project.py

from pydantic import BaseModel, ConfigDict, Field
from app.src.parser import Node
from app.schemas.knowledge_base import KnowledgeBaseEntry

class Project(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    project_id: str
    name: str = 'Untitled Project'
    description: str = ''
    knowledge_base: list[Node] = Field(default_factory=list)
    knowledge_bases: list[KnowledgeBaseEntry] = Field(default_factory=list)
    # CNF clauses are stored in displayable clause form, for example
    # "~Applicant | Qualified". A clause is not necessarily a parser node.
    cnf_kb: list[str] | None = None
    cnf_steps: list[dict[str, str | int]] = Field(default_factory=list)
    goal: Node | None = None
    status: str = 'draft'
    resolution_result: str = ''
