# ResViz current-version unit tests

This bundle contains automated tests written against the supplied current
ResViz source (`app.zip`). It is an overlay: copy the files and folders in this
bundle into the root of the current project, preserving the folder structure.

## Coverage by implemented backlog

| Backlog area | Test files |
|---|---|
| 1. Session Management | `tests/test_session_manager.py` |
| 2. Import / Export Project | `tests/test_project_import_export.py` |
| 3. Knowledge Base Choice screen | `src/components/KBChoiceView.test.tsx` |
| 4. Upload KB | `tests/test_knowledge_base_routes.py`, `src/types/validator.test.ts`, `src/components/KBInputView.test.tsx` |
| 5. Type in knowledge base | `tests/test_parser.py`, `tests/test_knowledge_base_routes.py`, `src/types/validator.test.ts`, `src/components/KBInputView.test.tsx` |
| Project Management and KB sidebar | `tests/test_project_management.py`, `src/components/KBChoiceView.test.tsx` |
| CNF Conversion | `tests/test_cnf_converter.py` |
| Resolution Algorithm and Steps | `tests/test_resolution_engine.py`, `src/components/ResolutionView.test.tsx` |
| Light / Dark Mode | `src/context/ThemeContext.test.tsx` |

## Run the backend tests

Install the application's backend dependencies if they are not already
installed, then run from the project root:

```text
python -m pip install -r requirements-test.txt
python run_tests.py
```

The runner supplies unit-test configuration values and does not require a
running Redis server. Redis operations are mocked.

## Run the frontend tests

From the project root:

```text
pnpm install
pnpm test
```

`npm install` followed by `npm test` can also be used if npm is the project's
package manager.

## Verified results on the supplied source

- Backend: 54 of 54 tests passed.
- Frontend: 40 tests passed and 1 test is recorded as an expected failure.
- Total executable checks: 95.

## Known current-version defects captured by the tests

1. The frontend file-size expression is `1024**1024`, which is exponentiation,
   not one megabyte. Therefore the intended oversized-file rejection test is
   marked with `it.fails`. After changing the implementation to `1024 ** 2`,
   change `it.fails` back to `it`.
2. The frontend accepts full-word propositions, while the current backend lexer
   reliably supports single-letter propositions. Backend tests therefore use
   formulas such as `A`, `B`, and `Q`.
3. The frontend currently states a 1 MB validation limit, while the backend and
   interface text use 5 MB. The team should select one limit and apply it
   consistently before final submission.
4. The frontend line-based-file validator currently splits on Windows CRLF
   (`\r\n`) only. Files containing LF-only line endings should be added as a
   regression case after the implementation uses `/\r?\n/`.

These are application issues discovered by the tests; the supplied application
source was not modified by this bundle.
