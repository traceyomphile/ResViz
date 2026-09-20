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
from app.src.parser import Node
from app.schemas.session import SessionResponse

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

def split_annotated_formula(value: str) -> tuple[str, str | None]:
    value = value.strip()

    if ":" not in value:
        return value, None

    formula_part, annotation_part = value.split(":", 1)
    formula_part = formula_part.strip()
    annotation_part = annotation_part.strip()

    # Allow normal and smart quotes
    normal_quotes = (annotation_part.startswith('"') and annotation_part.endswith('"'))
    smart_quotes = (annotation_part.startswith('“') and annotation_part.endswith('”'))
    if not formula_part:
        raise ValueError("A formula is required before the annotation.")

    if not annotation_part:
        raise ValueError("An annotation is required after ':'")

    if not (normal_quotes or smart_quotes):
        raise ValueError("Annotations must be enclosed in double quotes.")

    # Convert smart quotes to ordinary JSON-compatible quotes
    if smart_quotes:
        annotation = annotation_part[1:-1]
    else:
        try:
            annotation = json.loads(annotation_part)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid annotation string.") from exc

    if not isinstance(annotation, str):
        raise ValueError("Annotation must be a string.")

    return formula_part, annotation

def parse_formula(formula: str) -> Node:
    # Split annnotation and formula
    formula_part, annotation = split_annotated_formula(formula)
    normalised = normalise_formula(formula_part)

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

    node =  node_adapter.validate_python(normalised)
    # Store the description separately from the logical expression
    node.annotation = annotation

    return node

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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="JSON must contain a string array named formulas or knowledge_base",
            )

        if query is not None and not isinstance(query, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
async def save_typed_knowledge_base(project_id: str, payload: KnowledgeBasePayload, session: SessionResponse = Depends(require_session)) -> KnowledgeBaseResponse:
    try:
        parsed_formulas = [parse_formula(formula) for formula in payload.formulas]
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f'Invalid propositional formula: {exc}',
        ) from exc

    project = await project_manager.set_knowledge_base(session.session_id, project_id, parsed_formulas)

    if project is None: raise project_not_found()

    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )

@knowledge_base_router.post('/projects/{project_id}/knowledge-base/upload', response_model=KnowledgeBaseResponse)
async def upload_knowledge_base(project_id: str, file: UploadFile = File(...), session: SessionResponse = Depends(require_session)) -> KnowledgeBaseResponse:
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

    formulas, uploaded_query = parse_uploaded_formulas(filename, raw_text)

    if not formulas:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid propositional formula: {exc}",
        ) from exc

    project = await project_manager.set_knowledge_base(
        session.session_id,
        project_id,
        parsed_formulas,
    )

    if project is None:
        raise project_not_found()

    if parsed_query is not None:
        project = await project_manager.set_goal(
            session.session_id,
            project_id,
            parsed_query,
        )

    return KnowledgeBaseResponse(
        project_id=project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )

@knowledge_base_router.get('/projects/{project_id}/knowledge-base', response_model=KnowledgeBaseResponse)
async def get_knowledge_base(project_id: str, session: SessionResponse = Depends(require_session)) -> KnowledgeBaseResponse:
    project = await project_manager.get(session.session_id, project_id)
    if project is None:
        raise project_not_found()

    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )

@knowledge_base_router.put('/projects/{project_id}/knowledge-base', response_model=KnowledgeBaseResponse)
async def replace_knowledge_base(project_id: str, payload: KnowledgeBasePayload, session: SessionResponse = Depends(require_session)) -> KnowledgeBaseResponse:
    return await save_typed_knowledge_base(project_id, payload, session.session_id)

