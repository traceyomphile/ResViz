import pytest

from app.src.clause import Clause, Literal
from app.src.resolution_engine import ResolutionEngine, ResolutionStatus


def clause(identifier, *literals):
    parsed = []
    for value in literals:
        parsed.append(Literal(value[1:], True) if value.startswith("~") else Literal(value))
    return Clause(identifier, frozenset(parsed))


def test_modus_ponens_query_reaches_empty_clause():
    clauses = [
        clause("C1", "~P", "Q"),
        clause("C2", "P"),
        clause("C3", "~Q"),
    ]
    result = ResolutionEngine().run(clauses, {"C3"})
    assert result.entailed is True
    assert result.empty_clause_reached is True
    assert result.status is ResolutionStatus.ENTAILED
    assert result.steps[-1].resolvent.expression == "□"


def test_unrelated_query_is_not_entailed():
    result = ResolutionEngine().run(
        [clause("C1", "P"), clause("C2", "~Q")],
        {"C2"},
    )
    assert result.entailed is False
    assert result.status is ResolutionStatus.NOT_ENTAILED


def test_support_clause_is_required():
    with pytest.raises(ValueError, match="support clause"):
        ResolutionEngine().run([clause("C1", "P")], set())


def test_existing_empty_clause_returns_immediately():
    result = ResolutionEngine().run([clause("C1")], {"C1"})
    assert result.entailed is True
    assert result.steps == []


def test_tautological_resolvent_is_detected():
    literals = frozenset({Literal("P"), Literal("P", True)})
    assert ResolutionEngine()._is_tautology(literals) is True


def test_step_limit_is_reported():
    clauses = [clause("C1", "P", "Q"), clause("C2", "~P"), clause("C3", "~Q")]
    result = ResolutionEngine().run(clauses, {"C2", "C3"}, max_steps=0)
    assert result.status is ResolutionStatus.LIMIT_REACHED
    assert result.entailed is False


def test_derived_clause_ids_continue_after_highest_existing_id():
    clauses = [clause("C7", "P"), clause("C12", "~P", "Q")]
    result = ResolutionEngine().run(clauses, {"C12"})
    assert any(item.id == "C13" for item in result.clauses)

