// src/world.ts — "estado do mundo" do Warframe (Archimedeas, Descendia, mercadores, Circuit…)
// Busca em api.warframestat.us e normaliza para o formato que o front usa.
// Sem imports: roda no Worker e também direto no Node (testes).
//
// Os campos seguem o pacote oficial `warframe-worldstate-parser` (modelos Archimedea, Descendia,
// VoidTrader, SteelPathOffering, DuviriCycle, Nightwave). Tudo é lido de forma defensiva: um campo
// ausente ou com tipo inesperado vira vazio/null em vez de derrubar a seção.

export const DEFAULT_BASE = 'https://api.warframestat.us/pc';

type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ───────────── Texto ─────────────

/**
 * Nomes que a API não traduz vêm com letras separadas ("M P V Protea Prime", "C T_ L A B").
 * Junta sequências de 2+ letras soltas: "MPV Protea Prime", "CTLAB".
 */
export function tidy(input: unknown): string {
  const tokens = str(input).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 2) out.push(run.join('').replace(/_/g, ''));
    else out.push(...run.map((t) => t.replace(/_/g, '')));
    run = [];
  };
  for (const t of tokens) {
    if (/^[A-Za-z]_?$/.test(t)) run.push(t);
    else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out.join(' ');
}

/** Descrições: tira marcações <...> e espaços repetidos. */
export const clean = (v: unknown) => str(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** "/Lotus/.../FrozenLightEximus" → "Frozen Light Eximus" */
export function humanize(uniqueName: string): string {
  const last = str(uniqueName).split('/').filter(Boolean).pop() ?? '';
  return last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
}

const nameOf = (x: unknown): string => {
  if (typeof x === 'string') return tidy(x);
  if (!isObj(x)) return '';
  return tidy(x.name) || humanize(str(x.uniqueName));
};

// ───────────── Semana do jogo ─────────────

/** O reset semanal é segunda 00:00 UTC. */
export function weekWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { id: start.toISOString().slice(0, 10), start: start.toISOString(), end: end.toISOString() };
}

// ───────────── Tipos normalizados ─────────────

export type ArchKind = 'deep' | 'temporal' | 'unknown';
export type NRisk = { name: string; description: string; elite: boolean };
export type NMission = {
  faction: string;
  missionType: string;
  deviation: { name: string; description: string } | null;
  risks: NRisk[];
};
export type NArchimedea = {
  id: string;
  kind: ArchKind;
  title: string;
  place: string;
  activation: string | null;
  expiry: string | null;
  missions: NMission[];
  personalModifiers: { name: string; description: string }[];
};
export type NInfernum = { index: number; objective: string; content: string; level: string; penances: string[] };
export type NDescendia = { id: string; activation: string | null; expiry: string | null; challenges: NInfernum[] };
export type NTraderItem = { name: string; ducats: number | null; credits: number | null };
export type NTrader = {
  name: string;
  location: string;
  activation: string | null;
  expiry: string | null;
  inventory: NTraderItem[];
};
export type NReward = { name: string; cost: number | null };
export type NSteelPath = {
  current: NReward | null;
  rotation: NReward[];
  evergreens: NReward[];
  activation: string | null;
  expiry: string | null;
};
export type NArchon = {
  boss: string;
  faction: string;
  missions: { type: string; node: string }[];
  activation: string | null;
  expiry: string | null;
};
export type NCircuit = { normal: string[]; steelPath: string[] };
export type NNightwaveAct = {
  title: string;
  desc: string;
  reputation: number | null;
  kind: 'daily' | 'weekly' | 'elite';
  expiry: string | null;
};
export type NNightwave = { season: number | null; tag: string; acts: NNightwaveAct[] };

// ───────────── Normalizadores ─────────────

export function archimedeaKind(typeKey: unknown, type: unknown): ArchKind {
  const k = `${str(typeKey)}${str(type)}`.replace(/[\s_]+/g, '').toUpperCase();
  if (k.includes('LAB') || k.includes('DEEP')) return 'deep';
  if (k.includes('HEX') || k.includes('TEMPORAL')) return 'temporal';
  return 'unknown';
}

const ARCH_INFO: Record<ArchKind, { title: string; place: string }> = {
  deep: { title: 'Deep Archimedea', place: "Albrecht's Laboratories (Deimos)" },
  temporal: { title: 'Temporal Archimedea', place: 'The Hex · Höllvania (1999)' },
  unknown: { title: 'Archimedea', place: '' }
};

