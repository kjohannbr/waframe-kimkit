// src/index.ts — Cloudflare Worker + Hono
// deps: hono, @block65/webcrypto-web-push (Web Push compatível com Workers; o pacote `web-push` NÃO roda em Workers)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { DEFAULT_BASE, fetchWorld, hasAnyData, mergeStale, weekWindow, type World } from './world';
import { ensureTaskTemplates } from './tasks';

type Bindings = {
  WORLDSTATE_URL?: string; // opcional: base da API de worldstate (padrão api.warframestat.us/pc); usado em testes
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ADMIN_EMAIL?: string;    // secret: e-mail do administrador
  ADMIN_PASSWORD?: string; // secret: senha do administrador (nunca vai para o repositório)
  PBKDF2_ITER?: string;    // custo do hash de senha (padrão 100000). No plano grátis (10 ms de CPU) use um valor menor.
  APP_URL: string;    // URL pública do front, com base path. Ex: https://usuario.github.io/warframe-toolkit
  APP_ORIGIN: string; // só a origem (CORS). Ex: https://usuario.github.io
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string; // mailto:voce@dominio.com
};
type Vars = { userId: string };
type Env = { Bindings: Bindings; Variables: Vars };

const app = new Hono<Env>();
// Front (GitHub Pages) e API (workers.dev) ficam em sites diferentes: usamos token Bearer, não cookie.
app.use('/api/*', (c, next) =>
  cors({ origin: c.env.APP_ORIGIN, allowHeaders: ['Authorization', 'Content-Type'], maxAge: 86400 })(c, next)
);

// ───────────── Helpers ─────────────
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 dias

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Período do reset semanal: o reset do Warframe ocorre toda segunda 00:00 UTC. */
export function weekPeriodId(d = new Date()) {
  return weekWindow(d).id; // ex: "2026-10-19"
}

const requireAuth = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer /, '');
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  try {
    const p = await verify(token, c.env.JWT_SECRET, 'HS256');
    // revogação: sessão precisa existir no KV
    if (!(await c.env.KV.get(`sess:${p.sid}`))) return c.json({ error: 'session_revoked' }, 401);
    c.set('userId', p.sub as string);
    await next();
  } catch {
    return c.json({ error: 'unauthorized' }, 401);
  }
};

