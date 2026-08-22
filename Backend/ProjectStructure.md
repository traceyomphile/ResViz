# ResViz Backend Project Structure

ResViz uses a **stateless FastAPI backend**. The frontend keeps the current project in React state or `sessionStorage`, so the backend does not require a database.

```text
resviz-backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── validation.py
│   │       ├── cnf_conversion.py
│   │       └── resolution.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── knowledge_base.py
│   │   ├── cnf.py
│   │   ├── resolution.py
│   │   └── error.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── validation_service.py
│   │   ├── cnf_service.py
│   │   └── resolution_service.py
│   ├── logic/
│   │   ├── __init__.py
│   │   ├── tokens.py
│   │   ├── tokenizer.py
│   │   ├── ast_nodes.py
│   │   ├── parser.py
│   │   ├── cnf_converter.py
│   │   ├── clause.py
│   │   ├── pair_selector.py
│   │   └── resolution_engine.py
│   ├── exceptions/
│   │   ├── __init__.py
│   │   ├── logic_exceptions.py
│   │   └── handlers.py
│   └── utils/
│       ├── __init__.py
│       └── file_reader.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   │   ├── test_tokenizer.py
│   │   ├── test_parser.py
│   │   ├── test_cnf_converter.py
│   │   └── test_resolution_engine.py
│   └── integration/
│       ├── test_validation_api.py
│       ├── test_cnf_api.py
│       └── test_resolution_api.py
├── .env.example
├── .gitignore
├── pyproject.toml
├── README.md
└── Dockerfile
```

## Application Files

### `app/main.py`

- Creates the FastAPI application, configures CORS and registers the API router.

### `app/config.py`

- Contains settings such as allowed frontend origins and upload-size limits.

### `__init__.py`

- Marks a directory as a Python package. These files can remain empty initially.

### API Route Files

Route files receive HTTP requests, call services and return responses. They should contain very little business logic.

#### `api/router.py`

- Combines all route modules under the `/api` prefix.

#### `api/routes/validation.py`

- Checks whether submitted knowledge-base and query formulas are valid.

#### `api/routes/cnf_conversion.py`

- Accepts formulas and returns their step-by-step CNF conversion.

#### `api/routes/resolution.py`

- Runs resolution and returns every step and the final entailment result.

### Schema Classes

Schemas are Pydantic classes defining the JSON accepted and returned by the API.

#### `schemas/knowledge_base.py`

- `KnowledgeBaseInput` — contains the user's knowledge-base formulas.
- `QueryInput` — contains the formula the user wants to prove.
- `ValidationRequest` — contains the formulas that must be validated.
- `FormulaValidationResult` — gives the validity and possible syntax error of one formula.
- `ValidationResponse` — returns validation results for all formulas.

#### `schemas/cnf.py`

- `CNFConversionRequest` — contains the knowledge base and query to convert.
- `CNFStep` — represents one conversion rule, its input and its output.
- `CNFClause` — represents one final CNF clause and its identifier.
- `CNFConversionResponse` — returns all conversion steps and final clauses.

#### `schemas/resolution.py`

- `LiteralSchema` — represents one positive or negative propositional literal.
- `ClauseSchema` — represents a clause containing one or more literals.
- `ResolutionRequest` — contains the clauses and query needed for resolution.
- `ResolutionStep` — contains two parent clauses, complementary literals and their resolvent.
- `ResolutionResult` — states whether the empty clause was reached and the query is entailed.
- `ResolutionResponse` — returns all resolution steps and the final result.

#### `schemas/error.py`

- `ErrorDetail` — describes one error and its location.
- `ErrorResponse` — provides a consistent error response to the frontend.

### Service Classes

Services connect API routes to the logic engine without depending on HTTP details.

#### `services/validation_service.py`

- `ValidationService` — uses the tokenizer and parser to validate formulas and produce readable feedback.

#### `services/cnf_service.py`

- `CNFService` — parses formulas, negates the query and produces CNF conversion steps.

#### `services/resolution_service.py`

- `ResolutionService` — prepares clauses, runs the resolution engine and formats the result.

### Logic Classes

The logic package contains the actual propositional-logic implementation. It does not depend on FastAPI.

