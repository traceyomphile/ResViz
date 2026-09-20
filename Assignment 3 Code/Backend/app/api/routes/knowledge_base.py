# app/api/routes/knowledge_base.py

import json
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import TypeAdapter, ValidationError
from app.api.routes.project import require_session
from app.schemas.knowledge_base import (
    FormulaValidationResult,
    KnowledgeBaseEntry,
    KnowledgeBaseEntrySummary,
    KnowledgeBaseListResponse,
    KnowledgeBasePayload,
    KnowledgeBaseResponse,
    QueryPayload,
    QueryResponse,
    SaveKnowledgeBasePayload,
    ValidationPayload,
    ValidationResponse,
)
from app.services.ProjectManager import project_manager
from app.services.knowledge_base_files import parse_knowledge_base_file
from app.src.parser import Node

knowledge_base_router = APIRouter(tags=['Knowledge Base'])
node_adapter = TypeAdapter(Node)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

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
    normalised = normalise_formula(formula)

    def fully_parenthesised(expression: str) -> bool:
        if not expression.startswith('(') or not expression.endswith(')'):
            return False

        depth = 0
        for index, character in enumerate(expression):
            if character == '(':
                depth += 1
            elif character == ')':
                depth -= 1
                if depth == 0 and index != len(expression) - 1:
                    return False

        return depth == 0

    # The grammar expects binary expressions to be enclosed. Wrapping the
    # outer expression also prevents PLY from recovering by returning only
    # the final atom from input such as "(A | T) -> Qualified".
    has_binary_operator = any(
        operator in normalised for operator in ('<->', '->', '&', '|')
    )
    if has_binary_operator and not fully_parenthesised(normalised):
        normalised = f'({normalised})'

    return node_adapter.validate_python(normalised)

def project_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail='Project not found'
    )

def knowledge_base_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail='Saved knowledge base not found'
    )

def parse_uploaded_knowledge_base(filename: str, raw_text: str) -> tuple[list[str], list[str], str | None]:
    try:
        return parse_knowledge_base_file(filename, raw_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f'Invalid JSON at line {exc.lineno}, column {exc.colno}') from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

def parse_uploaded_formulas(filename: str, raw_text: str) -> tuple[list[str], str | None]:
    formulas, _, goal = parse_uploaded_knowledge_base(filename, raw_text)
    return formulas, goal

@knowledge_base_router.post('/projects/{project_id}/knowledge-base/text', response_model=KnowledgeBaseResponse)
async def save_typed_knowledge_base(project_id: str, payload: KnowledgeBasePayload, session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    try:
        parsed_formulas = [parse_formula(formula) for formula in payload.formulas]
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Invalid propositional formula: {exc}',
        ) from exc

    project = await project_manager.set_knowledge_base(session_id, project_id, parsed_formulas, **({'annotations': payload.annotations} if payload.annotations is not None else {}))

    if project is None: raise project_not_found()

    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        annotations=project.knowledge_base_annotations,
        goal=project.goal,
    )

@knowledge_base_router.post('/projects/{project_id}/knowledge-base/upload', response_model=KnowledgeBaseResponse)
async def upload_knowledge_base(project_id: str, file: UploadFile = File(...), session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    filename = file.filename or "knowledge-base.json"

    if not filename.lower().endswith((".json", ".txt", ".kb")):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Knowledge base must be a .json, .txt, or .kb file",
        )

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Knowledge-base files may not exceed 5 MB",
        )

    try:
        raw_text = contents.decode("utf-8", errors='replace')
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Knowledge-base file must use UTF-8 text",
        ) from exc

    formulas, annotations, uploaded_query = parse_uploaded_knowledge_base(filename, raw_text)

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
        annotations=annotations,
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
        annotations=project.knowledge_base_annotations,
        goal=project.goal,
    )

