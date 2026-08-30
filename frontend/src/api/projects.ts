import {getSessionId, getTabId} from './session'

const API_URL = (import.meta as ImportMeta & {
    env?: {VITE_API_URL?: string };
}).env?.VITE_API_URL ?? '';

export interface ProjectSummary {
    id: string;
    name: string;
    description: string;
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

