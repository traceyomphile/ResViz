from unittest.mock import AsyncMock

import pytest

from app.schemas.knowledge_base import KnowledgeBaseEntry
from app.schemas.project import Project
from app.services.ProjectManager import ProjectManager
from app.src.parser import Node


def make_project():
    return Project(project_id="project-1", name="Test", knowledge_base=[Node._validate("P")])


def manager_with_project(project):
    manager = ProjectManager.__new__(ProjectManager)
    manager.get = AsyncMock(return_value=project)
    manager.save = AsyncMock(side_effect=lambda _session_id, updated: updated)
    return manager


def test_invalidate_reasoning_clears_derived_state():
    project = make_project()
    project.cnf_kb = ["P"]
    project.cnf_steps = [{"step_number": 1, "rule": "test"}]
    project.resolution_result = "entailed"
    project.status = "resolution-complete"
    ProjectManager._invalidate_reasoning(project)
    assert project.cnf_kb is None
    assert project.cnf_steps == []
    assert project.resolution_result == ""
    assert project.status == "draft"


@pytest.mark.asyncio
async def test_save_named_entry_uses_knowledge_bases_collection_regression():
    project = make_project()
    manager = manager_with_project(project)
    entry = KnowledgeBaseEntry(name="Rules", formulas=[Node._validate("Q")])
    saved = await manager.save_knowledge_base_entry("session-1", project.project_id, entry)
    assert saved.knowledge_bases == [entry]
    assert [str(item) for item in saved.knowledge_base] == ["Q"]


@pytest.mark.asyncio
async def test_activate_named_entry_changes_active_formulas():
    project = make_project()
    entry = KnowledgeBaseEntry(name="Rules", formulas=[Node._validate("Q")])
    project.knowledge_bases = [entry]
    manager = manager_with_project(project)
    saved = await manager.activate_knowledge_base_entry("session-1", project.project_id, entry.id)
    assert [str(item) for item in saved.knowledge_base] == ["Q"]


@pytest.mark.asyncio
async def test_activate_unknown_entry_returns_none():
    project = make_project()
    manager = manager_with_project(project)
    assert await manager.activate_knowledge_base_entry("session-1", project.project_id, "missing") is None


@pytest.mark.asyncio
async def test_set_cnf_result_persists_clauses_and_status():
    project = make_project()
    manager = manager_with_project(project)
    saved = await manager.set_cnf_result(
        "session-1", project.project_id, ["~P | Q"], [{"step_number": 1, "rule": "implication"}],
    )
    assert saved.cnf_kb == ["~P | Q"]
    assert saved.status == "cnf-complete"


@pytest.mark.asyncio
async def test_delete_active_entry_falls_back_to_remaining_entry():
    project = make_project()
    first = KnowledgeBaseEntry(name="First", formulas=[Node._validate("P")])
    second = KnowledgeBaseEntry(name="Second", formulas=[Node._validate("Q")])
    project.knowledge_bases = [first, second]
    project.knowledge_base = first.formulas
    manager = manager_with_project(project)
    saved = await manager.delete_knowledge_base_entry("session-1", project.project_id, first.id)
    assert saved.knowledge_bases == [second]
    assert [str(item) for item in saved.knowledge_base] == ["Q"]

