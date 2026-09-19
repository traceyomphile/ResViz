"""Finite resolution closure, with every pair/pivot outcome and proof search."""
from collections import deque
from dataclasses import dataclass
import time

from .clause import Clause


@dataclass
class PairOutcome:
    id: str
    parent_1: str
    parent_2: str
    pivot: str | None
    result_id: str | None
    expression: str
    kind: str
    reason: str
    depth: int


@dataclass
class FullResolutionGraph:
    clauses: list[Clause]
    branches: list[PairOutcome]
    complete: bool
    limit_reason: str | None
    pairs_examined: int
    pending_pairs: int
    shortest_proof: list[str]
    shortest_is_optimal: bool
    entailed: bool


class FullResolutionEngine:
    def run(self, source, max_pairs=3000, max_clauses=160, max_branches=5000,
            max_proof_states=20000, proof_seconds=1.5):
        # A clause is expanded once; equivalent alternative derivations are
        # retained as references rather than expanded into infinite cycles.
        clauses = list(source)
        by_key = {}
        for clause in clauses:
            by_key.setdefault(clause.key(), clause)
        depths = {clause.id: 0 for clause in clauses}
        first_derivation = {}
        pairs = deque((a, b) for i, a in enumerate(clauses)
                      for b in clauses[i + 1:] if a.literals and b.literals)
        number = max((int(c.id[1:]) for c in clauses if c.id.startswith('C') and c.id[1:].isdigit()), default=0) + 1
        branches = []
        examined = 0
        reason = None
        while pairs:
            if examined >= max_pairs or len(branches) >= max_branches:
                reason = 'The pair display limit was reached. Unexplored pairs remain; this is a partial graph.'
                break
            a, b = pairs.popleft()
            examined += 1
            pivots = sorted((literal for literal in a.literals if literal.complement() in b.literals),
                            key=lambda literal: (literal.symbol, literal.negated))
            depth = max(depths[a.id], depths[b.id]) + 1
            if not pivots:
                branches.append(PairOutcome(f'R{len(branches) + 1}', a.id, b.id, None, None,
                                            '', 'dead_end', 'No complementary literals: this pair cannot resolve.', depth))
                continue
            for pivot in pivots:
                if len(branches) >= max_branches:
                    reason = 'The pair display limit was reached. Unexplored pivots remain; this is a partial graph.'
                    break
                literals = (a.literals - {pivot}) | (b.literals - {pivot.complement()})
                expression = Clause('', literals).expression
                branch_id = f'R{len(branches) + 1}'
                if any(literal.complement() in literals for literal in literals):
                    branches.append(PairOutcome(branch_id, a.id, b.id, pivot.symbol, None,
                                                expression, 'tautology', 'Tautology: the result contains a literal and its negation. This branch is not expanded.', depth))
                    continue
                result = by_key.get(literals)
                if result is None:
                    if len(clauses) >= max_clauses:
                        reason = 'The clause limit was reached. Unexplored derivations remain; this is a partial graph.'
                        break
                    result = Clause(f'C{number}', literals)
                    number += 1
                    by_key[literals] = result
                    depths[result.id] = depth
                    first_derivation[result.id] = branch_id
                    if literals:
                        pairs.extend((other, result) for other in clauses if other.literals)
                    clauses.append(result)
                    kind = 'derived'
                    explanation = 'Empty clause: contradiction proved.' if not literals else 'New clause; all its pairings are explored below.'
                else:
                    kind = 'existing'
                    explanation = 'Alternative derivation of an existing clause. Continue from the shared clause; it is not expanded twice.'
                branches.append(PairOutcome(branch_id, a.id, b.id, pivot.symbol, result.id,
                                            expression, kind, explanation, depth))
            if reason:
                break
        complete = reason is None
        empty = next((c for c in clauses if not c.literals), None)
        proof = []
        optimal = complete
        if empty:
            branch_by_id = {b.id: b for b in branches}
            included = set()
            def collect(clause_id):
                branch_id = first_derivation.get(clause_id)
                if not branch_id or branch_id in included:
                    return
                branch = branch_by_id[branch_id]
                collect(branch.parent_1)
                collect(branch.parent_2)
                included.add(branch_id)
            collect(empty.id)
            fallback = [b.id for b in branches if b.id in included]
            proof, verified = self._shortest(clauses, source, branches, empty.id,
                                              fallback, max_proof_states, proof_seconds)
            optimal = complete and verified
        return FullResolutionGraph(clauses, branches, complete, reason, examined,
                                   len(pairs) + (1 if reason else 0), proof, optimal, empty is not None)

    @staticmethod
    def _shortest(clauses, source, branches, target, fallback, max_states, seconds):
        # Breadth-first search over available-clause sets minimizes the number
        # of inferences, accounting for shared subproofs. Tree height or a
        # priority-queue score would not establish the shortest proof.
        bit = {clause.id: 1 << i for i, clause in enumerate(clauses)}
        initial = 0
        for clause in source:
            initial |= bit[clause.id]
        goal = bit[target]
        if initial & goal:
            return [], True
        transitions = [(bit[b.parent_1] | bit[b.parent_2], bit[b.result_id], b.id)
                       for b in branches if b.result_id and b.kind in ('derived', 'existing')]
        queue = deque([(initial, 0)])
        history = {initial: None}
        deadline = time.monotonic() + seconds
        while queue:
            state, depth = queue.popleft()
            if depth >= len(fallback) - 1:
                # All proofs strictly shorter than the known proof have been
                # explored. The fallback is therefore also an exact optimum.
                return fallback, True
            if time.monotonic() >= deadline:
                return fallback, False
            for required, result, branch in transitions:
                if state & required != required or state & result:
                    continue
                following = state | result
                if following in history:
                    continue
                history[following] = (state, branch)
                if following & goal:
                    proof = []
                    while history[following] is not None:
                        following, chosen = history[following]
                        proof.append(chosen)
                    return list(reversed(proof)), True
                if len(history) >= max_states:
                    return fallback, False
                queue.append((following, depth + 1))
        return fallback, True
