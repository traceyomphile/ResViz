# ResViz Project Structure

This repository contains a full-stack propositional logic assistant built around a FastAPI backend, a Vite + React frontend, and a Redis-backed session/project data store. The project is currently implemented as a working end-to-end app for project management, knowledge-base editing, CNF conversion, and resolution proof execution.

The repository root is the current workspace folder itself. The layout below reflects the actual code that exists in the project right now.

```text
resviz/
├── .git/
├── .gitignore
├── Makefile
├── README.md
├── ProjectStructure.md
├── endpoints.md
├── lexer.py
├── backend/
│   ├── .env
│   ├── .venv/
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── router.py
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── conversion.py
│   │   │       ├── health.py
│   │   │       ├── knowledge_base.py
│   │   │       ├── project.py
│   │   │       └── session.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── knowledge_base.py
│   │   │   ├── project.py
│   │   │   └── session.py
│   │   ├── services/
│   │   │   ├── ProjectManager.py
│   │   │   └── SessionManager.py
│   │   └── src/
│   │       ├── __init__.py
│   │       ├── clause.py
│   │       ├── cnf_converter.py
│   │       ├── lexer.py
│   │       ├── parser.py
│   │       ├── parser.out
│   │       ├── parsetab.py
│   │       └── resolution_engine.py
│   └── tests/
│       ├── run_tests.py
│       ├── TEST_REPORT.md
│       ├── test_cnf_converter.py
│       ├── test_parser.py
│       ├── test_project_reasoning.py
│       ├── test_resolution_engine.py
│       └── test_session_manager.py
├── frontend/
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── public/
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.css
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts
│       │   ├── knowledgeBase.ts
│       │   ├── projects.ts
│       │   └── session.ts
│       ├── components/
│       │   ├── FileUpload.tsx
│       │   ├── KBChoiceView.css
│       │   ├── KBChoiceView.tsx
│       │   ├── KBInputView.css
│       │   ├── KBInputView.tsx
│       │   ├── ProjectView.css
│       │   ├── ProjectView.tsx
│       │   ├── ResolutionView.css
│       │   ├── ResolutionView.tsx
│       │   ├── SplashScreen.css
│       │   ├── SplashScreen.tsx
│       │   ├── TopBar.css
│       │   └── TopBar.tsx
│       ├── context/
│       │   └── ThemeContext.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── theme.css
│       ├── types.ts
│       └── types/
│           ├── session.ts
│           └── validator.ts
├── diagrams/
├── forms/
└── ...
```

---

## Backend structure

### App bootstrap

- `backend/app/main.py` — creates the FastAPI application and configures CORS for the frontend.
- `backend/app/config.py` — loads environment settings and determines Redis/session configuration.
- `backend/app/api/router.py` — mounts the API routers for health, session, project, KB, and conversion logic.

### API routes

- `backend/app/api/routes/health.py` — lightweight health endpoint.
- `backend/app/api/routes/session.py` — creates/restores tab-scoped sessions and deletes sessions.
- `backend/app/api/routes/project.py` — CRUD, import/export, and session-protected project access.
- `backend/app/api/routes/knowledge_base.py` — typed upload, validation, saved KB entries, and query persistence.
- `backend/app/api/routes/conversion.py` — CNF conversion and resolution engine integration.

### Persistence layer

- `backend/app/services/SessionManager.py` — issues stable session IDs from the tab ID and stores user sessions in Redis.
- `backend/app/services/ProjectManager.py` — manages project storage and invalidates derived reasoning when KB or goal changes.

### Schemas

- `backend/app/schemas/session.py` — session response schema.
- `backend/app/schemas/project.py` — project schema including `knowledge_base`, `knowledge_bases`, CNF state, and resolution fields.
- `backend/app/schemas/knowledge_base.py` — knowledge-base payloads, validation models, and saved KB entry models.

### Logic engine

The core reasoning implementation is active and not just placeholder code:

- `backend/app/src/lexer.py` — tokenization for propositional syntax
- `backend/app/src/parser.py` — parser for logic formulas
- `backend/app/src/cnf_converter.py` — CNF conversion logic and step tracking
- `backend/app/src/clause.py` — clause and literal representation
- `backend/app/src/resolution_engine.py` — entailment resolution logic

---

## Frontend structure

### Core app flow

- `frontend/src/App.tsx` — main screen flow for splash → project selection → KB choice → input → CNF conversion → resolution.
- `frontend/src/main.tsx` — app bootstrap.

### API layer

- `frontend/src/api/session.ts` — session restoration and deletion using `X-Tab-ID` and `X-Session-ID`.
- `frontend/src/api/projects.ts` — project list/create/import/export helpers.
- `frontend/src/api/knowledgeBase.ts` — KB validation, upload, save, CNF conversion, and query/resolution calls.
- `frontend/src/api/client.ts` — fetch wrapper used by other frontend code.

### Components

- `frontend/src/components/SplashScreen.tsx` — startup splash screen
- `frontend/src/components/ProjectView.tsx` — create/open/import projects
- `frontend/src/components/KBChoiceView.tsx` — choose input method and saved KBs
- `frontend/src/components/KBInputView.tsx` — typed or uploaded formula input and saved-KB workflow
- `frontend/src/components/ResolutionView.tsx` — CNF completion and proof resolution display
- `frontend/src/components/TopBar.tsx` — navigation and app shell bar
- `frontend/src/components/FileUpload.tsx` — upload UI for KB files

### Types and context

- `frontend/src/types.ts` — shared frontend types like input method and KB data
- `frontend/src/types/session.ts` — session response typing
- `frontend/src/types/validator.ts` — validation type definitions
- `frontend/src/context/ThemeContext.tsx` — theme context provider

---

## Runtime behavior and responsibilities

### Session model

A browser tab gets a tab ID in `sessionStorage`, and the backend derives a stable `session_id` from the tab ID. The session is stored in Redis with a TTL and refreshed on requests.

### Project model

A project contains:

- `project_id`
- `name`
- `description`
- `knowledge_base`
- `knowledge_bases`
- `cnf_kb`
- `cnf_steps`
- `goal`
- `status`
- `resolution_result`

The project manager invalidates derived reasoning state whenever formulas or the goal change, clearing CNF conversion and resolution state before saving new data.

### Knowledge-base workflow

The app supports:

- typed formula entry
- uploaded `.json`, `.txt`, or `.kb` files
- saving named KB snapshots per project
- selecting and activating named KBs from the sidebar
- validation before conversion

### CNF and proof workflow

The app converts active formulas and the negated goal to CNF, then runs resolution proving whether the query is entailed. Each conversion and resolution step is persisted and returned by the backend for UI rendering.

---

## Operational notes

- Redis is a required runtime dependency for the backend.
- The backend is configured to allow local frontend origins via `FRONTEND_URLS` in `backend/app/config.py`.
- The `.env` file lives in `backend/.env` and contains the session secret and Redis URL.
- The backend is started with Uvicorn and the frontend with Vite.
- The project includes a `Makefile` for the most common local commands.

---

## Current project status

The repository is currently a functioning prototype with the following active behaviors:

- session creation and restoration
- project list/create/import/export/delete
- knowledge-base save/validation/upload
- named KB library support
- goal persistence
- CNF conversion and step tracking
- resolution proof execution and result reporting

This means the structure and implementation are consistent with a real, working logic reasoning application rather than a purely scaffolded starter project.