// ───────────── SENHAS (PBKDF2-SHA256 via WebCrypto) ─────────────
// O número de iterações vai gravado no próprio hash, então dá para aumentar o custo depois sem invalidar senhas antigas.
const iterations = (env: Bindings) => Math.min(100_000, Math.max(1_000, Number(env.PBKDF2_ITER) || 100_000));
const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const unb64 = (str: string) => Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function hashPassword(password: string, iter: number) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${b64(salt)}$${b64(await pbkdf2(password, salt, iter))}`;
}
async function verifyPassword(password: string, stored: string) {
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  return safeEqual(await pbkdf2(password, unb64(salt), Number(iter)), unb64(hash));
}
/** Comparação em tempo constante (compara os SHA-256 das duas strings). */
async function secretEquals(a: string, b: string) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return safeEqual(new Uint8Array(ha), new Uint8Array(hb));
}

// ───────────── AUTH (e-mail + senha) ─────────────
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
const isAdminEmail = (env: Bindings, email: string) => !!env.ADMIN_EMAIL && normEmail(env.ADMIN_EMAIL) === email;

/** Migração preguiçosa: adiciona password_hash/role se o D1 foi criado com o schema antigo. */
let schemaReady = false;
async function ensureAuthSchema(db: D1Database) {
  if (schemaReady) return;
  const { results } = await db.prepare('PRAGMA table_info(users)').all<{ name: string }>();
  const cols = new Set(results.map((r) => r.name));
  if (!cols.has('password_hash')) await db.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').run();
  if (!cols.has('role')) await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'").run();
  schemaReady = true;
}

// Limite de tentativas (KV): bloqueia após `max` falhas dentro da janela
async function isLocked(kv: KVNamespace, key: string, max: number) {
  return Number((await kv.get(key)) ?? 0) >= max;
}
async function recordFailure(kv: KVNamespace, key: string, windowSec: number) {
  const n = Number((await kv.get(key)) ?? 0);
  await kv.put(key, String(n + 1), { expirationTtl: windowSec });
}

async function startSession(env: Bindings, userId: string) {
  const sid = crypto.randomUUID();
  await env.KV.put(`sess:${sid}`, userId, { expirationTtl: SESSION_TTL });
  return sign({ sub: userId, sid, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }, env.JWT_SECRET);
}

app.post('/api/auth/register', async (c) => {
  await ensureAuthSchema(c.env.DB);
  const body = await c.req.json<{ email?: string; password?: string; display_name?: string }>().catch(() => null);
  const email = normEmail(body?.email);
  const password = String(body?.password ?? '');
  const name = String(body?.display_name ?? '').trim().slice(0, 60) || null;

  if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email' }, 400);
  if (password.length < 8 || password.length > 128) return c.json({ error: 'weak_password' }, 400);
  if (isAdminEmail(c.env, email)) return c.json({ error: 'reserved_email' }, 403);

  // limite por IP: 10 cadastros/hora
  const ipKey = `rl:reg:${c.req.header('cf-connecting-ip') ?? 'unknown'}`;
  if (await isLocked(c.env.KV, ipKey, 10)) return c.json({ error: 'too_many_attempts' }, 429);
  await recordFailure(c.env.KV, ipKey, 3600);

  if (await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()) {
    return c.json({ error: 'email_taken' }, 409);
  }
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash, role) VALUES (?, ?, ?, ?, 'user')")
      .bind(id, email, name, await hashPassword(password, iterations(c.env))),
    c.env.DB.prepare('INSERT INTO user_prefs (user_id) VALUES (?)').bind(id),
  ]);
  return c.json({ ok: true, token: await startSession(c.env, id) }, 201);
});

app.post('/api/auth/login', async (c) => {
  await ensureAuthSchema(c.env.DB);
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
  const email = normEmail(body?.email);
  const password = String(body?.password ?? '');
  if (!EMAIL_RE.test(email) || !password) return c.json({ error: 'invalid_credentials' }, 401);

  // 5 falhas / 15 min por e-mail e 20 por IP (rede compartilhada)
  const keys = [`rl:login:${email}`, `rl:loginip:${c.req.header('cf-connecting-ip') ?? 'unknown'}`];
  if (await isLocked(c.env.KV, keys[0], 5) || (await isLocked(c.env.KV, keys[1], 20))) return c.json({ error: 'too_many_attempts' }, 429);

  let userId: string | null = null;
  if (isAdminEmail(c.env, email)) {
    // Admin: a senha vem do secret ADMIN_PASSWORD (fonte única); a conta é criada/promovida no primeiro login
    if (c.env.ADMIN_PASSWORD && (await secretEquals(password, c.env.ADMIN_PASSWORD))) {
      const u = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
      if (u) {
        userId = u.id;
        await c.env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(u.id).run();
      } else {
        userId = crypto.randomUUID();
        await c.env.DB.batch([
          c.env.DB.prepare("INSERT INTO users (id, email, display_name, role) VALUES (?, ?, 'Admin', 'admin')").bind(userId, email),
          c.env.DB.prepare('INSERT INTO user_prefs (user_id) VALUES (?)').bind(userId),
        ]);
      }
    }
  } else {
    const u = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(email).first<{ id: string; password_hash: string | null }>();
    if (u?.password_hash && (await verifyPassword(password, u.password_hash))) userId = u.id;
  }

  if (!userId) {
    await Promise.all(keys.map((k) => recordFailure(c.env.KV, k, 900)));
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  await c.env.KV.delete(keys[0]);
  await c.env.DB.prepare('UPDATE users SET last_login_at = unixepoch() WHERE id = ?').bind(userId).run();
  return c.json({ ok: true, token: await startSession(c.env, userId) });
});

app.post('/api/auth/logout', requireAuth, async (c) => {
  const p = await verify(c.req.header('Authorization')!.replace(/^Bearer /, ''), c.env.JWT_SECRET, 'HS256');
  await c.env.KV.delete(`sess:${p.sid}`);
  return c.json({ ok: true });
});

app.get('/api/me', requireAuth, async (c) => {
  const u = await c.env.DB.prepare('SELECT id,email,display_name,timezone,role FROM users WHERE id = ?').bind(c.get('userId')).first();
  return c.json(u);
});

// ───────────── ADMIN ─────────────
const requireAdmin = async (c: any, next: any) => {
  const u = (await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(c.get('userId')).first()) as { role: string } | null;
  if (u?.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
  await next();
};

app.get('/api/admin/users', requireAuth, requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, display_name, role, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 200'
  ).all();
  return c.json(results);
});

// ───────────── CATÁLOGO ─────────────
app.get('/api/items', async (c) => {
  const type = c.req.query('type');
  const q = c.req.query('q');
  let sql = 'SELECT unique_name,name,type,category,variant FROM items WHERE 1=1';
  const args: unknown[] = [];
  if (type) { sql += ' AND type = ?'; args.push(type); }
  if (q) { sql += ' AND name LIKE ?'; args.push(`%${q}%`); }
  sql += ' ORDER BY name LIMIT 100';
  const { results } = await c.env.DB.prepare(sql).bind(...args).all();
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json(results);
});

app.get('/api/items/:unique', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM items WHERE unique_name = ?').bind(decodeURIComponent(c.req.param('unique'))).first();
  return row ? c.json(row) : c.json({ error: 'not_found' }, 404);
});

/** Mods compatíveis: filtra por categoria de compatibilidade, exilus e tipo. */
app.get('/api/mods', async (c) => {
  const { type, compat, exilus } = c.req.query();
  let sql = 'SELECT unique_name,name,compat_name,type,polarity,base_drain,max_rank,is_exilus,data_json FROM mods WHERE 1=1';
  const args: unknown[] = [];
  if (type) { sql += ' AND type = ?'; args.push(type); }
  if (compat) { sql += ' AND (compat_name = ? OR compat_name IS NULL)'; args.push(compat); }
  if (exilus === '1') sql += ' AND is_exilus = 1';
  const { results } = await c.env.DB.prepare(sql + ' ORDER BY name').bind(...args).all();
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json(results);
});

// ───────────── BUILDS ─────────────
app.get('/api/builds', requireAuth, async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT id,name,item_unique,item_type,visibility,share_slug,favorites_cnt,updated_at FROM builds WHERE user_id = ? ORDER BY updated_at DESC')
    .bind(c.get('userId')).all();
  return c.json(results);
});

app.post('/api/builds', requireAuth, async (c) => {
  const b = await c.req.json();
  const id = crypto.randomUUID();
  const slug = b.visibility !== 'private' ? crypto.randomUUID().slice(0, 8) : null;
  await c.env.DB.prepare(
    `INSERT INTO builds (id,user_id,item_unique,item_type,name,description,visibility,share_slug,config_json)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(id, c.get('userId'), b.item_unique, b.item_type, b.name, b.description ?? null, b.visibility ?? 'private', slug, JSON.stringify(b.config)).run();
  return c.json({ id, share_slug: slug }, 201);
});

