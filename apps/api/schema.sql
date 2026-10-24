-- Cloudflare D1 (SQLite) — Warframe Toolkit
-- Aplicar: wrangler d1 execute warframe-db --file=schema.sql
PRAGMA foreign_keys = ON;

-- ───────────── USUÁRIOS ─────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                 -- uuid
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT,
  timezone      TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  password_hash TEXT,                              -- pbkdf2$iter$salt$hash (admin usa o secret ADMIN_PASSWORD)
  role          TEXT NOT NULL DEFAULT 'user',      -- user | admin
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER
);

-- ───────────── CATÁLOGO (cache do warframe-items / warframe-status) ─────────────
CREATE TABLE IF NOT EXISTS items (
  unique_name  TEXT PRIMARY KEY,                  -- ex: /Lotus/Weapons/...
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,                     -- warframe|primary|secondary|melee|sentinel|archwing|...
  category     TEXT,
  is_prime     INTEGER NOT NULL DEFAULT 0,
  variant      TEXT,                              -- prime|kuva|tenet|coda|prisma|incarnon...
  data_json    TEXT NOT NULL,                     -- stats base completos
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_items_type_name ON items(type, name);

CREATE TABLE IF NOT EXISTS mods (
  unique_name  TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  compat_name  TEXT,                              -- categoria de compatibilidade
  type         TEXT,                              -- Primary|Secondary|Melee|Warframe|Aura|Stance|Arcane|Shard...
  polarity     TEXT,
  base_drain   INTEGER,
  max_rank     INTEGER,
  is_exilus    INTEGER NOT NULL DEFAULT 0,
  is_utility   INTEGER NOT NULL DEFAULT 0,
  data_json    TEXT NOT NULL,                     -- efeitos por rank
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_mods_type ON mods(type, compat_name);

CREATE TABLE IF NOT EXISTS arcanes (
  unique_name TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slot_type   TEXT,                               -- warframe|primary|secondary|melee|operator
  data_json   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS archon_shards (
  id         TEXT PRIMARY KEY,                    -- ex: crimson_1
  color      TEXT NOT NULL,                       -- crimson|amber|azure|violet|emerald|topaz
  tauforged  INTEGER NOT NULL DEFAULT 0,
  effect     TEXT NOT NULL,
  value      REAL NOT NULL,
  unit       TEXT
);

-- Incarnon: perks por tier (2..5) que alteram stats base da arma antes dos mods
CREATE TABLE IF NOT EXISTS incarnon_perks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  weapon_unique TEXT NOT NULL REFERENCES items(unique_name) ON DELETE CASCADE,
  tier          INTEGER NOT NULL CHECK (tier BETWEEN 2 AND 5),
  option_index  INTEGER NOT NULL,
  description   TEXT NOT NULL,
  modifiers_json TEXT NOT NULL,                   -- ex: [{"stat":"crit_chance","op":"add","value":0.1}]
  UNIQUE (weapon_unique, tier, option_index)
);

CREATE TABLE IF NOT EXISTS riven_dispositions (
  weapon_unique TEXT PRIMARY KEY,
  weapon_name   TEXT NOT NULL,
  disposition   INTEGER NOT NULL CHECK (disposition BETWEEN 1 AND 5),
  multiplier    REAL NOT NULL,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ───────────── BUILDS ─────────────
CREATE TABLE IF NOT EXISTS builds (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_unique   TEXT NOT NULL,                    -- warframe ou arma
  item_type     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  visibility    TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public','unlisted')),
  share_slug    TEXT UNIQUE,                      -- link curto compartilhável
  config_json   TEXT NOT NULL,                    -- slots, polaridades, forma, reator, arcanos, shards, incarnon, riven
  stats_cache   TEXT,                             -- último resultado calculado (opcional)
  favorites_cnt INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_builds_user ON builds(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_builds_public ON builds(visibility, item_unique, favorites_cnt DESC);

CREATE TABLE IF NOT EXISTS build_favorites (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  build_id   TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, build_id)
);

-- ───────────── RIVENS SALVOS ─────────────
CREATE TABLE IF NOT EXISTS rivens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weapon_unique TEXT NOT NULL,
  polarity      TEXT,
  rank          INTEGER NOT NULL DEFAULT 8,
  mastery_rank  INTEGER,
  rerolls       INTEGER NOT NULL DEFAULT 0,
  stats_json    TEXT NOT NULL,                    -- [{"stat":"crit_chance","value":187.4,"negative":false}, ...]
  price_cache   TEXT,                             -- {"min":..,"median":..,"max":..,"n":..,"fetched_at":..}
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rivens_user ON rivens(user_id);

-- ───────────── DASHBOARD DE RESETS (Kanban) ─────────────
CREATE TABLE IF NOT EXISTS task_templates (
  key         TEXT PRIMARY KEY,                   -- ex: deep_archimedea, netracells, circuit
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,                      -- archimedea|hex|netracells|archon|duviri|vendor
  cadence     TEXT NOT NULL CHECK (cadence IN ('weekly','daily','biweekly')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  meta_json   TEXT
);

CREATE TABLE IF NOT EXISTS user_tasks (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key   TEXT NOT NULL REFERENCES task_templates(key) ON DELETE CASCADE,
  period_id  TEXT NOT NULL,                       -- ex: 2026-W43 (período do reset)
  status     TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  note       TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, task_key, period_id)
);

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hidden_tasks   TEXT NOT NULL DEFAULT '[]',      -- JSON array de task_keys ocultas
  notify_reset   INTEGER NOT NULL DEFAULT 1,
  notify_rotation INTEGER NOT NULL DEFAULT 1,
  theme          TEXT NOT NULL DEFAULT 'dark'
);

-- ───────────── WEB PUSH ─────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint       TEXT NOT NULL UNIQUE,
  p256dh         TEXT NOT NULL,
  auth           TEXT NOT NULL,
  expiration_time INTEGER,
  topics         TEXT NOT NULL DEFAULT '["weekly_reset","modifiers_update"]',
  user_agent     TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  last_success_at INTEGER,
  failure_count  INTEGER NOT NULL DEFAULT 0       -- remover após N falhas / HTTP 404|410
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  topic      TEXT NOT NULL,
  period_id  TEXT NOT NULL,
  fingerprint TEXT,                               -- hash dos modificadores (evita reenviar)
  sent_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (topic, period_id, fingerprint)
);

-- ───────────── SEED DO KANBAN ─────────────
-- (mesma lista de src/tasks.ts; o Worker também faz upsert dela no D1)
INSERT INTO task_templates (key, title, category, cadence, sort_order) VALUES
 ('deep_archimedea', 'Deep Archimedea', 'archimedea', 'weekly', 10),
 ('elite_deep_archimedea', 'Elite Deep Archimedea', 'archimedea', 'weekly', 11),
 ('temporal_archimedea', 'Temporal Archimedea (1999)', 'archimedea', 'weekly', 12),
 ('elite_temporal_archimedea', 'Elite Temporal Archimedea', 'archimedea', 'weekly', 13),
 ('descendia', 'The Descendia', 'descendia', 'weekly', 15),
 ('descendia_steel_path', 'The Descendia (Steel Path)', 'descendia', 'weekly', 16),
 ('hex_holvania', 'Höllvania / Conteúdos do Hex', 'hex', 'weekly', 20),
 ('netracells', 'Netracells', 'netracells', 'weekly', 30),
 ('archon_hunt', 'Archon Hunt', 'archon', 'weekly', 31),
 ('kahl_garrison', 'Kahl''s Garrison (Break Narmer)', 'kahl', 'weekly', 32),
 ('nightwave_weekly', 'Nightwave: atos semanais', 'nightwave', 'weekly', 35),
 ('circuit', 'The Circuit (Duviri)', 'duviri', 'weekly', 40),
 ('circuit_steel_path', 'The Circuit (Steel Path)', 'duviri', 'weekly', 41),
 ('vendor_iron_wake', 'Iron Wake / Palladino (Riven Slivers)', 'vendor', 'weekly', 50),
 ('vendor_teshin', 'Teshin (Steel Path Honors)', 'vendor', 'weekly', 51),
 ('vendor_varzia', 'Varzia (Prime Resurgence)', 'vendor', 'weekly', 52),
 ('vendor_maroo', 'Maroo (Ayatan Treasure Hunt)', 'vendor', 'weekly', 53),
 ('vendor_acrithis', 'Acrithis (5 itens da semana)', 'vendor', 'weekly', 54)
ON CONFLICT(key) DO UPDATE SET title=excluded.title, category=excluded.category, cadence=excluded.cadence, sort_order=excluded.sort_order;
