import type {Session} from "../types/session";

const API_URL = (import.meta as ImportMeta & {
    env?: { VITE_API_URL?: string };
}).env?.VITE_API_URL ?? "";
const TAB_ID_KEY = 'resviz_tab_id';

export function getTabId(): string {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);

    if (!tabId) {
        tabId = crypto.randomUUID();
        sessionStorage.setItem(TAB_ID_KEY, tabId);
    }

    return tabId
}

export async function restoreSession(): Promise<Session> {
    const response = await fetch(`${API_URL}/api/session`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Tab-ID': getTabId(),
        }
    });

    if (!response.ok) {
        throw new Error('Could not restore session');
    }

    return response.json()
}