app.put('/api/builds/:id', requireAuth, async (c) => {
  const b = await c.req.json();
  const r = await c.env.DB.prepare(
    `UPDATE builds SET name=?, description=?, visibility=?, config_json=?, updated_at=unixepoch()
     WHERE id=? AND user_id=?`
  ).bind(b.name, b.description ?? null, b.visibility, JSON.stringify(b.config), c.req.param('id'), c.get('userId')).run();
  return r.meta.changes ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
});

app.delete('/api/builds/:id', requireAuth, async (c) => {
  await c.env.DB.prepare('DELETE FROM builds WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('userId')).run();
  return c.json({ ok: true });
});

// Build pública/compartilhada (sem login); privada só pelo dono
app.get('/api/b/:slug', async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM builds WHERE share_slug = ? AND visibility IN ('public','unlisted')").bind(c.req.param('slug')).first();
  return row ? c.json(row) : c.json({ error: 'not_found' }, 404);
});

app.post('/api/builds/:id/favorite', requireAuth, async (c) => {
  const uid = c.get('userId'), id = c.req.param('id');
  const ins = await c.env.DB.prepare('INSERT OR IGNORE INTO build_favorites (user_id,build_id) VALUES (?,?)').bind(uid, id).run();
  if (ins.meta.changes) await c.env.DB.prepare('UPDATE builds SET favorites_cnt = favorites_cnt + 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ───────────── RIVENS (preço via Warframe.Market) ─────────────
app.post('/api/rivens/price', async (c) => {
  const { weapon_url_name, positive, negative } = await c.req.json<{ weapon_url_name: string; positive: string[]; negative?: string }>();
  const cacheKey = `riven:${await sha256(JSON.stringify({ weapon_url_name, positive: [...positive].sort(), negative }))}`;
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached) return c.json(cached);

  const params = new URLSearchParams({
    type: 'riven', weapon_url_name, sort_by: 'price_asc', buyout_policy: 'direct',
    positive_stats: positive.join(','),
  });
  if (negative) params.set('negative_stats', negative);

  // Confirme a versão/endpoint vigente da API do Warframe.Market (v1 auctions / v2) antes de ir a produção
  const res = await fetch(`https://api.warframe.market/v1/auctions/search?${params}`, { headers: { Platform: 'pc', Language: 'en' } });
  if (!res.ok) return c.json({ error: 'market_unavailable' }, 502);
  const { payload } = (await res.json()) as any;
  const prices: number[] = (payload.auctions ?? [])
    .filter((a: any) => a.owner?.status === 'ingame' || a.owner?.status === 'online')
    .map((a: any) => a.buyout_price).filter(Boolean).sort((a: number, b: number) => a - b);

  const out = prices.length
    ? { n: prices.length, min: prices[0], median: prices[Math.floor(prices.length / 2)], max: prices[prices.length - 1] }
    : { n: 0 };
  await c.env.KV.put(cacheKey, JSON.stringify(out), { expirationTtl: 600 }); // cache 10 min
  return c.json(out);
});

// ───────────── ESTADO DO MUNDO (Archimedeas, Descendia, mercadores…) ─────────────
const WORLD_KEY = 'world:v1';
const WORLD_FRESH_MS = 5 * 60_000; // dentro de 5 min devolve o cache sem chamar a API externa

async function getWorld(env: Bindings, force = false): Promise<World> {
  const cached = await env.KV.get<World>(WORLD_KEY, 'json');
  const now = new Date();
  if (!force && cached && now.getTime() - Date.parse(cached.fetchedAt) < WORLD_FRESH_MS && cached.week?.id === weekWindow(now).id) {
    return cached;
  }
  const world = mergeStale(await fetchWorld(env.WORLDSTATE_URL || DEFAULT_BASE, fetch, now), cached, now);
  if (hasAnyData(world)) await env.KV.put(WORLD_KEY, JSON.stringify(world), { expirationTtl: 6 * 3600 });
  return world;
}

app.get('/api/world', async (c) => {
  const world = await getWorld(c.env);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(world, hasAnyData(world) ? 200 : 502);
});

// ───────────── KANBAN DE RESETS ─────────────
app.get('/api/tasks', requireAuth, async (c) => {
  await ensureTaskTemplates(c.env.DB);
  const uid = c.get('userId'), period = weekPeriodId();
  const { results } = await c.env.DB.prepare(
    `SELECT t.key,t.title,t.category,t.cadence, COALESCE(u.status,'todo') AS status, u.note
       FROM task_templates t
       LEFT JOIN user_tasks u ON u.task_key=t.key AND u.user_id=? AND u.period_id=?
      ORDER BY t.sort_order`
  ).bind(uid, period).all();
  return c.json({ period, tasks: results }); // "reset automático": novo period_id => tudo volta a 'todo'
});

app.put('/api/tasks/:key', requireAuth, async (c) => {
  const { status, note } = await c.req.json<{ status: 'todo' | 'doing' | 'done'; note?: string }>();
  await c.env.DB.prepare(
    `INSERT INTO user_tasks (user_id,task_key,period_id,status,note) VALUES (?,?,?,?,?)
     ON CONFLICT(user_id,task_key,period_id) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=unixepoch()`
  ).bind(c.get('userId'), c.req.param('key'), weekPeriodId(), status, note ?? null).run();
  return c.json({ ok: true });
});

// ───────────── WEB PUSH ─────────────
app.get('/api/push/vapid', (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));

app.post('/api/push/subscribe', requireAuth, async (c) => {
  const { subscription, oldEndpoint } = await c.req.json<{ subscription: { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number }; oldEndpoint?: string }>();
  if (oldEndpoint) await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(oldEndpoint).run();
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,expiration_time,user_agent)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth, failure_count=0`
  ).bind(crypto.randomUUID(), c.get('userId'), subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
         subscription.expirationTime ?? null, c.req.header('user-agent') ?? null).run();
  return c.json({ ok: true }, 201);
});

app.post('/api/push/unsubscribe', requireAuth, async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>();
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(endpoint, c.get('userId')).run();
  return c.json({ ok: true });
});

// ───────────── JOBS AGENDADOS (Cron Triggers) ─────────────
async function broadcast(env: Bindings, topic: string, message: { title: string; body: string; url?: string }) {
  const { results } = await env.DB.prepare(
    `SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE topics LIKE ?`
  ).bind(`%"${topic}"%`).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const payloadJson = JSON.stringify({ ...message, topic, tag: topic });

  for (const s of results) {
    try {
      const req = await buildPushPayload(
        { data: payloadJson, options: { ttl: 3600, urgency: 'normal' } },
        { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
        vapid
      );
      const res = await fetch(s.endpoint, req);
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(s.id).run(); // expirada
      } else if (!res.ok) {
        await env.DB.prepare('UPDATE push_subscriptions SET failure_count=failure_count+1 WHERE id=?').bind(s.id).run();
      } else {
        await env.DB.prepare('UPDATE push_subscriptions SET last_success_at=unixepoch(), failure_count=0 WHERE id=?').bind(s.id).run();
      }
    } catch {
      await env.DB.prepare('UPDATE push_subscriptions SET failure_count=failure_count+1 WHERE id=?').bind(s.id).run();
    }
  }
}

async function syncCatalog(_env: Bindings) {
  // O catálogo de itens/mods agora é ESTÁTICO: scripts/build-catalog.mjs gera apps/web/static/data/*.json
  // (atualizado a cada deploy e toda semana pelo workflow). Mantido vazio de propósito: baixar ~6 MB de JSON
  // dentro do Worker estouraria o limite de CPU do plano grátis.
}

async function checkModifiers(env: Bindings) {
  // Atualiza o cache do estado do mundo e notifica quando as Archimedeas ou a Descendia da semana mudam.
  const world = await getWorld(env, true);
  const ids = [world.archimedeas?.map((a) => a.id) ?? null, world.descendia?.id ?? null];
  if (ids[0] === null && ids[1] === null) return; // API fora do ar: não notifica
  const fp = await sha256(JSON.stringify(ids));
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO notification_log (topic,period_id,fingerprint) VALUES (?,?,?)')
    .bind('modifiers_update', weekPeriodId(), fp).run();
  if (ins.meta.changes) {
    await broadcast(env, 'modifiers_update', { title: 'Novidades da semana', body: 'Archimedeas e Descendia atualizadas. Veja os modificadores.', url: 'dashboard' });
  }
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    switch (event.cron) {
      case '0 0 * * 1': // segunda 00:00 UTC = reset semanal (domingo 21:00 em Brasília)
        ctx.waitUntil(broadcast(env, 'weekly_reset', { title: 'Reset semanal!', body: 'Suas tarefas foram reiniciadas. Bora farmar.', url: '/dashboard' }));
        break;
      case '0 */6 * * *':
        ctx.waitUntil(Promise.all([syncCatalog(env), checkModifiers(env)]));
        break;
    }
  },
};

/* wrangler.toml (trecho)
name = "warframe-api"
main = "src/index.ts"
compatibility_date = "2026-01-01"
[[d1_databases]]   binding = "DB"  database_name = "warframe-db"  database_id = "..."
[[kv_namespaces]]  binding = "KV"  id = "..."
[triggers]         crons = ["0 0 * * 1", "0 *\/6 * * *"]
Secrets: wrangler secret put JWT_SECRET | VAPID_PRIVATE_KEY | ADMIN_EMAIL | ADMIN_PASSWORD
Vars:    APP_URL, VAPID_PUBLIC_KEY, VAPID_SUBJECT
Gerar VAPID: npx web-push generate-vapid-keys
*/