export function normArchimedeas(raw: unknown): NArchimedea[] {
  return arr(raw)
    .filter(isObj)
    .map((a) => {
      const kind = archimedeaKind(a.typeKey, a.type);
      const info = ARCH_INFO[kind];
      return {
        id: str(a.id),
        kind,
        title: kind === 'unknown' ? tidy(a.type) || info.title : info.title,
        place: info.place,
        activation: iso(a.activation),
        expiry: iso(a.expiry),
        missions: arr(a.missions)
          .filter(isObj)
          .map((m) => {
            const dev = isObj(m.deviation) ? m.deviation : null;
            return {
              faction: tidy(m.faction),
              missionType: tidy(m.missionType),
              deviation: dev ? { name: tidy(dev.name) || humanize(str(dev.key)), description: clean(dev.description) } : null,
              risks: arr(m.risks)
                .filter(isObj)
                .map((r) => ({
                  name: tidy(r.name) || humanize(str(r.key)),
                  description: clean(r.description),
                  elite: r.isHard === true
                }))
            };
          }),
        personalModifiers: arr(a.personalModifiers)
          .filter(isObj)
          .map((p) => ({ name: tidy(p.name) || humanize(str(p.key)), description: clean(p.description) }))
      };
    });
}

export function normDescendia(raw: unknown): NDescendia | null {
  const d = Array.isArray(raw) ? raw[0] : raw;
  if (!isObj(d)) return null;
  const items = arr(d.challenges).filter(isObj);
  const idx = items.map((c) => num(c.index));
  // A API pode numerar os andares a partir de 0 ou de 1: se aparecer o 0, o andar é índice + 1.
  const shift = idx.some((i) => i === 0) ? 1 : 0;
  const challenges = items
    .map((c, pos) => {
      const objective = tidy(c.type);
      const content = tidy(c.challenge);
      return {
        index: idx[pos] === null ? pos + 1 : (idx[pos] as number) + shift,
        objective,
        content: content && content !== objective ? content : '',
        level: tidy(c.level),
        // "specs" = mistura de inimigos, "auras" = efeitos; o jogo chama os dois de Penitências
        penances: [...arr(c.specs), ...arr(c.auras)].map(nameOf).filter(Boolean)
      };
    })
    .filter((c) => c.index > 0 && (c.objective || c.content || c.penances.length))
    .sort((a, b) => a.index - b.index);
  if (!challenges.length) return null;
  return { id: str(d.id), activation: iso(d.activation), expiry: iso(d.expiry), challenges };
}

/** Baro (voidTrader) e Varzia (vaultTrader) usam o mesmo modelo. Preço ausente chega como null/NaN. */
export function normTrader(raw: unknown): NTrader | null {
  const t = Array.isArray(raw) ? raw[0] : raw;
  if (!isObj(t)) return null;
  return {
    name: tidy(t.character),
    location: tidy(t.location),
    activation: iso(t.activation),
    expiry: iso(t.expiry),
    inventory: arr(t.inventory)
      .filter(isObj)
      .map((i) => ({ name: tidy(i.item) || humanize(str(i.uniqueName)), ducats: num(i.ducats), credits: num(i.credits) }))
      .filter((i) => i.name)
  };
}

const reward = (x: unknown): NReward | null =>
  isObj(x) && str(x.name) ? { name: tidy(x.name), cost: num(x.cost) } : null;

export function normSteelPath(raw: unknown): NSteelPath | null {
  if (!isObj(raw)) return null;
  const list = (v: unknown) => arr(v).map(reward).filter((r): r is NReward => r !== null);
  const current = reward(raw.currentReward);
  const rotation = list(raw.rotation);
  if (!current && !rotation.length) return null;
  return { current, rotation, evergreens: list(raw.evergreens), activation: iso(raw.activation), expiry: iso(raw.expiry) };
}

export function normArchon(raw: unknown): NArchon | null {
  if (!isObj(raw) || !str(raw.boss)) return null;
  return {
    boss: tidy(raw.boss),
    faction: tidy(raw.faction),
    missions: arr(raw.missions)
      .filter(isObj)
      .map((m) => ({ type: tidy(m.type), node: tidy(m.node) })),
    activation: iso(raw.activation),
    expiry: iso(raw.expiry)
  };
}

