// Catálogo estático (gerado por scripts/build-catalog.mjs) + busca com autocomplete.
// Sem imports de SvelteKit aqui, para poder testar a busca direto no Node.

export type Item = {
  name: string;
  id: string;
  category: string;
  type: string;
  image: string;
  prime: boolean;
  tags: string[];
  mastery: number;
  slotKind: 'weapon' | 'warframe';
  polarities: string[];
  aura?: string;
  exilusPolarity?: string;
  stancePolarity?: string;
  stats: Record<string, number>;
  damage?: Record<string, number>;
  trigger?: string;
  modTypes: string[];
  compat: string[];
  hasAura: boolean;
  hasStance: boolean;
};

export type Mod = {
  name: string;
  id: string;
  type: string;
  compat: string;
  polarity: string | null;
  drain: number;
  maxRank: number;
  rarity: string | null;
  image: string;
  stats: string[];
  augment?: boolean;
};

export const IMG_CDN = 'https://cdn.warframestat.us/img/';
export const imageUrl = (file: string) => IMG_CDN + encodeURIComponent(file);

// ───────────── Busca ─────────────

/** minúsculas, sem acentos, espaços normalizados */
export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export type Searchable<T> = T & { _n: string };

export function prepare<T extends { name: string }>(list: T[]): Searchable<T>[] {
  return list.map((x) => ({ ...x, _n: norm(x.name) }));
}

/**
 * Autocomplete por "contém", em qualquer posição do nome (não só no começo).
 *  - "nukor"  → Nukor, Kuva Nukor
 *  - "so"     → Soma, Sobek, Sonicor… e também Aksomati, Twin Basolk (contêm "so")
 *  - "kuva nuk" → Kuva Nukor (todas as palavras digitadas precisam aparecer)
 * Ordem: nome exato → começa com o texto → começa uma palavra → contém em qualquer lugar.
 */
export function search<T extends { name: string }>(
  list: Searchable<T>[],
  query: string,
  { limit = 60, filter }: { limit?: number; filter?: (x: T) => boolean } = {}
): Searchable<T>[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const scored: { x: Searchable<T>; score: number }[] = [];

  for (const x of list) {
    if (filter && !filter(x)) continue;
    const n = x._n;
    if (!tokens.every((t) => n.includes(t))) continue;

    let score: number;
    if (n === q) score = 0;
    else if (n.startsWith(q)) score = 1;
    else if (n.includes(' ' + q)) score = 2;
    else if (tokens.every((t) => n.startsWith(t) || n.includes(' ' + t))) score = 3;
    else score = 4 + n.indexOf(tokens[0]) / 100;
    scored.push({ x, score });
  }

  scored.sort((a, b) => a.score - b.score || a.x.name.length - b.x.name.length || a.x.name.localeCompare(b.x.name));
  return scored.slice(0, limit).map((s) => s.x);
}

/** Divide o nome em [antes, trecho encontrado, depois] para destacar o que foi digitado. */
export function highlight(name: string, query: string): [string, string, string] {
  const q = norm(query);
  const n = norm(name);
  if (!q || n.length !== name.length) return [name, '', ''];
  const i = n.indexOf(q);
  if (i < 0) return [name, '', ''];
  return [name.slice(0, i), name.slice(i, i + q.length), name.slice(i + q.length)];
}

// ───────────── Compatibilidade de mods ─────────────

export function compatibleMods<M extends Mod>(mods: M[], item: Item, slot: 'main' | 'aura' | 'stance'): M[] {
  if (slot === 'aura') return mods.filter((m) => m.type === 'Warframe Mod' && m.compat === 'AURA');
  if (slot === 'stance') return mods.filter((m) => m.type === 'Stance Mod');
  const compat = new Set(item.compat);
  const types = new Set(item.modTypes);
  return mods.filter((m) => types.has(m.type) && compat.has(m.compat));
}

// ───────────── Carregamento ─────────────

let cached: Promise<{ items: Searchable<Item>[]; mods: Searchable<Mod>[]; generatedAt: string }> | null = null;

export function loadCatalog(base: string) {
  cached ??= (async () => {
    const [items, mods, meta] = await Promise.all([
      fetch(`${base}/data/items.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('items.json')))),
      fetch(`${base}/data/mods.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('mods.json')))),
      fetch(`${base}/data/meta.json`)
        .then(async (r): Promise<{ generatedAt?: string }> => (r.ok ? await r.json() : {}))
        .catch((): { generatedAt?: string } => ({}))
    ]);
    return { items: prepare<Item>(items), mods: prepare<Mod>(mods), generatedAt: meta.generatedAt ?? '' };
  })().catch((e) => {
    cached = null; // permite tentar de novo
    throw e;
  });
  return cached;
}
