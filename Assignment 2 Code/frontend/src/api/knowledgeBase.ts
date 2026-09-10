import {getSessionId, getTabId} from './session';

const API_URL = (import.meta as ImportMeta & {
    env?: {VITE_API_URL?: string};
}).env?.VITE_API_URL ?? '';

export interface KnowledgeBaseResponse {
    project_id: string;
    formulas: string[];
    goal: string | null;
}

export interface FormulaValidationResult {
    formula: string;
    valid: boolean;
    error?: string | null;
}

export interface ValidationResponse {
    valid: boolean;
    results: FormulaValidationResult[];
}

export interface CNFStep {
    step_number: number;
    source: string;
    rule: string;
    result: string;
}

export interface CNFConversionResponse {
    project_id: string;
    cnf_clauses: string[];
    negated_goal: string;
    support_clauses: string[];
    steps: CNFStep[];
    status: string;
}

export interface ResolutionStep {
    step_number: number;
    parent_1: string;
    parent_2: string;
    pivot: string;
    resolvent_id: string;
    resolvent: string;
}

export interface ResolutionClause {
    id: string;
    expression: string;
    source_formula: string | null;
}

export interface ResolutionResponse {
    project_id: string;
    entailed: boolean;
    status: 'entailed' | 'not_entailed' | 'limit_reached';
    initial_clauses: ResolutionClause[];
    clauses: ResolutionClause[];
    steps: ResolutionStep[];
}

export interface KnowledgeBaseEntrySummary {
    id: string;
    name: string;
    formula_count: number;
    created_at: string;
}

export interface KnowledgeBaseListResponse {
    project_id: string;
    knowledge_bases: KnowledgeBaseEntrySummary[];
}

function sessionHeaders(): Record<string, string> {
    const sessionId = getSessionId();

    if (!sessionId) {
        throw new Error('Cannot access the knowledge base without an active session.');
    }

    return {
        'X-Session-ID': sessionId,
        'X-Tab-ID': getTabId(),
    };
}

async function responseError(response: Response, fallback: string): Promise<Error> {
    const body = await response.json().catch(() => null) as {
        detail?: string | {message?: string};
    } | null;
    const detail = body?.detail;

    return new Error(
        typeof detail === 'string'
            ? detail
            : detail?.message ?? fallback,
    );
}

export async function validateKnowledgeBase(formulas: string[]): Promise<ValidationResponse> {
    const response = await fetch(`${API_URL}/api/knowledge-base/validate`, {
        method: 'POST',
        headers: {
            ...sessionHeaders(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({formulas}),
    });

    if (!response.ok) {
        throw await responseError(response, 'Coulf not validate the knowledge base');
    }

    return response.json() as Promise<ValidationResponse>;
}

export async function saveTypedKnowledgeBase(projectId: string, formulas: string[]): Promise<KnowledgeBaseResponse> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/knowledge-base/text`, 
        {
            method: 'POST',
            headers: {
                ...sessionHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({formulas}),   
        },
    );
    
    if (!response.ok) {
        throw await responseError(response, 'Could not save the knowledge base');
    }

    return response.json() as Promise<KnowledgeBaseResponse>;
}

export async function uploadKnowledgeBase(projectId: string, file: File): Promise<KnowledgeBaseResponse> {
    const body = new FormData();
    body.append('file', file);

    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/knowledge-base/upload`,
        {
            method: 'POST',
            headers: sessionHeaders(),
            body,
        },
    );

    if (!response.ok) {
        throw await responseError(response, 'Could not upload the knowledge base');
    }

    return response.json() as Promise<KnowledgeBaseResponse>;
}

export async function saveQuery(projectId: string, query: string): Promise<void> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/query`,
        {
            method: 'PUT',
            headers: {
                ...sessionHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({query}),
        },
    );

    if (!response.ok) {
        throw await responseError(response, 'Could not save the query');
    }
}

export async function convertProjectToCnf(projectId: string): Promise<CNFConversionResponse> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/cnf-conversion`,
        {
            method: 'POST',
            headers: sessionHeaders(),
        },
    );

    if (!response.ok) {
        throw await responseError(response, 'Could not convert the project to CNF');
    }

    return response.json() as Promise<CNFConversionResponse>;
}

export async function resolveProject(projectId: string): Promise<ResolutionResponse> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/resolution`,
        {method: 'POST', headers: sessionHeaders()},
    );

    if (!response.ok) {
        throw await responseError(response, 'Could not run resolution');
    }

    return response.json() as Promise<ResolutionResponse>;
}

export async function listKnowledgeBases(projectId: string): Promise<KnowledgeBaseListResponse> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/knowledge-bases`,
        {
            headers: sessionHeaders(),
        },
    );
 
    if (!response.ok) {
        throw await responseError(response, 'Could not load the saved knowledge bases');
    }
 
    return response.json() as Promise<KnowledgeBaseListResponse>;
}
 
/** Called by KBInputView's SAVE KB button. Adds a named entry to the project's sidebar library. */
export async function saveNamedKnowledgeBase(
    projectId: string,
    name: string,
    formulas: string[],
): Promise<KnowledgeBaseEntrySummary> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/knowledge-bases`,
        {
            method: 'POST',
            headers: {
                ...sessionHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({name, formulas}),
        },
    );
 
    if (!response.ok) {
        throw await responseError(response, 'Could not save the knowledge base');
    }
 
    return response.json() as Promise<KnowledgeBaseEntrySummary>;
}
 
/** Loads a previously saved named KB from the sidebar back into the project's active working set. */
export async function activateKnowledgeBase(projectId: string, kbId: string): Promise<KnowledgeBaseResponse> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/knowledge-bases/${encodeURIComponent(kbId)}/activate`,
        {
            method: 'PUT',
            headers: sessionHeaders(),
        },
    );
 
    if (!response.ok) {
        throw await responseError(response, 'Could not load the selected knowledge base');
    }
 
    return response.json() as Promise<KnowledgeBaseResponse>;
}
 
export async function deleteSavedKnowledgeBase(projectId: string, kbId: string): Promise<void> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/knowledge-bases/${encodeURIComponent(kbId)}`,
        {
            method: 'DELETE',
            headers: sessionHeaders(),
        },
    );
 
    if (!response.ok && response.status !== 204) {
        throw await responseError(response, 'Could not delete the knowledge base');
    }
}
