// URL da API (Worker). Definida no build via VITE_API_URL; local: wrangler dev.
export const API_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');

const TOKEN_KEY = 'wf_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** Salva o token e o espelha no IndexedDB para o Service Worker (que não lê localStorage). */
export async function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage bloqueado */ }
  await mirrorToSw('token', token);
  await mirrorToSw('apiUrl', API_URL);
}

function mirrorToSw(key: string, value: string | null): Promise<void> {
  return new Promise((resolve) => {
    const open = indexedDB.open('wf-sw', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', 'readwrite');
      if (value === null) tx.objectStore('kv').delete(key);
      else tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
  });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? res.statusText);
  return data as T;
}
