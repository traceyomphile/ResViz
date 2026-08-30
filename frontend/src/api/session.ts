import type {Session} from "../types/session";

const API_URL = (import.meta as ImportMeta & {
    env?: { VITE_API_URL?: string };
}).env?.VITE_API_URL ?? "";
const TAB_ID_KEY = 'resviz_tab_id';
const SESSION_ID_KEY = 'resviz_session_id';

function generateTabId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function getTabId(): string {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);

    if (!tabId) {
        tabId = generateTabId();
        sessionStorage.setItem(TAB_ID_KEY, tabId);
    }

    return tabId
}

export function getSessionId(): string | null {
    return sessionStorage.getItem(SESSION_ID_KEY)
}
export async function restoreSession(): Promise<Session> {
    const existingSessionId = getSessionId();

    const headers: HeadersInit = {
        'X-Tab-ID': getTabId(),
    };

    if (existingSessionId) {
        headers['X-Session-ID'] = existingSessionId;
    }

    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/session`, {
            method: 'GET',
            headers,
        });
    } catch (err) {
        console.error('restoreSession: network/CORS error', err);
        throw new Error('Could not restore session (network error)', { cause: err });
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '<no body>');
        console.error(`restoreSession failed: ${response.status} ${response.statusText}`, body);
        throw new Error(`Could not restore session (${response.status})`);
    }

    const session: Session = await response.json()

    sessionStorage.setItem(SESSION_ID_KEY, session.session_id);

    return session;
}

export async function deleteSession(): Promise<void> {
    const sessionId = getSessionId();

    if (!sessionId) {
        sessionStorage.clear();
        return;
    }

    try {
        await fetch(`${API_URL}/api/session`, {
            method: 'DELETE',
            headers: {
                'X-Session-ID': sessionId,
                'X-Tab-ID': getTabId(),
            },
            keepalive: true,
        });
    } catch (err) {
        console.warn('Could not explicitly delete backend session.', err);
    } finally {
        sessionStorage.removeItem(SESSION_ID_KEY);
        sessionStorage.removeItem(TAB_ID_KEY);
    }
}