#### `logic/tokens.py`

- `TokenType` — lists token types such as variable, negation, conjunction and implication.
- `Token` — stores a token's type, value and position in the formula.

#### `logic/tokenizer.py`

- `Tokenizer` — converts formula text into tokens for the parser.

#### `logic/ast_nodes.py`

- `ASTNode` — base class for all syntax-tree nodes.
- `VariableNode` — represents a propositional variable such as `P`.
- `NotNode` — represents the negation of an expression.
- `AndNode` — represents a conjunction of two expressions.
- `OrNode` — represents a disjunction of two expressions.
- `ImpliesNode` — represents an implication between two expressions.
- `BiconditionalNode` — represents a biconditional between two expressions.

#### `logic/parser.py`

- `Parser` — checks the token sequence against the grammar and builds a syntax tree.

#### `logic/cnf_converter.py`

- `CNFRule` — lists rules such as implication removal and De Morgan's law.
- `ConversionStep` — records the rule and the expression before and after its application.
- `CNFConversionResult` — contains the final clauses and all conversion steps.
- `CNFConverter` — transforms a syntax tree into conjunctive normal form.

#### `logic/clause.py`

- `Literal` — represents a variable and whether it is negated.
- `Clause` — stores a set of literals joined by disjunction.
- `ClausePair` — stores two clauses selected as resolution parents.

#### `logic/pair_selector.py`

- `PairSelector` — selects unresolved clause pairs containing complementary literals.
- `GoalDirectedPairSelector` — prioritises pairs related to the user's query.

#### `logic/resolution_engine.py`

- `ResolutionStatus` — represents outcomes such as entailed, not entailed or limit reached.
- `ResolutionStepRecord` — records parent clauses, complementary literals and the resolvent.
- `ResolutionEngineResult` — stores all steps, the final status and empty-clause result.
- `ResolutionEngine` — resolves clause pairs until it finds the empty clause or no new clause can be produced.

### Exception Classes

#### `exceptions/logic_exceptions.py`

- `LogicError` — base exception for logic-engine errors.
- `TokenizationError` — reports an unknown character or operator.
- `FormulaSyntaxError` — reports an invalid formula structure.
- `CNFConversionError` — reports a failed CNF conversion.
- `ResolutionError` — reports a failed resolution process.

#### `exceptions/handlers.py`

- Contains FastAPI handler functions that turn internal exceptions into clear HTTP error responses.

### Utility Classes

#### `utils/file_reader.py`

- `KnowledgeBaseFileReader` — reads an uploaded text file, checks its size and extracts formulas.

- The uploaded file is processed only for the current request and is not stored permanently.

### Test Files

#### `tests/conftest.py`

- Provides shared test objects such as a FastAPI test client and example formulas.

#### Unit tests

- `test_tokenizer.py` — tests formula tokenisation.
- `test_parser.py` — tests syntax checking and syntax-tree construction.
- `test_cnf_converter.py` — tests CNF rules and recorded steps.
- `test_resolution_engine.py` — tests pair selection, resolvents and empty-clause detection.

#### Integration tests

- `test_validation_api.py` — tests validation requests and errors.
- `test_cnf_api.py` — tests complete CNF-conversion requests.
- `test_resolution_api.py` — tests complete resolution requests and results.

## Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/validate` | Validates knowledge-base and query formulas. |
| `POST` | `/api/cnf-conversion` | Converts the knowledge base and negated query into CNF. |
| `POST` | `/api/resolution` | Runs resolution and returns its steps and result. |

The frontend sends the complete required state with each request. The backend processes it and returns a result without saving it.

## Request Flow

```text
Frontend session state
    -> API route
    -> Service class
    -> Logic classes
    -> Response schema
    -> Frontend session state
```

## Session Responsibility

The frontend stores the temporary project name, knowledge base, uploaded file contents, query, CNF steps, resolution steps and final result.

Use React state if refreshing should erase everything. Use `sessionStorage` if refreshing should preserve the work while closing the tab should normally remove it.

The backend therefore does not need database models, repositories, SQLAlchemy, migrations, project CRUD endpoints or server-side sessions.
