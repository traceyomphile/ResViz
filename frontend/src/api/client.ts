import {getTabId} from './session';

const API_URL = (import.meta as ImportMeta & {
    env?: { VITE_API_URL?: string };
}).env?.VITE_API_URL ?? "";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);

  headers.set("X-Tab-ID", getTabId());

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}