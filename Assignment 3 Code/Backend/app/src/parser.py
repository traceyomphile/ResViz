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

    def is_leaf(self):
        """Return whether this node is an atomic proposition."""
        return self.left is None and self.right is None

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
            normalised = (value.strip().replace("↔", "<->").replace("→", "->")
                          .replace("¬", "~").replace("∧", "&").replace("∨", "|"))
            result = parser.parse(normalised, lexer=lexer)

            if result is None or not isinstance(result, cls):
                raise ValueError(
                    f"Could not parse formula: {value!r}"
                )

            return result

        raise TypeError(
            f"Expected a formula string or Node instance, "
            f"got {type(value).__name__}"
        )


# Standard propositional precedence. Implication associates to the right.
precedence = (
    ('left', 'EQUIV'),
    ('right', 'IMPLICATION'),
    ('left', 'DISJUNCTION'),
    ('left', 'CONJUCTION'),
    ('right', 'NEGATION'),
)

def p_binary_formula(p):
    """formula : formula CONJUCTION formula
               | formula DISJUNCTION formula
               | formula IMPLICATION formula
               | formula EQUIV formula"""
    p[0] = Node(p[2], p[1], p[3])

def p_group(p):
    "formula : LPAREN formula RPAREN"
    p[0] = p[2]

def p_negation(p):
    "formula : NEGATION formula"
    p[0] = Node(p[1], p[2])

def p_formula_atom(p):
    "formula : LETTER"
    p[0] = Node(p[1])

def p_error(p):
    if p is None:
        raise ValueError("Syntax error: unexpected end of input")
    raise ValueError(f"Syntax error near {p.value!r} at position {p.lexpos + 1}")

parser = yacc.yacc(write_tables=False, debug=False)
