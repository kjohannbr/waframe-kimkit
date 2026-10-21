// src/index.ts — Cloudflare Worker + Hono
// deps: hono, @block65/webcrypto-web-push (Web Push compatível com Workers; o pacote `web-push` NÃO roda em Workers)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { buildPushPayload } from '@block65/webcrypto-web-push';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  MAIL_FROM?: string; // opcional; padrão = remetente de teste do Resend (só entrega para o e-mail dono da conta)
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
const MAGIC_TTL = 60 * 15; // 15 min

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Período do reset semanal: o reset do Warframe ocorre toda segunda 00:00 UTC. */
export function weekPeriodId(d = new Date()) {
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (monday.getUTCDay() + 6) % 7; // 0 = segunda
  monday.setUTCDate(monday.getUTCDate() - dow);
  return monday.toISOString().slice(0, 10); // ex: "2026-10-19"
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

// ───────────── AUTH (Magic Link) ─────────────
app.post('/api/auth/request', async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return c.json({ error: 'invalid_email' }, 400);

  // rate limit simples: 1 pedido / 60s por e-mail
  const rl = `rl:magic:${email.toLowerCase()}`;
  if (await c.env.KV.get(rl)) return c.json({ ok: true }); // resposta uniforme
  await c.env.KV.put(rl, '1', { expirationTtl: 60 });

  const token = crypto.randomUUID() + crypto.randomUUID();
  await c.env.KV.put(`magic:${await sha256(token)}`, email.toLowerCase(), { expirationTtl: MAGIC_TTL });

  const link = `${c.env.APP_URL}/?token=${token}`; // a home do SPA troca o token por sessão
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: c.env.MAIL_FROM ?? 'Warframe Toolkit <onboarding@resend.dev>',
      to: email,
      subject: 'Seu link de acesso',
      html: `<p>Clique para entrar (válido por 15 min):</p><p><a href="${link}">Entrar</a></p>`,
    }),
  });
  return c.json({ ok: true });
});

app.post('/api/auth/verify', async (c) => {
  const { token } = await c.req.json<{ token: string }>();
  const key = `magic:${await sha256(token ?? '')}`;
  const email = await c.env.KV.get(key);
  if (!email) return c.json({ error: 'invalid_or_expired' }, 400);
  await c.env.KV.delete(key); // uso único

  let user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    const id = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email),
      c.env.DB.prepare('INSERT INTO user_prefs (user_id) VALUES (?)').bind(id),
    ]);
    user = { id };
  }
  await c.env.DB.prepare('UPDATE users SET last_login_at = unixepoch() WHERE id = ?').bind(user.id).run();

  const sid = crypto.randomUUID();
  await c.env.KV.put(`sess:${sid}`, user.id, { expirationTtl: SESSION_TTL });
  const jwt = await sign({ sub: user.id, sid, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }, c.env.JWT_SECRET);
  return c.json({ ok: true, token: jwt });
});

app.post('/api/auth/logout', requireAuth, async (c) => {
  const p = await verify(c.req.header('Authorization')!.replace(/^Bearer /, ''), c.env.JWT_SECRET, 'HS256');
  await c.env.KV.delete(`sess:${p.sid}`);
  return c.json({ ok: true });
});

app.get('/api/me', requireAuth, async (c) => {
  const u = await c.env.DB.prepare('SELECT id,email,display_name,timezone FROM users WHERE id = ?').bind(c.get('userId')).first();
  return c.json(u);
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

// ───────────── KANBAN DE RESETS ─────────────
app.get('/api/tasks', requireAuth, async (c) => {
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

async function syncCatalog(env: Bindings) {
  // TODO: baixar warframe-items (GitHub raw / npm) e upsert em items/mods/arcanes/incarnon_perks/riven_dispositions
  // Dica: processar em lotes de ≤100 statements por db.batch() e guardar o hash da versão no KV para pular se não mudou.
}

async function checkModifiers(env: Bindings) {
  // Consulta api.warframestat.us (ex.: /pc/archimedeas ou /pc/deepArchimedea — confira o endpoint atual),
  // calcula fingerprint dos modificadores e notifica só se mudou.
  const res = await fetch('https://api.warframestat.us/pc/archimedeas');
  if (!res.ok) return;
  const fp = await sha256(JSON.stringify(await res.json()));
  const period = weekPeriodId();
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO notification_log (topic,period_id,fingerprint) VALUES (?,?,?)')
    .bind('modifiers_update', period, fp).run();
  if (ins.meta.changes) {
    await broadcast(env, 'modifiers_update', { title: 'Modificadores atualizados', body: 'Novos modificadores de Archimedea disponíveis.', url: '/dashboard' });
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
Secrets: wrangler secret put JWT_SECRET | RESEND_API_KEY | VAPID_PRIVATE_KEY
Vars:    APP_URL, VAPID_PUBLIC_KEY, VAPID_SUBJECT
Gerar VAPID: npx web-push generate-vapid-keys
*/
