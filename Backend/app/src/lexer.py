import ply.lex as lex

tokens = (
	'LETTER',
	'CONJUCTION',
	'DISJUNCTION',
	'EQUIV',
	'NEGATION',
	'IMPLICATION',
	'LPAREN',
	'RPAREN',
)

t_CONJUCTION    = r'\&'
t_NEGATION  = r'\~'
t_DISJUNCTION   = r'\|'
t_EQUIV   = r'<->'
t_IMPLICATION = '->'
t_LPAREN  = r'\('
t_RPAREN  = r'\)'

def t_LETTER(t):
	r'(\d\-)*[a-zA-Z](\d,\d)*'
	return t

t_ignore  = ' \t'

def t_error(t):
	print("Illegal character '%s'" % t.value[0])
	t.lexer.skip(1)

lexer = lex.lex()

if __name__=='__main__':

	formula = input('prop. formula> ')
	lexer.input(formula)

	while True:
		tok = lexer.token()
		if not tok: 
			break
		print(tok)