/** Rotação semanal de recompensas do Circuit (Duviri): normal = Warframes, hard = Incarnon Genesis (Steel Path). */
export function normCircuit(raw: unknown): NCircuit | null {
  if (!isObj(raw)) return null;
  const pick = (cat: string) =>
    arr(raw.choices)
      .filter(isObj)
      .filter((c) => str(c.category) === cat)
      .flatMap((c) => arr(c.choices).map(tidy))
      .filter(Boolean);
  const normal = pick('normal');
  const steelPath = pick('hard');
  return normal.length || steelPath.length ? { normal, steelPath } : null;
}

export function normNightwave(raw: unknown): NNightwave | null {
  if (!isObj(raw)) return null;
  const acts = arr(raw.activeChallenges)
    .filter(isObj)
    .map((c): NNightwaveAct => {
      const desc = clean(c.desc);
      return {
        title: clean(c.title),
        desc: desc.startsWith('[PH]') ? '' : desc, // o jogo às vezes manda texto provisório
        reputation: num(c.reputation),
        kind: c.isDaily === true ? 'daily' : c.isElite === true ? 'elite' : 'weekly',
        expiry: iso(c.expiry)
      };
    })
    .filter((a) => a.title);
  if (!acts.length) return null;
  return { season: num(raw.season), tag: tidy(raw.tag), acts };
}

// ───────────── Montagem do snapshot ─────────────

export type World = {
  fetchedAt: string;
  week: { id: string; start: string; end: string };
  archimedeas: NArchimedea[] | null;
  descendia: NDescendia | null;
  baro: NTrader | null;
  varzia: NTrader | null;
  steelPath: NSteelPath | null;
  archon: NArchon | null;
  circuit: NCircuit | null;
  nightwave: NNightwave | null;
  /** seções que falharam (mensagem curta) */
  errors: Record<string, string>;
  /** seções que vieram do cache por falha ao atualizar */
  stale: string[];
  /** quando cada seção foi obtida de fato */
  times: Record<string, string>;
};

type SectionKey = Exclude<keyof World, 'fetchedAt' | 'week' | 'errors' | 'stale' | 'times'>;

export const SECTIONS: Record<SectionKey, { path: string; norm: (raw: unknown) => unknown }> = {
  archimedeas: { path: 'archimedeas', norm: normArchimedeas },
  descendia: { path: 'descendia', norm: normDescendia },
  baro: { path: 'voidTrader', norm: normTrader },
  varzia: { path: 'vaultTrader', norm: normTrader },
  steelPath: { path: 'steelPath', norm: normSteelPath },
  archon: { path: 'archonHunt', norm: normArchon },
  circuit: { path: 'duviriCycle', norm: normCircuit },
  nightwave: { path: 'nightwave', norm: normNightwave }
};
export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

export async function fetchWorld(
  base: string = DEFAULT_BASE,
  fetcher: typeof fetch = fetch,
  now = new Date(),
  timeoutMs = 8000
): Promise<World> {
  const world: World = {
    fetchedAt: now.toISOString(),
    week: weekWindow(now),
    archimedeas: null,
    descendia: null,
    baro: null,
    varzia: null,
    steelPath: null,
    archon: null,
    circuit: null,
    nightwave: null,
    errors: {},
    stale: [],
    times: {}
  };

  await Promise.all(
    SECTION_KEYS.map(async (key) => {
      const { path, norm } = SECTIONS[key];
      try {
        const res = await fetcher(`${base.replace(/\/$/, '')}/${path}?language=en`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const value = norm(await res.json());
        const empty = value === null || (Array.isArray(value) && value.length === 0);
        if (empty) throw new Error('sem dados');
        (world as any)[key] = value;
        world.times[key] = world.fetchedAt;
      } catch (e) {
        world.errors[key] = e instanceof Error ? e.message.slice(0, 80) : 'erro';
      }
    })
  );
  return world;
}

/** Seções que falharam são completadas com o cache — só da mesma semana e com menos de 6h. */
export function mergeStale(fresh: World, cached: World | null | undefined, now = new Date(), maxAgeMs = 6 * 3600_000): World {
  if (!cached || cached.week?.id !== fresh.week.id) return fresh;
  for (const key of SECTION_KEYS) {
    if (fresh[key] != null || cached[key] == null) continue;
    const at = Date.parse(cached.times?.[key] ?? '');
    if (!Number.isFinite(at) || now.getTime() - at > maxAgeMs) continue;
    (fresh as any)[key] = cached[key];
    fresh.times[key] = cached.times[key];
    fresh.stale.push(key);
  }
  return fresh;
}

export const hasAnyData = (w: World) => SECTION_KEYS.some((k) => w[k] != null);
