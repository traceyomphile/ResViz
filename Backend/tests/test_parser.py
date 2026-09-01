import unittest

from app.api.routes.knowledge_base import normalise_formula, parse_formula
from app.src.parser import Node


class ParserAndValidationTests(unittest.TestCase):
    def test_accepts_atomic_proposition(self):
        parsed = Node._validate("A")
        self.assertTrue(parsed.is_leaf())
        self.assertEqual(str(parsed), "A")

    def test_parses_parenthesised_implication(self):
        parsed = parse_formula("(A -> B)")
        self.assertEqual(parsed.label, "->")
        self.assertEqual(str(parsed.left), "A")
        self.assertEqual(str(parsed.right), "B")

    def test_wraps_unparenthesised_binary_formula(self):
        self.assertEqual(str(parse_formula("A -> B")), "(A -> B)")

    def test_parses_nested_formula(self):
        parsed = parse_formula("((A & B) -> C)")
        self.assertEqual(parsed.left.label, "&")
        self.assertEqual(str(parsed.right), "C")

    def test_normalises_unicode_operators(self):
        self.assertEqual(
            normalise_formula("¬P ∨ (Q ∧ R) → S ↔ T"),
            "~P | (Q & R) -> S <-> T",
        )

    def test_rejects_incomplete_formula(self):
        with self.assertRaises(ValueError):
            parse_formula("A ->")

    def test_rejects_unsupported_characters(self):
        with self.assertRaises(ValueError):
            parse_formula("A + B")


if __name__ == "__main__":
    unittest.main()