@knowledge_base_router.get('/projects/{project_id}/knowledge-base', response_model=KnowledgeBaseResponse)
async def get_knowledge_base(project_id: str, session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    project = await project_manager.get(session_id, project_id)
    if project is None:
        raise project_not_found()

    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        annotations=project.knowledge_base_annotations,
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

@knowledge_base_router.get('/projects/{project_id}/knowledge-bases', response_model=KnowledgeBaseListResponse)
async def list_saved_knowledge_bases(project_id: str, session_id: str = Depends(require_session)) -> KnowledgeBaseListResponse:
    entries = await project_manager.list_knowledge_base_entries(session_id, project_id)

    if entries is None:
        raise project_not_found()

    return KnowledgeBaseListResponse(
        project_id=project_id,
        knowledge_bases=[
            KnowledgeBaseEntrySummary(
                id=entry.id,
                name=entry.name,
                formula_count=len(entry.formulas),
                created_at=entry.created_at,
            )
            for entry in entries
        ]
    )

@knowledge_base_router.post(
    '/projects/{project_id}/knowledge-bases', 
    response_model=KnowledgeBaseEntrySummary, 
    status_code=status.HTTP_201_CREATED
)
async def save_named_knowledge_base(project_id: str, payload: SaveKnowledgeBasePayload, session_id: str = Depends(require_session)) -> KnowledgeBaseEntrySummary:
    """Called by KBInputView's SAVE KB button. Adds a named entry to the project's sidebar library."""
    try:
        parsed_formulas = [parse_formula(formula) for formula in payload.formulas]
        parsed_goal = parse_formula(payload.goal) if payload.goal else None
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Invalid propositional formula: {exc}',
        ) from exc
 
    entry = KnowledgeBaseEntry(name=payload.name, formulas=parsed_formulas, annotations=payload.annotations or [])
    if 'goal' in payload.model_fields_set:
        entry.goal = parsed_goal
    project = await project_manager.save_knowledge_base_entry(session_id, project_id, entry)
 
    if project is None:
        raise project_not_found()
 
    return KnowledgeBaseEntrySummary(
        id=entry.id,
        name=entry.name,
        formula_count=len(entry.formulas),
        created_at=entry.created_at,
    )
 
@knowledge_base_router.put('/projects/{project_id}/knowledge-bases/{kb_id}', response_model=KnowledgeBaseEntrySummary)
async def update_saved_knowledge_base(project_id: str, kb_id: str, payload: SaveKnowledgeBasePayload, session_id: str = Depends(require_session)) -> KnowledgeBaseEntrySummary:
    try:
        formulas = [parse_formula(formula) for formula in payload.formulas]
        goal = parse_formula(payload.goal) if payload.goal else None
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f'Invalid propositional formula: {exc}') from exc
    project = await project_manager.update_knowledge_base_entry(session_id, project_id, kb_id, payload.name, formulas, goal, annotations=payload.annotations)
    if project is None:
        existing = await project_manager.get(session_id, project_id)
        raise project_not_found() if existing is None else knowledge_base_not_found()
    entry = next(entry for entry in project.knowledge_bases if entry.id == kb_id)
    return KnowledgeBaseEntrySummary(id=entry.id, name=entry.name, formula_count=len(entry.formulas), created_at=entry.created_at)

@knowledge_base_router.put('/projects/{project_id}/knowledge-bases/{kb_id}/activate', response_model=KnowledgeBaseResponse)
async def activate_saved_knowledge_base(project_id: str, kb_id: str, session_id: str = Depends(require_session)) -> KnowledgeBaseResponse:
    """Called when a user clicks a saved KB in the sidebar, to load it as the active working KB."""
    project = await project_manager.activate_knowledge_base_entry(session_id, project_id, kb_id)
 
    if project is None:
        existing = await project_manager.get(session_id, project_id)
        raise project_not_found() if existing is None else knowledge_base_not_found()
 
    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        annotations=project.knowledge_base_annotations,
        goal=project.goal,
    )
 
@knowledge_base_router.delete('/projects/{project_id}/knowledge-bases/{kb_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_knowledge_base(project_id: str, kb_id: str, session_id: str = Depends(require_session)) -> None:
    project = await project_manager.delete_knowledge_base_entry(session_id, project_id, kb_id)
 
    if project is None:
        existing = await project_manager.get(session_id, project_id)
        raise project_not_found() if existing is None else knowledge_base_not_found()
        
@knowledge_base_router.post('/knowledge-base/validate', response_model=ValidationResponse)
async def validate_knowledge_base(payload: ValidationPayload, session_id: str = Depends(require_session)) -> ValidationResponse:
    del session_id
    results: list[FormulaValidationResult] = []

    for formula in payload.formulas:
        try:
            parse_formula(formula)
            results.append(
                FormulaValidationResult(
                    formula=formula, 
                    valid=True,
                    error=None,
                )
            )
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

