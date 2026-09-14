import ply.lex as lex

# TOken names used by the parser.
tokens = (
	'IDENTIFIER',
	'CONJUCTION',
	'DISJUNCTION',
	'EQUIV',
	'NEGATION',
	'IMPLICATION',
	'LPAREN',
	'RPAREN',
)

# Operators. Both the ASCII forms and the common mathematical symbols. 
t_CONJUCTION    = r"&|∧"
t_NEGATION  = r'~|¬'
t_DISJUNCTION   = r'\||∨'
t_EQUIV   = r'<->|↔'
t_IMPLICATION = r'->|→'
t_LPAREN  = r'\('
t_RPAREN  = r'\)'
t_IDENTIFIER = r'[A-Za-z][A-Za-z0-9_]*' 

t_ignore  = ' \t'		# Spaces and tabs have no logical meaning.

def t_error(t):
	"""Raise an error upon invalid characters."""
	raise ValueError(
		f'Illegal character {t.value[0]!r} at position {t.lexpos}'
	)

lexer = lex.lex()

if __name__=='__main__':

	formula = input('prop. formula> ')
	lexer.input(formula)

	while True:
		tok = lexer.token()
		if not tok: 
			break
		print(tok)
