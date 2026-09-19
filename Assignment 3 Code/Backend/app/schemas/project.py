# app/schemas/project.py

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Self

from app.src.parser import Node
from app.schemas.knowledge_base import KnowledgeBaseEntry, align_annotations


class Project(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    project_id: str
    name: str = "Untitled Project"
    description: str = ""

    knowledge_base: list[Node] = Field(default_factory=list)
    knowledge_base_annotations: list[str] = Field(default_factory=list)
    knowledge_bases: list[KnowledgeBaseEntry] = Field(default_factory=list)
    active_knowledge_base_id: str | None = None

    # CNF clauses use displayable strings such as:
    # "~Applicant | Qualified"
    # A CNF clause is not necessarily a parser Node.
    cnf_kb: list[str] | None = None
    cnf_steps: list[dict[str, str | int]] = Field(default_factory=list)

    goal: Node | None = None
    status: str = "draft"
    resolution_result: str = ""

    @model_validator(mode='after')
    def restore_legacy_knowledge_bases(self) -> Self:
        # Earlier exports kept one project goal and no active KB identifier.
        for entry in self.knowledge_bases:
            if 'goal' not in entry.model_fields_set:
                entry.goal = self.goal
        if self.active_knowledge_base_id is None:
            signature = [str(formula) for formula in self.knowledge_base]
            selected = next((entry for entry in self.knowledge_bases if [str(formula) for formula in entry.formulas] == signature), None)
            if selected is not None:
                self.active_knowledge_base_id = selected.id
        active = next((entry for entry in self.knowledge_bases if entry.id == self.active_knowledge_base_id), None)
        if 'knowledge_base_annotations' not in self.model_fields_set and active is not None:
            self.knowledge_base_annotations = list(active.annotations)
        self.knowledge_base_annotations = align_annotations(self.knowledge_base_annotations, len(self.knowledge_base))
        return self