@knowledge_base_router.delete('/projects/{project_id}/knowledge-base', status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(project_id: str, session: SessionResponse = Depends(require_session)) -> None:
    project = await project_manager.clear_knowledge_base(session.session_id, project_id)
    if project is None:
        raise project_not_found()

@knowledge_base_router.get('/projects/{project_id}/knowledge-bases', response_model=KnowledgeBaseListResponse)
async def list_saved_knowledge_bases(project_id: str, session: SessionResponse = Depends(require_session)) -> KnowledgeBaseListResponse:
    entries = await project_manager.list_knowledge_base_entries(session.session_id, project_id)

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
async def save_named_knowledge_base(project_id: str, payload: SaveKnowledgeBasePayload, session: SessionResponse = Depends(require_session)) -> KnowledgeBaseEntrySummary:
    """Called by KBInputView's SAVE KB button. Adds a named entry to the project's sidebar library."""
    try:
        parsed_formulas = [parse_formula(formula) for formula in payload.formulas]
        parsed_goal = parse_formula(payload.goal) if payload.goal and payload.goal.strip() else None

    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f'Invalid propositional formula: {exc}',
        ) from exc

    # Use explicitly supplied annotations if they exist
    annotations = payload.annotations

    if annotations is None:
        annotations = [formula.annotations or '' for formula in parsed_formulas]

    if len(annotations) != len(parsed_formulas):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                'The number of annotations must match the number of formulas.'
            ),
        )

    for formula, annotation in zip(parsed_formulas, annotations):
        formula.annotation = annotation or None

    entry_data = {
        'name': payload.name,
        'formulas': parsed_formulas,
        'annotations': annotations,
    }

    if 'goal' in payload.model_fields_set:
        entry_data['goal'] = parsed_goal
 
    entry = KnowledgeBaseEntry(**entry_data)
    project = await project_manager.save_knowledge_base_entry(session.session_id, project_id, entry)
 
    if project is None:
        raise project_not_found()
 
    return KnowledgeBaseEntrySummary(
        id=entry.id,
        name=entry.name,
        formula_count=len(entry.formulas),
        created_at=entry.created_at,
    )
 
@knowledge_base_router.put('/projects/{project_id}/knowledge-bases/{kb_id}/activate', response_model=KnowledgeBaseResponse)
async def activate_saved_knowledge_base(project_id: str, kb_id: str, session: SessionResponse = Depends(require_session)) -> KnowledgeBaseResponse:
    """Called when a user clicks a saved KB in the sidebar, to load it as the active working KB."""
    project = await project_manager.activate_knowledge_base_entry(session.session_id, project_id, kb_id)
 
    if project is None:
        existing = await project_manager.get(session.session_id, project_id)
        raise project_not_found() if existing is None else knowledge_base_not_found()
 
    return KnowledgeBaseResponse(
        project_id=project.project_id,
        formulas=project.knowledge_base,
        goal=project.goal,
    )
 
@knowledge_base_router.delete('/projects/{project_id}/knowledge-bases/{kb_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_knowledge_base(project_id: str, kb_id: str, session: SessionResponse = Depends(require_session)) -> None:
    project = await project_manager.delete_knowledge_base_entry(session.session_id, project_id, kb_id)
 
    if project is None:
        existing = await project_manager.get(session.session_id, project_id)
        raise project_not_found() if existing is None else knowledge_base_not_found()
        
@knowledge_base_router.post('/knowledge-base/validate', response_model=ValidationResponse)
async def validate_knowledge_base(payload: ValidationPayload, _session: SessionResponse = Depends(require_session)) -> ValidationResponse:
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
async def save_query(project_id: str, payload: QueryPayload, session: SessionResponse = Depends(require_session)) -> QueryResponse:
    try:
        parsed_query = parse_formula(payload.query)
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f'Invalid query formula: {exc}',
        ) from exc

    project = await project_manager.set_goal(session.session_id, project_id, parsed_query)
    if project is None:
        raise project_not_found()

    return QueryResponse(project_id=project.project_id, query=project.goal)

@knowledge_base_router.get('/projects/{project_id}/query', response_model=QueryResponse)
async def get_query(project_id: str, session: SessionResponse = Depends(require_session)) -> QueryResponse:
    project = await project_manager.get(session.session_id, project_id)
    if project is None:
        raise project_not_found()

    return QueryResponse(project_id=project.project_id, query=project.goal)

