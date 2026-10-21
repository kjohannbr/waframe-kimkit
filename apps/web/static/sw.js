/* static/sw.js — Service Worker de Web Push (Warframe Toolkit)
 * Hospedado em GitHub Pages (sub-caminho) com API em outra origem:
 *  - URLs são resolvidas contra o escopo do SW (inclui o base path do repositório)
 *  - API_URL e token ficam no IndexedDB (o SW não enxerga localStorage) */
const SCOPE = self.registration.scope; // ex: https://usuario.github.io/warframe-toolkit/
const ICON = new URL('icons/icon-192.png', SCOPE).href;
const BADGE = new URL('icons/badge-72.png', SCOPE).href;

// ── mini-KV em IndexedDB (config escrita pelo cliente) ──
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wf-sw', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Payload esperado (JSON): { title, body, url, tag, topic }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Warframe Toolkit', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Warframe Toolkit', {
      body: data.body || '',
      icon: ICON,
      badge: BADGE,
      tag: data.tag || data.topic || 'wf-toolkit',
      renotify: true,
      data: { url: data.url || 'dashboard', topic: data.topic },
      actions: [{ action: 'open', title: 'Abrir dashboard' }],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // '/dashboard' ou 'dashboard' → sempre relativo ao escopo (respeita o base path)
  const rel = (event.notification.data?.url || 'dashboard').replace(/^\//, '');
  const target = new URL(rel, SCOPE).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

// O navegador rotacionou a subscription: reenvia ao backend (Bearer vindo do IndexedDB)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const [apiUrl, token] = await Promise.all([kvGet('apiUrl'), kvGet('token')]);
      if (!apiUrl || !token) return; // usuário deslogado: o cliente reinscreve ao abrir o app
      const old = event.oldSubscription;
      const sub =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: old?.options?.applicationServerKey,
        }));
      await fetch(`${apiUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: old?.endpoint }),
      });
    })()
  );
});
