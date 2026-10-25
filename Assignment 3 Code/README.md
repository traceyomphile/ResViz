# ResViz

ResViz is a browser-based propositional logic assistant for creating projects, entering knowledge bases, validating formulas, converting them to CNF, and running a resolution proof workflow. The project consists of:

- A FastAPI backend for project/session management and logic processing
- A Vite + React + TypeScript frontend for the interactive workflow
- Redis-backed session and project persistence
- A parser/conversion/resolution engine for propositional logic reasoning

## Overview

The application lets a user:

- create and manage multiple projects
- save named knowledge-base snapshots
- validate formulas before conversion
- convert knowledge bases plus a negated goal to CNF
- execute a resolution proof and inspect each step
- export and import project JSON files

The backend is primarily responsible for:

- session lifecycle management
- project CRUD and import/export
- knowledge-base validation and persistence
- CNF conversion and resolution execution
- storage in Redis with per-session TTLs

The frontend is responsible for:

- restoring the browser tab session
- creating/opening projects
- choosing a knowledge-base entry method
- uploading or typing formulas
- saving the goal query
- triggering CNF conversion and resolution

---

## Tech stack

### Backend

- Python 3.11+
- FastAPI
- Pydantic
- Redis
- PLY parser generator
- Uvicorn

### Frontend

- React 19
- TypeScript
- Vite
- ESLint

---

## Repository structure

```text
resviz/
├── backend/
│   ├── .env
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── conversion.py
│   │   │   │   ├── health.py
│   │   │   │   ├── knowledge_base.py
│   │   │   │   ├── project.py
│   │   │   │   └── session.py
│   │   │   └── router.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── schemas/
│   │   │   ├── knowledge_base.py
│   │   │   ├── project.py
│   │   │   └── session.py
│   │   ├── services/
│   │   │   ├── ProjectManager.py
│   │   │   └── SessionManager.py
│   │   └── src/
│   │       ├── clause.py
│   │       ├── cnf_converter.py
│   │       ├── lexer.py
│   │       ├── parser.py
│   │       ├── resolution_engine.py
│   │       └── ...
│   ├── requirements.txt
│   ├── tests/
│   │   ├── run_tests.py
│   │   ├── test_cnf_converter.py
│   │   ├── test_parser.py
│   │   ├── test_project_reasoning.py
│   │   ├── test_resolution_engine.py
│   │   └── test_session_manager.py
│   └── .venv/
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── ...
├── diagrams/
├── forms/
├── .gitignore
├── endpoints.md
├── ProjectStructure.md
├── Makefile
├── README.md
├── lexer.py
└── ...
```

---

## Environment variables

The backend expects a `.env` file at `backend/.env`.

Current example values look like this:

```env
SESSION_SECRET=your-long-random-secret
REDIS_URL=redis://127.0.0.1:6379
```

Important notes:

- `SESSION_SECRET` is used to derive a stable session ID from the browser tab ID.
- `REDIS_URL` points to the Redis instance used by both session and project storage.
- The frontend can optionally use a `VITE_API_URL` value if the backend is not served from the same origin.

Example frontend environment:

```env
VITE_API_URL=http://localhost:8000
```

---

## Prerequisites

Before running the project, install:

- Python 3.11 or later
- Node.js 18 or later and npm
- Redis 7.x recommended
- Git

If you are running on Windows, you can use `winget`, `choco`, or WSL2 with a Linux environment.

---

## Installing Redis

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

Expected output:

```text
PONG
```

If systemd is not available on your machine, you can start Redis directly:

```bash
redis-server --save "" --appendonly no --port 6379
```

### macOS

```bash
brew install redis
brew services start redis
redis-cli ping
```

### Windows

Using winget:

```powershell
winget install --id Redis.Redis -e
redis-server
```

Using Chocolatey:

```powershell
choco install redis-64
redis-server
```

If the Redis service is installed as a Windows service, you can also start it from Services or:

```powershell
redis-server --service-install
redis-server --service-start
redis-cli ping
```

### WSL2 / Linux inside Windows

If you are using WSL2, the Linux package install steps above are the easiest solution:

```bash
sudo apt update
sudo apt install -y redis-server
sudo service redis-server start
redis-cli ping
```

---

## Local setup

From the project root:

```bash
cd resviz
```

### Option 1: Use the Makefile

This project includes a `Makefile` with common commands.

Install dependencies:

```bash
make install
```

Install backend + frontend dev dependencies including toolchain updates:

```bash
make install-dev
```

Start Redis and both services together:

```bash
make dev
```

Run backend only:

```bash
make backend
```

Run frontend only:

```bash
make frontend
```

Run the backend unit tests:

```bash
make test
```

Build the production frontend bundle:

```bash
make build-frontend
```

Check available commands:

```bash
make help
```

Stop Redis:

```bash
make redis-stop
```

Clean dependencies and build output:

```bash
make clean
```

### Option 2: Run without Makefile

#### Create a Python virtual environment

On macOS / Linux:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

On Windows PowerShell:

