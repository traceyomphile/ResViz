# app/schemas/project.py

from pydantic import BaseModel
from app.src.parser import Node

class Project(BaseModel):
    project_id: str
    knowledge_base: list[Node]
    cnf_kb: list[Node] | None
    goal: Node
    status: str
    resolution_result: str