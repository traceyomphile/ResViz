"""CNF conversion and resolution endpoints for an existing project."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.routes.project import require_session
from app.schemas.project import Project
from app.schemas.session import SessionResponse
from app.services.ProjectManager import project_manager
from app.src.clause import Clause, Literal
from app.src.cnf_converter import CNFConverter
from app.src.parser import Node
from app.src.resolution_engine import ResolutionEngine


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


class ResolutionStepResponse(BaseModel):
    step_number: int
    parent_1: str
    parent_2: str
    pivot: str
    resolvent_id: str
    resolvent: str


class ClauseResponse(BaseModel):
    id: str
    expression: str
    source_formula: str | None = None


class ResolutionResponse(BaseModel):
    project_id: str
    entailed: bool
    status: str
    initial_clauses: list[ClauseResponse]
    clauses: list[ClauseResponse]
    steps: list[ResolutionStepResponse]


def clause_text(literals: frozenset[Literal]) -> str:
    ordered = sorted(
        literals,
        key=lambda literal: (not literal.negated, literal.symbol),
    )
    return ' | '.join(str(literal) for literal in ordered) or '□'


def not_node(node: Node) -> Node:
    return Node('~', node)


def project_formulas(project: Project) -> list[Node]:
    """Combine every named KB and any distinct active, unsaved KB."""
    formulas = [
        formula
        for knowledge_base in project.knowledge_bases
        for formula in knowledge_base.formulas
    ]

    active_signature = tuple(str(formula) for formula in project.knowledge_base)
    saved_signatures = {
        tuple(str(formula) for formula in knowledge_base.formulas)
        for knowledge_base in project.knowledge_bases
    }

    if project.knowledge_base and active_signature not in saved_signatures:
        formulas.extend(project.knowledge_base)

    return formulas or list(project.knowledge_base)


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

    # Keep every clause in source order. Identical clauses from different
    # named KBs are still part of the complete project conversion record.
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
    source_clauses: list[Clause] = []
    clause_number = 1

    for formula in formulas:
        for literals in converter.convert(formula).clauses:
            source_clauses.append(Clause(
                id=f'C{clause_number}',
                literals=literals,
                source_formula=str(formula),
            ))
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
    ) for clause in source_clauses]

    result = ResolutionEngine().run(source_clauses, support_ids)
    response_steps = [ResolutionStepResponse(
        step_number=step.step_number,
        parent_1=step.parent_1.id,
        parent_2=step.parent_2.id,
        pivot=str(step.pivot),
        resolvent_id=step.resolvent.id,
        resolvent=str(step.resolvent),
    ) for step in result.steps]

    saved = await project_manager.set_resolution_result(
        session.session_id,
        project_id,
        result.status.value,
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
    ) for clause in result.clauses]

    return ResolutionResponse(
        project_id=project_id,
        entailed=result.entailed,
        status=result.status.value,
        initial_clauses=initial_clauses,
        clauses=clauses,
        steps=response_steps,
    )
