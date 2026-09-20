from dataclasses import dataclass
from enum import Enum
import heapq

from .clause import Clause, Literal


class ResolutionStatus(str, Enum):
    ENTAILED = "entailed"
    NOT_ENTAILED = "not_entailed"
    LIMIT_REACHED = "limit_reached"


@dataclass
class ResolutionStepRecord:
    step_number: int
    parent_1: Clause
    parent_2: Clause
    pivot: Literal
    resolvent: Clause


@dataclass
class ResolutionEngineResult:
    entailed: bool
    empty_clause_reached: bool
    status: ResolutionStatus
    steps: list[ResolutionStepRecord]
    clauses: list[Clause]


class ResolutionEngine:

    def run(
        self,
        clauses: list[Clause],
        support_ids: set[str],
        max_steps: int = 500,
    ) -> ResolutionEngineResult:

        if not support_ids:
            raise ValueError(
                "At least one support clause is required."
            )

        all_clauses = list(clauses)

        by_id = {
            clause.id: clause
            for clause in all_clauses
        }

        by_key = {
            clause.key(): clause
            for clause in all_clauses
        }

        # If the empty clause somehow already exists,
        # contradiction has already been reached.
        for clause in all_clauses:
            if not clause.literals:
                return ResolutionEngineResult(
                    entailed=True,
                    empty_clause_reached=True,
                    status=ResolutionStatus.ENTAILED,
                    steps=[],
                    clauses=all_clauses,
                )

        support_ids = set(support_ids)

        processed_pairs = set()

        steps: list[ResolutionStepRecord] = []

        candidate_heap = []

        serial_number = 0

        next_clause_number = self._next_clause_number(
            all_clauses
        )

        
        # Candidate generation

        def add_candidates(
            support_clause: Clause,
        ) -> None:

            nonlocal serial_number

            for other_clause in all_clauses:

                if support_clause.id == other_clause.id:
                    continue

                pivots = self._find_complementary_literals(
                    support_clause,
                    other_clause,
                )

                for pivot in pivots:

                    pair_key = (
                        tuple(
                            sorted(
                                (
                                    support_clause.id,
                                    other_clause.id,
                                )
                            )
                        ),
                        pivot.symbol,
                    )

                    if pair_key in processed_pairs:
                        continue

                    resolvent_literals = (
                        support_clause.literals
                        - {pivot}
                    ) | (
                        other_clause.literals
                        - {pivot.complement()}
                    )

                    resolvent_literals = frozenset(
                        resolvent_literals
                    )

                    # Clauses like A | ~A are tautologies
                    # and give us nothing useful.
                    if self._is_tautology(
                        resolvent_literals
                    ):
                        continue

                    # Heuristic:
                    # Prefer smaller resolvents.
                    #
                    # Also prefer resolvents whose literals have
                    # complementary unit clauses already present.
                    continuation_score = sum(
                        1
                        for literal in resolvent_literals
                        if frozenset(
                            {literal.complement()}
                        ) in by_key
                    )

                    serial_number += 1

                    heapq.heappush(
                        candidate_heap,
                        (
                            len(resolvent_literals),
                            -continuation_score,
                            len(other_clause.literals),
                            serial_number,
                            support_clause.id,
                            other_clause.id,
                            pivot,
                            resolvent_literals,
                            pair_key,
                        ),
                    )

        # Negated goal starts the search.
        for support_id in support_ids:
            support_clause = by_id[support_id]

            add_candidates(
                support_clause
            )

        # Resolution loop

        while candidate_heap:

            (
                _,
                _,
                _,
                _,
                support_id,
                other_id,
                pivot,
                resolvent_literals,
                pair_key,
            ) = heapq.heappop(candidate_heap)

            if pair_key in processed_pairs:
                continue

            processed_pairs.add(pair_key)

            support_clause = by_id[support_id]
            other_clause = by_id[other_id]

            if len(steps) >= max_steps:
                return ResolutionEngineResult(
                    entailed=False,
                    empty_clause_reached=False,
                    status=ResolutionStatus.LIMIT_REACHED,
                    steps=steps,
                    clauses=all_clauses,
                )

            # Does this exact clause already exist?
            existing_clause = by_key.get(
                resolvent_literals
            )

            if existing_clause is None:

                resolvent = Clause(
                    id=f"C{next_clause_number}",
                    literals=resolvent_literals,
                )

                next_clause_number += 1

                all_clauses.append(
                    resolvent
                )

                by_id[resolvent.id] = resolvent

                by_key[
                    resolvent_literals
                ] = resolvent

            else:
                resolvent = existing_clause

            step = ResolutionStepRecord(
                step_number=len(steps) + 1,
                parent_1=support_clause,
                parent_2=other_clause,
                pivot=pivot,
                resolvent=resolvent,
            )

            steps.append(step)

            # EMPTY CLAUS

            if not resolvent_literals:

                return ResolutionEngineResult(
                    entailed=True,
                    empty_clause_reached=True,
                    status=ResolutionStatus.ENTAILED,
                    steps=steps,
                    clauses=all_clauses,
                )

            # Every derived clause now belongs to our
            # set of support because it descended from
            # the negated goal.
            if resolvent.id not in support_ids:

                support_ids.add(
                    resolvent.id
                )

                add_candidates(
                    resolvent
                )

        # Nothing else can be derived.
        return ResolutionEngineResult(
            entailed=False,
            empty_clause_reached=False,
            status=ResolutionStatus.NOT_ENTAILED,
            steps=steps,
            clauses=all_clauses,
        )

    # Helper methods

    def _find_complementary_literals(
        self,
        clause_1: Clause,
        clause_2: Clause,
    ) -> list[Literal]:

        complementary = []

        for literal in clause_1.literals:

            if literal.complement() in clause_2.literals:

                complementary.append(
                    literal
                )

        return sorted(
            complementary,
            key=lambda literal: (
                literal.symbol,
                literal.negated,
            ),
        )

    def _is_tautology(
        self,
        literals: frozenset[Literal],
    ) -> bool:

        for literal in literals:

            if literal.complement() in literals:
                return True

        return False

    def _next_clause_number(
        self,
        clauses: list[Clause],
    ) -> int:

        numbers = []

        for clause in clauses:

            if (
                clause.id.startswith("C")
                and clause.id[1:].isdigit()
            ):
                numbers.append(
                    int(clause.id[1:])
                )

        return max(numbers, default=0) + 1