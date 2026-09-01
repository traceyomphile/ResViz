import pytest

from app.src.parser import Node


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("P", "P"),
        ("(P)", "P"),
        ("~P", "~P"),
        ("(P & Q)", "(P & Q)"),
        ("(P | Q)", "(P | Q)"),
        ("(P -> Q)", "(P -> Q)"),
        ("(P <-> Q)", "(P <-> Q)"),
    ],
)
def test_node_validation_parses_supported_formulas(source, expected):
    assert str(Node._validate(source)) == expected


def test_parenthesised_atom_returns_node_not_list_regression():
    parsed = Node._validate("(P)")
    assert isinstance(parsed, Node)
    assert parsed.label == "P"


def test_node_depth_and_leaf_detection():
    parsed = Node._validate("((P & Q) -> R)")
    assert parsed.get_max_depth() == 3
    assert not parsed.is_leaf()
    assert parsed.left.left.is_leaf()


def test_validate_rejects_non_string_non_node():
    with pytest.raises(TypeError):
        Node._validate(["P"])


def test_validate_rejects_malformed_formula():
    with pytest.raises(ValueError):
        Node._validate("(P ->)")

