import ply.yacc as yacc
from app.src.lexer import tokens
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema

class Node(object):
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

	def __str__(self): #Note: please feel free to modify this since it include way to many braces at the moment
		if self.left is None and self.right is None:
			return '(' + str(self.label) + ')'

		if self.label == '~':
			return f"~{str(self.left)}"

		left_part = str(self.left) if self.left is not None else ""
		right_part = str(self.right) if self.right is not None else ""
		
		return f"({left_part} {self.label} {right_part})"

	@classmethod
	def __get_pydantic_core_schema(cls, source_type, handler: GetCoreSchemaHandler):
		return core_schema.no_info_plain_validator_function(
			cls._validate,
			serialization=core_schema.plain_serializer_function_ser_schema(str)
		)

	@classmethod
	def _validate(cls, value):
		if isinstance(value, cls):
			return value
		raise TypeError(f'Expected Node instance, got {type(value)}')

def p_binary_conju(p):
	'''formula : LPAREN formula CONJUCTION formula RPAREN
	formula : LPAREN formula DISJUNCTION formula RPAREN
	formula : LPAREN formula IMPLICATION formula RPAREN
	formula : LPAREN formula EQUIV formula RPAREN
	'''
	p[0] = Node(p[3], p[2], p[4])
	return p

def p_atom_neg0(p):
	'formula : LPAREN NEGATION formula RPAREN'
	p[0] = Node(p[2],p[3])
	return p

def p_atom_neg1(p):
	'formula : NEGATION formula'
	p[0] = Node(p[1], p[2])
	return p	

def p_atom_atom(p):
	'formula : atom'
	p[0] = p[1]
	return p

def p_atom(p):
	'atom : LETTER'
	p[0] = Node(p[1])
	return p

def p_error(p):
	print("Syntax error in input!", p)

parser = yacc.yacc()
