import sys
import types
from unittest.mock import AsyncMock

import pytest

# Isolate conversion.py from the unrelated project upload route during unit
# collection. That route requires python-multipart; conversion only needs the
# dependency callable's symbol.
project_route_stub = types.ModuleType("app.api.routes.project")


async def require_session():
    return "test-session"


project_route_stub.require_session = require_session
sys.modules.setdefault("app.api.routes.project", project_route_stub)

from app.api.routes import conversion as conversion_route
from app.api.routes.conversion import clause_text, convert_to_cnf, not_node, project_formulas, resolve_project
from app.schemas.knowledge_base import KnowledgeBaseEntry
from app.schemas.project import Project
from app.src.clause import Literal
from app.src.parser import Node


def make_project():
    entry = KnowledgeBaseEntry(
        name="Modus ponens",
        formulas=[Node._validate("(P -> Q)"), Node._validate("P")],
    )
    return Project(
        project_id="project-1",
        knowledge_base=list(entry.formulas),
        knowledge_bases=[entry],
        goal=Node._validate("Q"),
    )


def test_clause_text_is_stable_and_handles_empty_clause():
    assert clause_text(frozenset({Literal("Q"), Literal("P", True)})) == "~P | Q"
    assert clause_text(frozenset()) == "□"


def test_not_node_wraps_goal_in_negation():
    assert str(not_node(Node._validate("Q"))) == "~Q"


def test_project_formulas_does_not_duplicate_active_saved_kb():
    project = make_project()
    assert [str(item) for item in project_formulas(project)] == ["(P -> Q)", "P"]


def test_project_formulas_includes_distinct_unsaved_active_kb():
    project = make_project()
    project.knowledge_base = [Node._validate("R")]
    assert [str(item) for item in project_formulas(project)] == ["(P -> Q)", "P", "R"]


@pytest.mark.asyncio
async def test_cnf_endpoint_returns_kb_and_negated_goal_clauses(monkeypatch):
    project = make_project()
    fake_manager = type("Manager", (), {})()
    fake_manager.get = AsyncMock(return_value=project)
    fake_manager.set_cnf_result = AsyncMock(side_effect=lambda *_args: project)
    monkeypatch.setattr(conversion_route, "project_manager", fake_manager)
    response = await convert_to_cnf(project.project_id, "session-1")
    assert "~P | Q" in response.cnf_clauses
    assert "P" in response.cnf_clauses
    assert response.support_clauses == ["~Q"]
    assert response.negated_goal == "~Q"


@pytest.mark.asyncio
async def test_resolution_endpoint_proves_modus_ponens(monkeypatch):
    project = make_project()
    project.cnf_kb = ["~P | Q", "P"]
    fake_manager = type("Manager", (), {})()
    fake_manager.get = AsyncMock(return_value=project)
    fake_manager.set_resolution_result = AsyncMock(side_effect=lambda *_args: project)
    monkeypatch.setattr(conversion_route, "project_manager", fake_manager)
    response = await resolve_project(project.project_id, "session-1")
    assert response.entailed is True
    assert response.status == "entailed"
    assert response.steps[-1].resolvent == "□"
