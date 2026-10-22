import { api, ApiError, getToken, setToken } from './api';

export type User = { id: string; email: string; display_name: string | null; role: 'user' | 'admin' };

export const session = $state<{ user: User | null; ready: boolean }>({ user: null, ready: false });

export async function refreshSession() {
  if (!getToken()) {
    session.user = null;
    session.ready = true;
    return;
  }
  try {
    session.user = await api<User>('/api/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await setToken(null);
    session.user = null;
  } finally {
    session.ready = true;
  }
}

export async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* token já inválido: segue */
  }
  await setToken(null);
  session.user = null;
}
