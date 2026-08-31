import ply.yacc as yacc

from pydantic import (
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema

from app.src.lexer import tokens, lexer


class Node:
    def __init__(self, label, left=None, right=None):
        self.label = label
        self.left = left
        self.right = right

    def is_true(self):
        return self.truth

    def get_max_depth(self):
        left_max_depth = 0
        right_max_depth = 0

        if self.left:
            left_max_depth = self.left.get_max_depth()

        if self.right:
            right_max_depth = self.right.get_max_depth()

        return 1 + max(left_max_depth, right_max_depth)

    def __str__(self):
        if self.left is None and self.right is None:
            return str(self.label)

        if self.label == "~":
            return f"~{self.left}"

        left_part = str(self.left) if self.left is not None else ""
        right_part = str(self.right) if self.right is not None else ""

        return f"({left_part} {self.label} {right_part})"

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        source_type,
        handler: GetCoreSchemaHandler,
    ):
        """
        Tell Pydantic how to validate and serialize Node values.
        """

        return core_schema.no_info_plain_validator_function(
            cls._validate,
            serialization=core_schema.plain_serializer_function_ser_schema(
                str,
                return_schema=core_schema.str_schema(),
            ),
            json_schema_input_schema=core_schema.str_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls,
        core_schema_value: core_schema.CoreSchema,
        handler: GetJsonSchemaHandler,
    ) -> JsonSchemaValue:
        """
        Represent Node values as formula strings in OpenAPI.
        """

        return {
            "type": "string",
            "title": "Propositional formula",
            "description": (
                "A propositional logic formula, for example "
                "'P', '~P', '(P & Q)', or '(P -> Q)'."
            ),
            "examples": [
                "P",
                "~P",
                "(P & Q)",
                "(P -> Q)",
            ],
        }

    @classmethod
    def _validate(cls, value):
        if isinstance(value, cls):
            return value

        if isinstance(value, str):
            result = parser.parse(value, lexer=lexer)

            if result is None:
                raise ValueError(
                    f"Could not parse formula: {value!r}"
                )

            return result

        raise TypeError(
            f"Expected a formula string or Node instance, "
            f"got {type(value).__name__}"
        )


def p_binary_formula(p):
    """
    formula : LPAREN formula CONJUCTION formula RPAREN
            | LPAREN formula DISJUNCTION formula RPAREN
            | LPAREN formula IMPLICATION formula RPAREN
            | LPAREN formula EQUIV formula RPAREN
    """

    p[0] = Node(p[3], p[2], p[4])


def p_parenthesised_negation(p):
    "formula : LPAREN NEGATION formula RPAREN"

    p[0] = Node(p[2], p[3])


def p_negation(p):
    "formula : NEGATION formula"

    p[0] = Node(p[1], p[2])

def p_paranthesised_formula(p):
    "formula : LPAREN atom RPAREN"
    p[0] = [2]

def p_formula_atom(p):
    "formula : atom"

    p[0] = p[1]


def p_atom(p):
    "atom : LETTER"

    p[0] = Node(p[1])


def p_error(p):
    if p is None:
        print("Syntax error: unexpected end of input")
    else:
        print(
            f"Syntax error near {p.value!r} "
            f"at position {p.lexpos}"
        )


parser = yacc.yacc(write_tables=False)