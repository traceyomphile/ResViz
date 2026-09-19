import {getSessionId, getTabId} from './session'

const API_URL = (import.meta as ImportMeta & {
    env?: {VITE_API_URL?: string };
}).env?.VITE_API_URL ?? '';

export interface SavedProjectKB {id: string; name: string; formulas: string[]; annotations?: string[]; goal?: string | null}

export interface ProjectSummary {
    id: string;
    name: string;
    description: string;
    formulas?: string[];
    goal?: string;
    status?: string;
    knowledge_base?: SavedProjectKB[];
    annotations?: string[];
    activeKnowledgeBase?: string | null;
}

export interface CreateProjectInput {
    id?: string;
    name: string;
    description?: string;
    formulas?: string[];
    goal?: string;
}

/**Handle importing Error */
export class ProjectImportConflictError extends Error {
    constructor() {
        super('A project with this ID already exists');
        this.name = 'ProjectImportConflictError'; 
    }
}


type RawProject = 
    | string
    | {
        id?: string,
        project_id?: string;
        name?: string;
        description?: string;
        knowledge_base?: unknown[];
        knowledge_base_annotations?: string[];
        formulas?: unknown[];
        goal?: unknown;
        status?: string;
        knowledge_bases?: SavedProjectKB[];
        active_knowledge_base_id?: string | null;

    };

export async function getProjects(): Promise<ProjectSummary[]> {
    const sessionId = getSessionId();

    if (!sessionId) {
        throw new Error('Cannot load projects without an active session');
    }

    let response: Response;

    try {
        response = await fetch(`${API_URL}/api/projects`, {
            method: 'GET',
            headers: {
                'X-Session-ID': sessionId,
                'X-Tab-ID': getTabId(),
            },
        });
    } catch (err) {
        console.error('getProjects: network/CORS error', err);
        throw new Error('Could not load projects (network error)', {
            cause: err,
        });
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '<no body>');

        console.error(
            `getProjects failed: ${response.status} ${response.statusText}`,
            body,
        );
        throw new Error(`Could not load projects (${response.status})`);
    }

    const data: RawProject[] = await response.json();

    return data.map((project, index) => {
        if (typeof project === 'string') {
            return {
                id: project,
                name: `PROJECT ${index + 1}`,
                description: '',
            };
        }

        return toProjectSummary(project);
    });
}

function projectHeaders(): Record<string, string> {
    const sessionId = getSessionId();

    if (!sessionId) {
        throw new Error('Cannot access projects without an active session');
    }

    return {
        'X-Session-ID': sessionId,
        'X-Tab-ID': getTabId(),
    };
}

function toProjectSummary(project: RawProject): ProjectSummary {
    if (typeof project === 'string') {
        return {id: project, name: project, description: ''};
    }

    const id = project.project_id ?? project.id;

    if (!id) {
        throw new Error('The server returned a project without an ID');
    }

    return {
        id,
        name: project.name ?? id,
        description: project.description ?? '',
        formulas: (project.knowledge_base ?? project.formulas ?? [])
            .filter((formula): formula is string => typeof formula === 'string'),
        goal: typeof project.goal === 'string' ? project.goal : '',
        status: project.status,
    };
}

export async function getProject(projectId: string): Promise<ProjectSummary> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}`,
        {
            method: 'GET',
            headers: projectHeaders(),
        }
    );

    if (!response.ok) {
        throw await responseError(
            response,
            `Could not load project (${response.status})`,
        );
    }
    return toProjectSummary(await response.json() as RawProject);
}

function generateProjectId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;    // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;     // variant 10

    const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0'));

    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
    ].join('-');
}
export async function createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
            ...projectHeaders(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            project_id: input.id ?? generateProjectId(),
            name: input.name,
            description: input.description ?? '',
            knowledge_base: input.formulas ?? [],
            cnf_kb: null,
            goal: input.goal || null,
            status: 'draft',
            resolution_result: '',
        }),
    });

    if (!response.ok) {
        throw await responseError(
            response,
            `Could not create project (${response.status})`,
        );
    }

    return toProjectSummary(await response.json() as RawProject);
}
async function responseError(response: Response, fallback: string): Promise<Error> {
    const body = await response.json().catch(() => null) as {
        detail?: string | { message?: string };
    } | null;
    const detail = body?.detail;
    const message = typeof detail === 'string'
        ? detail
        : detail?.message ?? fallback;

    return new Error(message);
}

export async function importProject(file: File, overwrite = false): Promise<ProjectSummary> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
        `${API_URL}/api/projects/import?overwrite=${overwrite}`,
        {
            method: 'POST',
            headers: projectHeaders(),
            body: formData,
        },
    );

    if (response.status === 409) {
        throw new ProjectImportConflictError();
    }

    if (!response.ok) {
        throw await responseError(response, `Could not import project
            (${response.status})`);
    }

    return toProjectSummary(await response.json() as RawProject);
}

export async function exportProject(projectId: string): Promise<void> {
    const response = await fetch(
        `${API_URL}/api/projects/${encodeURIComponent(projectId)}/export`,
        {
            method: 'GET',
            headers: projectHeaders(),
        },
    );

    if (!response.ok) {
        throw await responseError(response, `Could not export project
            (${response.status})`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] ?? `${projectId}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export async function renameProject(projectId: string, name: string): Promise<ProjectSummary> {
    const response = await fetch(`${API_URL}/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: {...projectHeaders(), 'Content-Type': 'application/json'},
        body: JSON.stringify({name}),
    });
    if (!response.ok) throw await responseError(response, 'Could not rename project');
    return toProjectSummary(await response.json() as RawProject);
}

export async function deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE', headers: projectHeaders(),
    });
    if (!response.ok) throw await responseError(response, 'Could not delete project');
}