```powershell
python -m venv backend/.venv
backend/.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

#### Install frontend dependencies

```bash
cd frontend
npm install
```

or if you want a clean lockfile-based install:

```bash
npm ci
```

---

## Start the backend

From the project root:

```bash
make backend
```

Manual equivalent:

```bash
cd backend
../backend/.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir .
```

Visit:

- API docs: http://localhost:8000/docs
- App root: http://localhost:8000/

---

## Start the frontend

From the project root:

```bash
make frontend
```

Manual equivalent:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Visit:

- Frontend UI: http://localhost:5173

If your backend is running on a different host, set:

```bash
export VITE_API_URL=http://localhost:8000
```

or create a `.env` file inside `frontend/`:

```env
VITE_API_URL=http://localhost:8000
```

---

## Run both services together

```bash
make dev
```

This starts Redis and launches both the backend and frontend processes in parallel.

---

## Run tests

```bash
make test
```

Manual backend test run:

```bash
python backend/tests/run_tests.py
```

or with the virtual environment:

```bash
backend/.venv/bin/python backend/tests/run_tests.py
```

---

## Production frontend build

```bash
make build-frontend
```

Manual build:

```bash
cd frontend
npm run build
```

Build output is emitted to:

```text
frontend/dist/
```

---

## API usage notes

The frontend uses session headers rather than cookies for the backend session lifecycle:

- `X-Tab-ID` identifies the browser tab
- `X-Session-ID` identifies the backend session

The backend validates this session on protected routes.

---

## API endpoints

Base path: `/api`

### Session endpoints

- `GET /api/session` — restores or creates a session for a tab
- `DELETE /api/session` — deletes the current session for the tab

### Project endpoints

- `POST /api/projects` — create a new project
- `GET /api/projects` — list projects for the active session
- `GET /api/projects/{project_id}` — fetch a project
- `POST /api/projects/import` — import a project JSON file
- `GET /api/projects/{project_id}/export` — export a project as JSON
- `DELETE /api/projects/{project_id}` — delete project

### Knowledge-base endpoints

- `POST /api/projects/{project_id}/knowledge-base/text` — save typed formulas
- `POST /api/projects/{project_id}/knowledge-base/upload` — upload a KB file
- `GET /api/projects/{project_id}/knowledge-base` — get the active working knowledge base
- `PUT /api/projects/{project_id}/knowledge-base` — replace the active KB
- `DELETE /api/projects/{project_id}/knowledge-base` — clear the active KB
- `GET /api/projects/{project_id}/knowledge-bases` — list saved named KB entries
- `POST /api/projects/{project_id}/knowledge-bases` — save a named KB entry
- `PUT /api/projects/{project_id}/knowledge-bases/{kb_id}/activate` — activate a saved KB
- `DELETE /api/projects/{project_id}/knowledge-bases/{kb_id}` — delete a saved KB
- `POST /api/knowledge-base/validate` — validate formulas

### Query endpoints

- `PUT /api/projects/{project_id}/query` — save the query/goal
- `GET /api/projects/{project_id}/query` — fetch the saved query

### CNF conversion endpoints

- `POST /api/projects/{project_id}/cnf-conversion` — convert formulas and goal to CNF
- `GET /api/projects/{project_id}/cnf-conversion` — returns the stored conversion result
- `GET /api/projects/{project_id}/cnf-conversion/steps` — list conversion steps
- `GET /api/projects/{project_id}/cnf-conversion/steps/{step_number}` — fetch one conversion step

### Resolution endpoints

- `POST /api/projects/{project_id}/resolution` — run resolution against the project
- `GET /api/projects/{project_id}/resolution` — fetch final resolution result
- `GET /api/projects/{project_id}/resolution/steps` — list resolution steps
- `GET /api/projects/{project_id}/resolution/steps/{step_number}` — fetch one resolution step

### Final result endpoint

- `GET /api/projects/{project_id}/resolution/result` — returns whether the query is entailed

Complete endpoint details are listed in [endpoints.md](endpoints.md).

---

## Troubleshooting

### Redis connection fails

Check that Redis is running:

```bash
redis-cli ping
```

If it fails, start Redis again or confirm the `REDIS_URL` in `backend/.env` is correct.

### CORS issues

The backend allows a set of configured frontend origins in `backend/app/config.py`:

```python
FRONTEND_URLS = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
]
```

If your frontend runs on another origin, update `FRONTEND_URLS` or set the appropriate local address before running the backend.

### Session not found or expired

This typically indicates one of the following:

- Redis is not running
- the browser session was cleared
- the tab ID header is missing
- the session TTL expired after inactivity

### Dependency issues

If a backend import fails, recreate the virtual environment and reinstall dependencies:

```bash
rm -rf backend/.venv
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

---

## Notes for contributors

- The logical reasoning engine lives under `backend/app/src/`.
- Redis-backed project and session data are managed in `backend/app/services/`.
- Pydantic schemas are in `backend/app/schemas/`.
- API routing is centralized in `backend/app/api/router.py`.
- The frontend calls the backend through helper modules in `frontend/src/api/`.

---

## License

This project is configured for local academic / project use and does not currently declare a formal open-source license in the repository.
