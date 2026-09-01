from app.src.clause import Literal
from app.src.cnf_converter import CNFConverter
from app.src.parser import Node


def convert(source: str):
    return CNFConverter().convert(Node._validate(source))


def clause_keys(result):
    return {frozenset((literal.symbol, literal.negated) for literal in clause) for clause in result.clauses}


def test_implication_is_removed():
    result = convert("(P -> Q)")
    assert result.final_expression == "(~P | Q)"
    assert clause_keys(result) == {frozenset({("P", True), ("Q", False)})}


def test_biconditional_becomes_two_cnf_clauses():
    result = convert("(P <-> Q)")
    assert clause_keys(result) == {
        frozenset({("P", True), ("Q", False)}),
        frozenset({("P", False), ("Q", True)}),
    }


def test_double_negation_is_removed():
    result = convert("~~P")
    assert result.final_expression == "P"
    assert result.clauses == [frozenset({Literal("P")})]


def test_de_morgan_pushes_negation_to_literals():
    result = convert("~(P & Q)")
    assert clause_keys(result) == {
        frozenset({("P", True), ("Q", True)}),
    }


def test_or_is_distributed_over_and():
    result = convert("(P | (Q & R))")
    assert clause_keys(result) == {
        frozenset({("P", False), ("Q", False)}),
        frozenset({("P", False), ("R", False)}),
    }


def test_conjunction_splits_into_unit_clauses():
    result = convert("(P & Q)")
    assert clause_keys(result) == {
        frozenset({("P", False)}),
        frozenset({("Q", False)}),
    }


def test_conversion_trace_numbers_are_sequential():
    result = convert("(P <-> Q)")
    assert [step.step_number for step in result.steps] == list(range(1, len(result.steps) + 1))
    assert all(step.rule in CNFConverter.RULE_DESCRIPTIONS for step in result.steps)

