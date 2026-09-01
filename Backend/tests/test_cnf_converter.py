import unittest

from app.src.cnf_converter import CNFConverter
from app.src.parser import Node


def clause_strings(formula: str) -> list[str]:
    result = CNFConverter().convert(Node._validate(formula))
    return [" | ".join(sorted(map(str, clause))) for clause in result.clauses]


class CNFConverterTests(unittest.TestCase):
    def test_removes_implication(self):
        result = CNFConverter().convert(Node._validate("(A -> B)"))
        self.assertEqual(clause_strings("(A -> B)"), ["B | ~A"])
        self.assertIn("remove_implication", [step.rule for step in result.steps])

    def test_removes_equivalence(self):
        result = CNFConverter().convert(Node._validate("(P <-> Q)"))
        rendered = {frozenset(map(str, clause)) for clause in result.clauses}
        self.assertEqual(rendered, {frozenset({"~P", "Q"}), frozenset({"P", "~Q"})})

    def test_conjunctive_antecedent_becomes_one_clause(self):
        self.assertEqual(
            clause_strings("((A & B) -> C)"),
            ["C | ~A | ~B"],
        )

    def test_distributes_or_over_and(self):
        self.assertEqual(
            clause_strings("(A | (B & C))"),
            ["A | B", "A | C"],
        )

    def test_splits_conjunction_into_all_clauses(self):
        self.assertEqual(
            clause_strings("((A -> B) & A)"),
            ["B | ~A", "A"],
        )


if __name__ == "__main__":
    unittest.main()
