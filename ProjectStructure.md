# ResViz Project Structure

This project is organized into a FastAPI backend, a Vite + React frontend, and supporting assets for the knowledge-base / project workflow. The current codebase is centered around session management and project persistence, with the logical reasoning engine stored under the backend application source tree.

There is no separate "ResViz" folder inside this repository. The repository root is the current workspace folder itself, and the tree below starts from that root.

```text
.
├── backend/
│   ├── .env
│   ├── .gitkeep
│   ├── requirements.txt
│   ├── endpoints.md
│   ├── ProjectStructure.md
│   └── app/
│       ├── __init__.py
│       ├── config.py
│       ├── main.py
│       ├── api/
│       │   ├── router.py
│       │   └── routes/
│       │       ├── __init__.py
│       │       ├── health.py
│       │       ├── project.py
│       │       └── session.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── project.py
│       │   └── session.py
│       ├── services/
│       │   ├── ProjectManager.py
│       │   ├── SessionManager.py
│       │   └── __pycache__/
│       └── src/
│           ├── __init__.py
│           ├── clause.py
│           ├── cnf_converter.py
│           ├── lexer.py
│           ├── parser.py
│           ├── parser.out
│           ├── parsetab.py
│           ├── resolution_engine.py
│           └── __pycache__/
├── diagrams/
├── forms/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── eslint.config.js
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── public/
│   └── src/
│       ├── App.css
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── theme.css
│       ├── types.ts
│       ├── api/
│       │   ├── client.ts
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
│       │   ├── SplashScreen.css
│       │   ├── SplashScreen.tsx
│       │   ├── TopBar.css
│       │   └── TopBar.tsx
│       ├── context/
│       │   └── ThemeContext.tsx
│       └── types/
│           └── session.ts
└── .git/
```

## Backend overview

The backend is a FastAPI service built around a Redis-backed session model and a project model for per-session knowledge-base state. It exposes REST endpoints for health checks, session restoration, and project CRUD/import/export operations.

### Main backend modules

- `backend/app/main.py` — creates the FastAPI app and configures CORS.
- `backend/app/config.py` — stores environment-based settings, Redis URL, session secret, and session expiry values.
- `backend/app/api/router.py` — mounts the `health`, `session`, and `project` route groups.
- `backend/app/api/routes/health.py` — health endpoint used to confirm the API is running.
- `backend/app/api/routes/session.py` — creates or restores a browser tab session and handles session deletion.
- `backend/app/api/routes/project.py` — routes for listing, creating, fetching, deleting, importing and exporting projects.
- `backend/app/services/SessionManager.py` — generates and persists session IDs in Redis with TTL-based inactivity expiry.
- `backend/app/services/ProjectManager.py` — stores per-session project records keyed by `session_id` and `project_id`.
- `backend/app/schemas/session.py` — defines the session record structure returned to the frontend.
- `backend/app/schemas/project.py` — defines the project model, including `knowledge_base`, `cnf_kb`, `goal`, `status`, and `resolution_result`.

### Logical reasoning code

The backend also includes a logic engine used for CNF conversion and resolution work:

- `backend/app/src/lexer.py` — tokenization logic.
- `backend/app/src/parser.py` — parser implementation.
- `backend/app/src/cnf_converter.py` — CNF conversion utilities.
- `backend/app/src/clause.py` — clause representations.
- `backend/app/src/resolution_engine.py` — resolution logic.

These source files are part of the application package and are considered active backend logic rather than a separate legacy folder.

## Frontend overview

The frontend is a Vite + React + TypeScript application that manages the user flow for projects, knowledge-base setup, and conversion steps. The current UI is centered around session-aware project loading and KB input screens.

### Frontend entry points

- `frontend/src/App.tsx` — main application screen flow: splash, project selection, KB choice, and KB input.
- `frontend/src/main.tsx` — app bootstrap.
- `frontend/src/api/session.ts` — creates/restores the browser tab session and stores session IDs in `sessionStorage`.
- `frontend/src/api/projects.ts` — project list fetch, import, and export helpers.
- `frontend/src/api/client.ts` — shared API fetch wrapper with `X-Tab-ID` and `X-Session-ID` headers.
- `frontend/src/types.ts` — shared frontend type definitions like `KBData` and `InputMethod`.
- `frontend/src/types/session.ts` — session response typing used by the frontend.

### Frontend UI structure

- `frontend/src/components/SplashScreen.tsx` — startup splash screen.
- `frontend/src/components/ProjectView.tsx` — project list and creation workflow.
- `frontend/src/components/KBChoiceView.tsx` — choose knowledge-base input method.
- `frontend/src/components/KBInputView.tsx` — capture formulas and goal input.
- `frontend/src/components/TopBar.tsx` — top navigation bar.
- `frontend/src/components/FileUpload.tsx` — upload component for KB files.
- `frontend/src/context/ThemeContext.tsx` — theme state/context provider.

## Supporting folders

- `diagrams/` — stores diagram or visual assets related to the project.
- `forms/` — contains form-related assets or templates.
- `backend/.env` — environment configuration including secrets and Redis connection values.

## Current project status

- The backend is implemented as a session-aware API with Redis-backed persistence.
- Project management is active, including list, create, import, export, and delete endpoints.
- The frontend uses session restoration to keep the browser tab connected to its backend session.
- The logical reasoning engine exists in the backend source tree and is part of the application’s core functionality.
- Some frontend actions, such as KB file upload and conversion, are currently stubbed placeholders and not fully wired to backend endpoints yet.
