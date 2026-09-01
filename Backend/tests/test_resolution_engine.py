import unittest

from app.src.clause import Clause, Literal
from app.src.resolution_engine import ResolutionEngine, ResolutionStatus


def lit(symbol: str, negated: bool = False) -> Literal:
    return Literal(symbol=symbol, negated=negated)


class ResolutionEngineTests(unittest.TestCase):
    def test_derives_empty_clause_for_entailed_query(self):
        clauses = [
            Clause("C1", frozenset({lit("Applicant", True), lit("Qualified")})),
            Clause("C2", frozenset({lit("Applicant")})),
            Clause("C3", frozenset({lit("Qualified", True)})),
        ]
        result = ResolutionEngine().run(clauses, {"C3"})
        self.assertTrue(result.entailed)
        self.assertTrue(result.empty_clause_reached)
        self.assertEqual(result.status, ResolutionStatus.ENTAILED)
        self.assertEqual(result.steps[-1].resolvent.expression, "□")

    def test_reports_not_entailed_when_no_complement_exists(self):
        clauses = [
            Clause("C1", frozenset({lit("Applicant")})),
            Clause("C2", frozenset({lit("Qualified", True)})),
        ]
        result = ResolutionEngine().run(clauses, {"C2"})
        self.assertFalse(result.entailed)
        self.assertEqual(result.status, ResolutionStatus.NOT_ENTAILED)
        self.assertEqual(result.steps, [])

    def test_requires_a_set_of_support(self):
        with self.assertRaises(ValueError):
            ResolutionEngine().run([Clause("C1", frozenset({lit("P")}))], set())

    def test_records_parent_clauses_pivot_and_resolvent(self):
        clauses = [
            Clause("C1", frozenset({lit("P", True), lit("Q")})),
            Clause("C2", frozenset({lit("P")})),
            Clause("C3", frozenset({lit("Q", True)})),
        ]
        result = ResolutionEngine().run(clauses, {"C3"})
        self.assertGreaterEqual(len(result.steps), 2)
        self.assertTrue(all(step.parent_1.id and step.parent_2.id for step in result.steps))
        self.assertTrue(all(step.pivot.symbol for step in result.steps))
        self.assertTrue(all(step.resolvent.id for step in result.steps))


if __name__ == "__main__":
    unittest.main()
