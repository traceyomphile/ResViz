import {getSessionId, getTabId} from './session'

const API_URL = (import.meta as ImportMeta & {
    env?: {VITE_API_URL?: string };
}).env?.VITE_API_URL ?? '';

export interface ProjectSummary {
    id: string;
    name: string;
    description: string;
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

        return {
            id: project.project_id ?? project.id ?? `project-${index}`,
            name: project.name ?? `PROJECT ${index + 1}`,
            description: project.description ?? '',
        };
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
    };
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

