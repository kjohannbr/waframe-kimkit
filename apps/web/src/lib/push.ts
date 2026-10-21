import { base } from '$app/paths';
import { api } from './api';

function urlBase64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  const { publicKey } = await api<{ publicKey: string }>('/api/push/vapid');
  // escopo = base path do repositório (ex.: /warframe-toolkit/)
  const reg = await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
  await api('/api/push/subscribe', { method: 'POST', json: { subscription: sub.toJSON() } });
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(`${base}/`);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/api/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
