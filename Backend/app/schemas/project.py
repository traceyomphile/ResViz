# app/schemas/project.py

from pydantic import BaseModel, ConfigDict
from app.src.parser import Node

class Project(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    project_id: str
    knowledge_base: list[Node]
    cnf_kb: list[Node] | None
    goal: Node | None
    status: str
    resolution_result: str