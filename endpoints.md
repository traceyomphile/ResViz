# Session Endpoints

* GET /api/session
    > Returns the current session or creates one if one does not exist. Sets an HTTP-only cookie
* DELETE /api/session
    > Deletes the current when the tab closes.
    
# Project Endpoints

* POST /api/projects
    > Creates a new ResViz project
* GET /api/projects
    > Returns all saved projects
* GET /api/projects/{project_id}
    > Opens one specific project
* POST /api/projects/import
    > Accepts a .json file and loads a project
* PUT /api/projects/{project_id}
    > Updates the project's name or details
* GET /api/projects/{project_id}/export
    > Downloads a <project_id>.json file.
* DELETE /api/projects/{project_id}
    > Deletes a project
* POST /api/projects/import?overwrite=true
    > Replaces an exisitng project with the same ID

# Knowledge-base (KB) Endpoints

* POST /api/projects/{project_id}/knowledge-base/text
    > Save formulas typed by the user
* POST /api/projects/{project_id}/knowledge-base/upload
    > Uploads a knowledge-base file
* GET /api/projects/{project_id}/knowledge-base
    > Returns the project's current formulas.
* PUT /api/projects/{project_id}/knowledge-base
    > Replaces or edits the knowledge base.
* DELETE /api/projects/{project_id}/knowledge-base
    > Clears the knowledge base
* POST /api/knowledge-base/validate
    > Checks whether the formulas are correctly written

# Query Endpoints

* PUT /api/projects/{project_id}/query
    > Saves the formula the user wants to prove
* GET /api/projects/{project_id}/query
    > Returns the saved query formula.

# CNF COnversion Endpoints

* POST /api/projects/{project_id}/cnf-conversion
    > Converts the knowledge base and negated query to CNF
* GET /api/projects/{project_id}/cnf-conversion
    > Returns the complete CNF conversion result
* GET /api/projects/{project_id}/cnf-conversion/steps
    > Returns every conversion step for the visualisation
* GET /api/projects/{project_id}/cnf-conversion/steps/{step_number}
    > Returns one specific conversion step.

# Resolution Endpoints

* POST /api/projects/{project_id}/resolution
    > Runs the resolution algorithm
* GET /api/projects/{project_id}/resolution
    > Returns the final resolution result
* GET /api/projects/{project_id}/resolution/steps
    > Retuns all resolution steps
* GET /api/projects/{project_id}/resolution/steps/{step_number}
    > Returns one step for the Next and Previous buttons.

# Final-result endpoint

* GET /api/projects/{project_id}/resolution/result
    > Returns whether the query is entailed by the knowlegde base

