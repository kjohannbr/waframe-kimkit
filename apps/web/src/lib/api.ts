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
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? res.statusText);
  // resposta 200 sem JSON válido (conexão cortada no meio, proxy…) não pode virar "sucesso vazio"
  if (data === null) throw new ApiError(res.status, 'bad_response');
  return data as T;
}

const MESSAGES: Record<string, string> = {
  invalid_email: 'E-mail inválido.',
  weak_password: 'A senha precisa ter de 8 a 128 caracteres.',
  email_taken: 'Já existe uma conta com esse e-mail.',
  reserved_email: 'Esse e-mail é reservado. Use "Entrar".',
  invalid_credentials: 'E-mail ou senha incorretos.',
  too_many_attempts: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  unauthorized: 'Sessão expirada. Entre novamente.',
  forbidden: 'Você não tem permissão para isso.'
};

/** Mensagem amigável (PT-BR) para um erro vindo da API. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return MESSAGES[e.message] ?? `Erro ${e.status}. Tente novamente.`;
  return 'Não foi possível falar com o servidor. Verifique sua conexão.';
}
