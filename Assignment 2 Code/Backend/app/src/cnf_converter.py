from dataclasses import dataclass

from .clause import Literal
from .parser import Node


@dataclass
class ConversionStep:
    step_number: int
    original_expression: str
    rule: str
    rule_description: str
    result_expression: str


@dataclass
class CNFConversionResult:
    final_expression: str
    steps: list[ConversionStep]
    clauses: list[frozenset[Literal]]


class CNFConverter:
    RULE_DESCRIPTIONS = {
        "remove_biconditional":
            "Replace A <-> B with (A -> B) & (B -> A).",

        "remove_implication":
            "Replace A -> B with ~A | B.",

        "double_negation":
            "Replace ~~A with A.",

        "de_morgan":
            "Push negation inward using De Morgan's law.",

        "distribute_or_over_and":
            "Distribute OR over AND.",
    }

    def convert(self, root: Node) -> CNFConversionResult:
        steps: list[ConversionStep] = []

        current = root

        # 1. Remove biconditionals.
        current, _ = self._apply_until_stable(
            current,
            self._rewrite_biconditional,
            "remove_biconditional",
            steps,
        )

        # 2. Remove implications.
        current, _ = self._apply_until_stable(
            current,
            self._rewrite_implication,
            "remove_implication",
            steps,
        )

        # 3. Push all negations down to literals.
        while True:
            current, double_changed = self._apply_until_stable(
                current,
                self._rewrite_double_negation,
                "double_negation",
                steps,
            )

            current, de_morgan_changed = self._apply_until_stable(
                current,
                self._rewrite_de_morgan,
                "de_morgan",
                steps,
            )

            if not double_changed and not de_morgan_changed:
                break

        # 4. Distribute OR over AND.
        current, _ = self._apply_until_stable(
            current,
            self._rewrite_distribution,
            "distribute_or_over_and",
            steps,
        )

        clauses = self.to_clauses(current)

        return CNFConversionResult(
            final_expression=str(current),
            steps=steps,
            clauses=clauses,
        )

    

    def _apply_until_stable(
        self,
        root: Node,
        rewrite_function,
        rule_name: str,
        steps: list[ConversionStep],
    ) -> tuple[Node, bool]:

        current = root
        changed_at_least_once = False

        while True:
            before = str(current)

            current, changed = self._rewrite_first(
                current,
                rewrite_function,
            )

            if not changed:
                break

            changed_at_least_once = True

            steps.append(
                ConversionStep(
                    step_number=len(steps) + 1,
                    original_expression=before,
                    rule=rule_name,
                    rule_description=self.RULE_DESCRIPTIONS[
                        rule_name
                    ],
                    result_expression=str(current),
                )
            )

        return current, changed_at_least_once

    def _rewrite_first(
        self,
        node: Node,
        rewrite_function,
    ) -> tuple[Node, bool]:

        replacement = rewrite_function(node)

        if replacement is not None:
            return replacement, True

        if node.left is not None:
            new_left, changed = self._rewrite_first(
                node.left,
                rewrite_function,
            )

            if changed:
                return (
                    Node(
                        node.label,
                        new_left,
                        node.right,
                    ),
                    True,
                )

        if node.right is not None:
            new_right, changed = self._rewrite_first(
                node.right,
                rewrite_function,
            )

            if changed:
                return (
                    Node(
                        node.label,
                        node.left,
                        new_right,
                    ),
                    True,
                )

        return node, False

    
    # CNF rules

    def _rewrite_biconditional(
        self,
        node: Node,
    ) -> Node | None:

        if node.label != "<->":
            return None

        a = node.left
        b = node.right

        # A <-> B
        #
        # becomes
        #
        # (A -> B) & (B -> A)

        return Node(
            "&",
            Node("->", a, b),
            Node("->", b, a),
        )

    def _rewrite_implication(
        self,
        node: Node,
    ) -> Node | None:

        if node.label != "->":
            return None

        # A -> B
        #
        # becomes
        #
        # ~A | B

        return Node(
            "|",
            Node("~", node.left),
            node.right,
        )

    def _rewrite_double_negation(
        self,
        node: Node,
    ) -> Node | None:

        if (
            node.label == "~"
            and node.left is not None
            and node.left.label == "~"
        ):
            # ~~A -> A
            return node.left.left

        return None

    def _rewrite_de_morgan(
        self,
        node: Node,
    ) -> Node | None:

        if node.label != "~" or node.left is None:
            return None

        child = node.left

        # ~(A & B) -> ~A | ~B
        if child.label == "&":
            return Node(
                "|",
                Node("~", child.left),
                Node("~", child.right),
            )

        # ~(A | B) -> ~A & ~B
        if child.label == "|":
            return Node(
                "&",
                Node("~", child.left),
                Node("~", child.right),
            )

        return None

    def _rewrite_distribution(
        self,
        node: Node,
    ) -> Node | None:

        if node.label != "|":
            return None

        left = node.left
        right = node.right

        # (A & B) | C
        #
        # becomes
        #
        # (A | C) & (B | C)

        if left is not None and left.label == "&":
            return Node(
                "&",
                Node("|", left.left, right),
                Node("|", left.right, right),
            )

        # A | (B & C)
        #
        # becomes
        #
        # (A | B) & (A | C)

        if right is not None and right.label == "&":
            return Node(
                "&",
                Node("|", left, right.left),
                Node("|", left, right.right),
            )

        return None

    # Convert final CNF tree into actual clauses

    def to_clauses(
        self,
        root: Node,
    ) -> list[frozenset[Literal]]:

        clause_nodes: list[Node] = []

        self._split_conjunction(
            root,
            clause_nodes,
        )

        clauses: list[frozenset[Literal]] = []

        for clause_node in clause_nodes:
            literals: list[Literal] = []

            self._collect_literals(
                clause_node,
                literals,
            )

            clauses.append(
                frozenset(literals)
            )

        # Remove duplicated clauses while preserving order.
        unique: list[frozenset[Literal]] = []
        seen: set[frozenset[Literal]] = set()

        for clause in clauses:
            if clause not in seen:
                seen.add(clause)
                unique.append(clause)

        return unique

    def _split_conjunction(
        self,
        node: Node,
        output: list[Node],
    ) -> None:

        if node.label == "&":
            self._split_conjunction(
                node.left,
                output,
            )

            self._split_conjunction(
                node.right,
                output,
            )

            return

        output.append(node)

    def _collect_literals(
        self,
        node: Node,
        output: list[Literal],
    ) -> None:

        # A | B | C
        if node.label == "|":
            self._collect_literals(
                node.left,
                output,
            )

            self._collect_literals(
                node.right,
                output,
            )

            return

        # ~A
        if (
            node.label == "~"
            and node.left is not None
            and node.left.is_leaf()
        ):
            output.append(
                Literal(
                    symbol=str(node.left.label),
                    negated=True,
                )
            )

            return

        # A
        if node.is_leaf():
            output.append(
                Literal(
                    symbol=str(node.label),
                    negated=False,
                )
            )

            return

        raise ValueError(
            f"Expression is not in CNF: {node}"
        )