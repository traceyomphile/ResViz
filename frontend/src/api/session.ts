import type {Session} from "../types/session";

const API_URL = (import.meta as ImportMeta & {
    env?: { VITE_API_URL?: string };
}).env?.VITE_API_URL ?? "";
const TAB_ID_KEY = 'resviz_tab_id';

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

export async function restoreSession(): Promise<Session> {
    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/session`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Tab-ID': getTabId(),
            }
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

    return response.json()
}
