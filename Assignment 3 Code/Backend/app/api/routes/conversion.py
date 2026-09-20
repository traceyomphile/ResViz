"""CNF conversion and resolution endpoints for an existing project."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.api.routes.project import require_session
from app.schemas.project import Project
from app.schemas.session import SessionResponse
from app.services.ProjectManager import project_manager
from app.src.clause import Clause, Literal
from app.src.cnf_converter import CNFConverter
from app.src.parser import Node
from app.src.resolution_engine import ResolutionEngine
from app.src.full_resolution_graph import FullResolutionEngine


conversion_router = APIRouter(prefix='/projects', tags=['Conversion'])


class CNFStepResponse(BaseModel):
    step_number: int
    source: str
    rule: str
    result: str


class CNFConversionResponse(BaseModel):
    project_id: str
    cnf_clauses: list[str]
    negated_goal: str
    support_clauses: list[str]
    steps: list[CNFStepResponse]
    status: str


class ResolutionCandidateResponse(BaseModel):
    rank: int
    parent_1: str
    parent_2: str
    pivot: str
    resolvent: str
    resolvent_size: int
    unit_matches: int
    partner_size: int
    enqueue_order: int


class ResolutionSelectionResponse(BaseModel):
    reason_code: str
    explanation: str
    candidate_count: int
    omitted_count: int
    candidates: list[ResolutionCandidateResponse]


class ResolutionStepResponse(BaseModel):
    step_number: int
    parent_1: str
    parent_2: str
    pivot: str
    resolvent_id: str
    resolvent: str
    selection: ResolutionSelectionResponse | None = None


class ClauseResponse(BaseModel):
    id: str
    expression: str
    source_formula: str | None = None
    source_knowledge_base: str | None = None
    is_negated_goal: bool = False


class PairOutcomeResponse(BaseModel):
    id: str
    parent_1: str
    parent_2: str
    pivot: str | None
    result_id: str | None
    expression: str
    kind: str
    reason: str
    depth: int


class FullGraphResponse(BaseModel):
    clauses: list[ClauseResponse]
    branches: list[PairOutcomeResponse]
    complete: bool
    limit_reason: str | None
    pairs_examined: int
    pending_pairs: int
    shortest_proof: list[str]
    shortest_is_optimal: bool
    entailed: bool


class ResolutionResponse(BaseModel):
    project_id: str
    entailed: bool
    status: str
    initial_clauses: list[ClauseResponse]
    clauses: list[ClauseResponse]
    steps: list[ResolutionStepResponse]
    graph: FullGraphResponse | None = None


def clause_text(literals: frozenset[Literal]) -> str:
    ordered = sorted(
        literals,
        key=lambda literal: (not literal.negated, literal.symbol),
    )
    return ' | '.join(str(literal) for literal in ordered) or '□'


def not_node(node: Node) -> Node:
    return Node('~', node)


def project_formulas(project: Project) -> list[Node]:
    """Use every project KB, without adding the active saved KB twice."""
    formulas = [formula for entry in project.knowledge_bases for formula in entry.formulas]
    active_signature = tuple(str(formula) for formula in project.knowledge_base)
    saved_signatures = {tuple(str(formula) for formula in entry.formulas) for entry in project.knowledge_bases}
    # Preserve older projects and the standalone text/upload APIs as well.
    if project.knowledge_base and active_signature not in saved_signatures:
        formulas.extend(project.knowledge_base)
    return formulas


@conversion_router.post(
    '/{project_id}/cnf-conversion',
    response_model=CNFConversionResponse,
)
async def convert_to_cnf(
    project_id: str,
    session: SessionResponse = Depends(require_session),
) -> CNFConversionResponse:
    project = await project_manager.get(session.session_id, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Project not found',
        )

    formulas = project_formulas(project)
    if not formulas:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='The project contains no knowledge-base formulas',
        )
    if project.goal is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='A query formula is required for CNF conversion',
        )

    converter = CNFConverter()
    clauses: list[frozenset[Literal]] = []
    steps: list[CNFStepResponse] = []
    step_number = 0

    for formula in formulas:
        conversion = converter.convert(formula)
        clauses.extend(conversion.clauses)

        for step in conversion.steps:
            step_number += 1
            steps.append(CNFStepResponse(
                step_number=step_number,
                source=step.original_expression,
                rule=step.rule_description,
                result=step.result_expression,
            ))

    # Keep every project knowledge base in source order.
    clause_strings = [clause_text(clause) for clause in clauses]

    negated_goal_conversion = converter.convert(not_node(project.goal))
    support_clauses = [
        clause_text(clause)
        for clause in negated_goal_conversion.clauses
    ]

    saved = await project_manager.set_cnf_result(
        session.session_id,
        project_id,
        clause_strings,
        [step.model_dump() for step in steps],
    )
    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Project not found',
        )

    return CNFConversionResponse(
        project_id=project_id,
        cnf_clauses=clause_strings,
        negated_goal=negated_goal_conversion.final_expression,
        support_clauses=support_clauses,
        steps=steps,
        status=saved.status,
    )


@conversion_router.post(
    '/{project_id}/resolution',
    response_model=ResolutionResponse,
)
async def resolve_project(
    project_id: str,
    session: SessionResponse = Depends(require_session),
) -> ResolutionResponse:
    project = await project_manager.get(session.session_id, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Project not found',
        )
    if project.cnf_kb is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Convert the project to CNF before running resolution',
        )
    if project.goal is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='A query formula is required for resolution',
        )

    formulas = project_formulas(project)
    converter = CNFConverter()
    source_names = [entry.name for entry in project.knowledge_bases for _ in entry.formulas]
    source_names.extend([None] * (len(formulas) - len(source_names)))
    source_knowledge_bases: dict[str, str | None] = {}
    source_clauses: list[Clause] = []
    clause_number = 1

    for formula, source_name in zip(formulas, source_names):
        for literals in converter.convert(formula).clauses:
            source_clauses.append(Clause(
                id=f'C{clause_number}',
                literals=literals,
                source_formula=str(formula),
            ))
            source_knowledge_bases[f'C{clause_number}'] = source_name
            clause_number += 1

    support_ids: set[str] = set()
    for literals in converter.convert(not_node(project.goal)).clauses:
        clause = Clause(
            id=f'C{clause_number}',
            literals=literals,
            source_formula=f'~({project.goal})',
        )
        source_clauses.append(clause)
        support_ids.add(clause.id)
        clause_number += 1

    initial_clauses = [ClauseResponse(
        id=clause.id,
        expression=clause.expression,
        source_formula=clause.source_formula,
        source_knowledge_base=source_knowledge_bases.get(clause.id),
        is_negated_goal=clause.id in support_ids,
    ) for clause in source_clauses]

    result = await run_in_threadpool(ResolutionEngine().run, source_clauses, support_ids)
    full = await run_in_threadpool(FullResolutionEngine().run, source_clauses)
    graph = FullGraphResponse(
        clauses=[ClauseResponse(id=c.id, expression=c.expression, source_formula=c.source_formula,
                                source_knowledge_base=source_knowledge_bases.get(c.id),
                                is_negated_goal=c.id in support_ids) for c in full.clauses],
        branches=[PairOutcomeResponse(**asdict(branch)) for branch in full.branches],
        complete=full.complete, limit_reason=full.limit_reason,
        pairs_examined=full.pairs_examined, pending_pairs=full.pending_pairs,
        shortest_proof=full.shortest_proof, shortest_is_optimal=full.shortest_is_optimal,
        entailed=full.entailed,
    )
    full_status = 'entailed' if full.entailed else 'not_entailed' if full.complete else 'limit_reached'
    response_steps = [ResolutionStepResponse(
        step_number=step.step_number,
        parent_1=step.parent_1.id,
        parent_2=step.parent_2.id,
        pivot=str(step.pivot),
        resolvent_id=step.resolvent.id,
        resolvent=str(step.resolvent),
        selection=ResolutionSelectionResponse(**asdict(step.selection)) if step.selection else None,
    ) for step in result.steps]

    saved = await project_manager.set_resolution_result(
        session.session_id,
        project_id,
        full_status,
    )
    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Project not found',
        )

    clauses = [ClauseResponse(
        id=clause.id,
        expression=clause.expression,
        source_formula=clause.source_formula,
        source_knowledge_base=source_knowledge_bases.get(clause.id),
        is_negated_goal=clause.id in support_ids,
    ) for clause in result.clauses]

    return ResolutionResponse(
        project_id=project_id,
        entailed=full.entailed,
        status=full_status,
        initial_clauses=initial_clauses,
        clauses=clauses,
        steps=response_steps,
        graph=graph,
    )
