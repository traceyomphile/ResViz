# app/schemas/project.py

from pydantic import BaseModel, ConfigDict, Field
from app.src.parser import Node

class Project(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    project_id: str
    name: str = 'Untitled Project'
    description: str = ''
    knowledge_base: list[Node]
    cnf_kb: list[Node] | None
    cnf_steps: list[dict[str, str | int]] = Field(default_factory=list)
    goal: Node | None
    status: str
    resolution_result: str