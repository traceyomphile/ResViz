from app.src.clause import Clause, Literal


def test_literal_complement_flips_negation():
    literal = Literal("P")
    assert literal.complement() == Literal("P", negated=True)
    assert literal.complement().complement() == literal


def test_literal_string_uses_tilde_for_negation():
    assert str(Literal("Rain")) == "Rain"
    assert str(Literal("Rain", negated=True)) == "~Rain"


def test_clause_expression_is_sorted_and_readable():
    clause = Clause("C1", frozenset({Literal("Q"), Literal("P", True)}))
    assert clause.expression == "~P | Q"
    assert str(clause) == clause.expression


def test_empty_clause_uses_square_symbol():
    assert Clause("C9", frozenset()).expression == "□"


def test_clause_key_is_its_literal_set():
    literals = frozenset({Literal("P"), Literal("Q")})
    assert Clause("C1", literals).key() == literals

