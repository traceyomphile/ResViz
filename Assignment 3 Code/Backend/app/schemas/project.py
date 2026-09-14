# app/schemas/project.py

from pydantic import BaseModel, ConfigDict, Field

from app.src.parser import Node
from app.schemas.knowledge_base import KnowledgeBaseEntry


class Project(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    project_id: str
    name: str = "Untitled Project"
    description: str = ""

    knowledge_base: list[Node] = Field(default_factory=list)
    knowledge_bases: list[KnowledgeBaseEntry] = Field(default_factory=list)

    # CNF clauses use displayable strings such as:
    # "~Applicant | Qualified"
    # A CNF clause is not necessarily a parser Node.
    cnf_kb: list[str] | None = None
    cnf_steps: list[dict[str, str | int]] = Field(default_factory=list)

    goal: Node | None = None
    status: str = "draft"
    resolution_result: str = ""

"""
Separate class for updating to avoid requesting the whole project just to change the name.
"""
class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)