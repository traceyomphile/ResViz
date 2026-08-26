# ResViz Project Structure

This project currently contains a frontend app, a backend API, supporting diagram/form assets, and logic helper modules.

```text
resviz/
├── Backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── router.py
│   │   │   └── routes/
│   │   │       └── session.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── session.py
│   │   └── services/
│   │       ├── __init__.py
│   │       └── SessionManager.py
│   ├── ResViz Logic/
│   │   ├── _init_.py
│   │   ├── cnf.py
│   │   ├── lexer.py
│   │   └── parser.py
│   ├── .gitkeep
│   ├── endpoints.md
│   ├── ProjectStructure.md
│   ├── requirements.txt
│   └── README.md (if present)
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── session.ts
│   │   ├── assets/
│   │   ├── components/
│   │   │   └── FileUpload.tsx
│   │   ├── types/
│   │   │   └── session.ts
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── diagrams/
├── forms/
└── .git/
```

## Backend overview

The backend is a lightweight FastAPI service focused on session management. It currently uses Redis to store per-browser-tab session data and exposes a session endpoint for the frontend.

### Main backend files

- `Backend/app/main.py` — creates the FastAPI app and configures CORS.
- `Backend/app/config.py` — stores Redis, frontend URL, session timeout, and cookie configuration.
- `Backend/app/api/router.py` — registers backend route modules.
- `Backend/app/api/routes/session.py` — handles session creation/restoration.
- `Backend/app/schemas/session.py` — defines the session response schema.
- `Backend/app/services/SessionManager.py` — stores and retrieves session data in Redis.

## Frontend overview

The frontend is a Vite + React + TypeScript app. It contains the UI, API client utilities, and typed session models used by the browser client.

### Frontend entry points

- `frontend/src/App.tsx` — main application component.
- `frontend/src/main.tsx` — app bootstrap.
- `frontend/src/api/session.ts` and `frontend/src/api/client.ts` — API access helpers.
- `frontend/src/types/session.ts` — frontend session typing.

## Supporting folders

- `diagrams/` — likely stores diagrams or diagram assets for the project.
- `forms/` — likely contains forms or form-related templates/assets.
- `Backend/ResViz Logic/` — logic prototype files used for CNF/lexer/parser related work, but not yet fully integrated into the active API.

## Notes

- The backend is not yet a full project-management system with database-backed project storage.
- The active implementation is centered on session state and browser-tab lifecycle.
- The repository contains both an evolving logic module and a session-based API, but the code currently reflects the session flow more than the full planned project architecture.
