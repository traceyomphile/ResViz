# app/api/routes/knowledge_base.py

import json
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import TypeAdapter, ValidationError
from app.api.routes.project import require_session
from app.schemas.knowledge_base import (
    FormulaValidationResult,
    KnowledgeBasePayload,
    KnowledgeBaseResponse,
    QueryPayload,
    QueryResponse,
    ValidationPayload,
    ValidationResponse,
)
from app.services.ProjectManager import project_manager
from app.src.parser import Node

knowledge_base_router = APIRouter(tags='Knowledge Base')
node_adapter = TypeAdapter(Node)
MAX_UPLOAD_BYTES = 1024 * 1024

def normalise_formula(formula: str) -> str:
    return (
        formula.strip()
        .replace("↔", "<->")
        .replace("→", "->")
        .replace("¬", "~")
        .replace("∧", "&")
        .replace("∨", "|")
    )

def parse_formula(formula: str) -> Node:
    return node_adapter.validate_python(normalise_formula(formula))

def project_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail='Project not found'
    )

def parse_uploaded_formulas(filename: str, raw_text: str) -> tuple[list[str], str | None]:
    if filename.lower().endswith(".json"):
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON at line {exc.lineno}, column {exc.colno}",
            ) from exc

        if isinstance(data, list):
            formulas = data
            query = None
        elif isinstance(data, dict):
            formulas = data.get("formulas", data.get("knowledge_base"))
            query = data.get("query", data.get("goal"))
        else:
            formulas = None
            query = None

        if not isinstance(formulas, list) or not all(
            isinstance(formula, str) for formula in formulas
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="JSON must contain a string array named formulas or knowledge_base",
            )

        if query is not None and not isinstance(query, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The uploaded query or goal must be a string",
            )

        return formulas, query

    formulas = [
        line.strip()
        for line in raw_text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    return formulas, None

@knowledge_base_router.post('/projects/{project_id}/knowledge-base/text', response_model=KnowledgeBaseResponse)
async def save_typed_knowledge_base(project_id: str, payload: KnowledgeBasePayload, session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    try:
        parsed_formulas = [parse_formula(formula) for formula in payload.formulas]
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Invalid propositional formula: {exc}',
        ) from exc

    project = await project_manager.set_knowledge_base(session_id, project_id, parsed_formulas)

    if project is None: raise project_not_found()

    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )

@knowledge_base_router.post('/projets/{project_id}/knowledge-base/upload', response_model=KnowledgeBaseResponse)
async def upload_knowledge_base(project_id: str, file: UploadFile = File(...), session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    filename = file.filename or "knowledge-base.txt"

    if not filename.lower().endswith((".json", ".txt", ".kb")):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Knowledge base must be a .json, .txt, or .kb file",
        )

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Knowledge-base files may not exceed 1 MB",
        )

    try:
        raw_text = contents.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Knowledge-base file must use UTF-8 text",
        ) from exc

    formulas, uploaded_query = parse_uploaded_formulas(filename, raw_text)

    if not formulas:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded knowledge base contains no formulas",
        )

    try:
        parsed_formulas = [parse_formula(item) for item in formulas]
        parsed_query = (
            parse_formula(uploaded_query)
            if uploaded_query
            else None
        )
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid propositional formula: {exc}",
        ) from exc

    project = await project_manager.set_knowledge_base(
        session_id,
        project_id,
        parsed_formulas,
    )

    if project is None:
        raise project_not_found()

    if parsed_query is not None:
        project = await project_manager.set_goal(
            session_id,
            project_id,
            parsed_query,
        )

    return KnowledgeBaseResponse(
        project_id=project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )
@knowledge_base_router.get('projects/{project_id}/knowledge-base', response_model=KnowledgeBaseResponse)
async def get_knowledge_base(project_id: str, session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    project = await project_manager.get(session_id, project_id)
    if project is None:
        raise project_not_found()

    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )

@knowledge_base_router.put('/projects/{project_id}/knowledge-base', response_model=KnowledgeBaseResponse)
async def replace_knowledge_base(project_id: str, payload: KnowledgeBasePayload, session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    return await save_typed_knowledge_base(project_id, payload, session_id)

@knowledge_base_router.delete('/projects/{project_id}/knowledge-base', status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(project_id: str, session_id: str = Depends(require_session)) -> None:
    project = await project_manager.clear_knowledge_base(session_id, project_id)
    if project is None:
        raise project_not_found()

@knowledge_base_router.post('/knowledge-base/validate', response_model=ValidationResponse)
async def validate_knowledge_base(payload: ValidationPayload, session_id: str = Depends(require_session)) -> ValidationResponse:
    del session_id
    results: list[FormulaValidationResult] = []

    for formula in payload.formulas:
        try:
            parse_formula(formula)
            results.append(FormulaValidationResult(formula=formula, valid=True))
        except (ValidationError, ValueError, TypeError) as exc:
            results.append(
                FormulaValidationResult(
                    formula=formula,
                    valid=False,
                    error=str(exc),
                )
            )

    return ValidationResponse(
        valid=all(result.valid for result in results),
        results=results,
    )

@knowledge_base_router.put('/projects/{project_id}/query', response_model=QueryResponse)
async def save_query(project_id: str, payload: QueryPayload, session_id: str = Depends(require_session)) -> QueryResponse:
    try:
        parsed_query = parse_formula(payload.query)
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Invalid query formula: {exc}',
        ) from exc

    project = await project_manager.set_goal(session_id, project_id, parsed_query)
    if project is None:
        raise project_not_found()

    return QueryResponse(project_id=project.project_id, query=project.goal)

@knowledge_base_router.get('/projects/{project_id}/query', response_model=QueryResponse)
async def get_query(project_id: str, session_id: str = Depends(require_session)) -> QueryResponse:
    project = await project_manager.get(session_id, project_id)
    if project is None:
        raise project_not_found()

    return QueryResponse(project_id=project.project_id, query=project.goal)
