# ResViz API Endpoints

This document reflects the current implementation of the API. The backend uses a tab/session model and requires `X-Tab-ID` and `X-Session-ID` headers for protected routes.

## Session endpoints

### GET /api/session
- Requires header: `X-Tab-ID`
- Returns the current session or creates one if it does not exist.
- Stores a session ID in browser session storage on the frontend.
- Response model: `SessionResponse`

### DELETE /api/session
- Requires headers: `X-Session-ID` and `X-Tab-ID`
- Deletes the backend session for the tab.
- Returns `204 No Content`

---

## Project endpoints

### POST /api/projects
- Requires valid session
- Creates a new ResViz project
- Request body is a `Project` object
- Response: created `Project`

### GET /api/projects
- Requires valid session
- Returns all projects belonging to the current session
- Response: `list[Project]`

### GET /api/projects/{project_id}
- Requires valid session
- Returns a specific project
- 404 if the project is missing

### POST /api/projects/import
- Requires valid session
- Accepts a multipart upload with a `.json` file
- Query parameter: `overwrite=false`
- Returns `201 Created` on success
- 409 if project already exists and overwrite is not set
- 415 if the uploaded file is not JSON

### GET /api/projects/{project_id}/export
- Requires valid session
- Returns the project's JSON representation as a downloadable file
- Response headers include a `Content-Disposition` attachment filename

### DELETE /api/projects/{project_id}
- Requires valid session
- Deletes the project from the current session
- Returns `204 No Content`

---

## Knowledge-base endpoints

### POST /api/projects/{project_id}/knowledge-base/text
- Requires valid session
- Saves typed formulas for the active project
- Input payload: `{ "formulas": ["A", "A -> B"] }`
- Parses formulas before storing them
- Returns the active knowledge base and goal

### POST /api/projects/{project_id}/knowledge-base/upload
- Requires valid session
- Accepts a `.json`, `.txt`, or `.kb` upload
- Parses uploaded formulas and optional query/goal
- Validates formula syntax before saving
- Returns updated project KB and goal
- Rejects files larger than 5 MB

### GET /api/projects/{project_id}/knowledge-base
- Requires valid session
- Returns the active working knowledge base and goal for the project

### PUT /api/projects/{project_id}/knowledge-base
- Requires valid session
- Replaces the current working knowledge base with the provided formulas

### DELETE /api/projects/{project_id}/knowledge-base
- Requires valid session
- Clears the active knowledge base for the project
- Returns `204 No Content`

### GET /api/projects/{project_id}/knowledge-bases
- Requires valid session
- Lists saved named knowledge-base entries associated with the project

### POST /api/projects/{project_id}/knowledge-bases
- Requires valid session
- Saves a named knowledge-base snapshot to the project's sidebar library
- Request body: `{ "name": "KB Name", "formulas": [...] }`
- Returns a lightweight summary entry

### PUT /api/projects/{project_id}/knowledge-bases/{kb_id}/activate
- Requires valid session
- Activates a previously saved named knowledge base and loads it into the working set

### DELETE /api/projects/{project_id}/knowledge-bases/{kb_id}
- Requires valid session
- Removes a saved named knowledge-base entry

### POST /api/knowledge-base/validate
- Does not require a project; it validates formula text only
- Requires session headers for consistency with the app's session protection
- Request body: `{ "formulas": [...] }`
- Returns a validation result per formula

---

## Query endpoints

### PUT /api/projects/{project_id}/query
- Requires valid session
- Saves the goal/query formula to be proved
- Request body: `{ "query": "A | B" }`
- Parses and stores the query as a logical node

### GET /api/projects/{project_id}/query
- Requires valid session
- Returns the saved query formula

---

## CNF conversion endpoints

### POST /api/projects/{project_id}/cnf-conversion
- Requires valid session
- Converts the active project formulas and negated goal into CNF
- Combines active formulas plus saved named KB entries that are not already duplicated
- Persists `cnf_kb` and `cnf_steps` on the project
- Returns:
  - `project_id`
  - `cnf_clauses`
  - `negated_goal`
  - `support_clauses`
  - `steps`
  - `status`

### GET /api/projects/{project_id}/cnf-conversion
- Requires valid session
- Returns the stored CNF conversion result for that project

### GET /api/projects/{project_id}/cnf-conversion/steps
- Requires valid session
- Returns conversion steps for visualization

### GET /api/projects/{project_id}/cnf-conversion/steps/{step_number}
- Requires valid session
- Returns one conversion step by index

---

## Resolution endpoints

### POST /api/projects/{project_id}/resolution
- Requires valid session
- Requires that CNF conversion has been run already
- Runs the resolution algorithm against the project clauses and negated goal
- Stores the final resolution status on the project
- Returns:
  - `project_id`
  - `entailed`
  - `status`
  - `initial_clauses`
  - `clauses`
  - `steps`

### GET /api/projects/{project_id}/resolution
- Requires valid session
- Returns the final resolution result

### GET /api/projects/{project_id}/resolution/steps
- Requires valid session
- Returns the resolution steps

### GET /api/projects/{project_id}/resolution/steps/{step_number}
- Requires valid session
- Returns one specific step by number

### GET /api/projects/{project_id}/resolution/result
- Requires valid session
- Returns the final entailment outcome for the project query

---

## Response and data model notes

The backend stores projects as Pydantic models with fields including:

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

The data is stored in Redis using a TTL-based inactivity timeout (`SESSION_DURATION` defaults to 20 minutes).

---

## Important implementation detail

Unlike a traditional cookie-based API, the frontend uses a browser tab ID and session ID sent in headers:

- `X-Tab-ID`: identifies the current browser tab
- `X-Session-ID`: identifies the backend session

This means the app expects the frontend to call the API with those headers present in every protected route.

