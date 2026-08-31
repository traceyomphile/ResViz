import {getSessionId, getTabId} from './session';

const API_URL = (import.meta as ImportMeta & {
    env?: {VITE_API_URL?: string};
}).env?.VITE_API_URL ?? 'http://localhost:8000';

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
    steps: CNFStep[];
    status: string;
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
    const body = await new FormData();
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