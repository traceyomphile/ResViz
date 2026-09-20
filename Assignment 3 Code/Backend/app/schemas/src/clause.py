from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class Literal:
    symbol: str
    negated: bool = False

    def complement(self) -> "Literal":
        return Literal(
            symbol=self.symbol,
            negated=not self.negated,
        )

    def __str__(self) -> str:
        if self.negated:
            return f"~{self.symbol}"

        return self.symbol


@dataclass
class Clause:
    id: str
    literals: frozenset[Literal]
    source_formula: str | None = None

    def key(self) -> frozenset[Literal]:
        return self.literals

    @property
    def expression(self) -> str:
        if not self.literals:
            return "□"

        ordered = sorted(
            self.literals,
            key=lambda literal: (
                literal.symbol,
                literal.negated,
            ),
        )

        return " | ".join(str(literal) for literal in ordered)

    def __str__(self) -> str:
        return self.expression