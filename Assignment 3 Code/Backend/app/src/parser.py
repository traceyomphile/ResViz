import re
import ply.yacc as yacc

from pydantic import (
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema

from app.src.lexer import tokens, lexer

ANNOTATION_PATTERN = re.compile(
    r"^\s*(?P<formula>.+?)\s*:\s*(?P<annotation>.+?)\s*$",
    re.DOTALL,
)
class Node:
    def __init__(self, label, left=None, right=None, annotation=None):
        self.label = label
        self.left = left
        self.right = right
        self.annotation = annotation

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

        if self.label in ("~", '¬'):
            return f"~{self.left}"

        left_part = str(self.left) if self.left is not None else ""
        right_part = str(self.right) if self.right is not None else ""

        # Normalise unicode operators to the ASCII representation
        operator = {
            '∧': '&',
            '∨': '|',
            '→': '->',
            '↔': '<->',
        }.get(self.label, self.label)

        return f"({left_part} {operator} {right_part})"

    def to_annotated_string(self):
        """Return the storage/API representation, including metadata."""
        formula = str(self)
        if not self.annotation:
            return formula
        escaped = self.annotation.replace('\\', '\\\\').replace('"', '\\"')
        return f'{formula}: "{escaped}"'

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
                cls._serialize,
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
                "A propositional logic formula. Proposition identifies may be "
                "single letters or descriptive names. An optional annotations may "
                "follow a colon."
            ),
            "examples": [
                "P",
                "~Student",
                "(P & Q)",
                "(Student -> Pass)",
                'Ad: "Student is admitted to the faculty"',
                '(Ad & Registered): "The student is admitted and registered"',
            ],
        }

    @classmethod
    def _serialize(cls, value):
        return value.to_annotated_string()
    
    @classmethod
    def _validate(cls, value):
        if isinstance(value, cls):
            return value

        if isinstance(value, str):
            formula_text, annotation = split_annotation(value)
            result = parser.parse(formula_text, lexer=lexer)

            if result is None or not isinstance(result, cls):
                raise ValueError(
                    f"Could not parse formula: {formula_text!r}"
                )
            result.annotation = annotation
            return result

        raise TypeError(
            f"Expected a formula string or Node instance, "
            f"got {type(value).__name__}"
        )

def split_annotation(value: str) -> tuple[str, str | None]:
    """
    Split an optional annotation from a propostional formulation.
    """
    value = value.strip()
    match = ANNOTATION_PATTERN.match(value)

    if not match:
        return value, None

    formula_text = match.group('formula').strip()
    annotation = match.group('annotation').strip()

    # Accept regular quotes and smart quotes copied from Word/Docs.
    quote_pairs = (("\"", "\""), ("'", "'"), ("“", "”"), ("‘", "’"))
    for opening, closing in quote_pairs:
        if (
            len(annotation) >= 2
            and annotation.startswith(opening)
            and annotation.endswith(closing)
        ):
            annotation = annotation[len(opening):-len(closing)].strip()
            break

    if not formula_text:
        raise ValueError('Formula cannot be empty before the annotation.')

    if not annotation:
        raise ValueError("Annotation cannot be empty after ':'")

    return formula_text, annotation

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
    p[0] = p[2]

def p_formula_atom(p):
    "formula : atom"
    p[0] = p[1]

def p_atom(p):
    "atom : IDENTIFIER"
    p[0] = Node(p[1])

def p_error(p):
    if p is None:
        raise ValueError('Syntax error: unexpected end of input')

    raise ValueError(
        f"Syntax error near {p.value!r} at position {p.lexpos}"
    )

parser = yacc.yacc(write_tables=False)
