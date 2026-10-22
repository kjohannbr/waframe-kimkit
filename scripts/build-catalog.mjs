// Gera o catálogo estático do site a partir do projeto WFCD/warframe-items.
//   node scripts/build-catalog.mjs
// Saída: apps/web/static/data/{items,mods,meta}.json
// Se o download falhar e já existir um catálogo gerado, mantém o anterior (o build não quebra).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'static', 'data');
const SRC = 'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json';

const get = async (name) => {
  const res = await fetch(`${SRC}/${name}.json`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
};

// Prefixos de variante: o mod "Sobek" serve para "Kuva Sobek", "Akbronco" para "Akbronco Prime"…
const VARIANT = /^(kuva|tenet|coda|prisma|vandal|wraith|mara|rakta|sancti|secura|telos|synoid|dex|carmine|ceti|ruvox|vaykor|steel meridian)\s+/i;
const baseNames = (name) => {
  const out = new Set([name]);
  let n = name.replace(/\s+(prime|umbra)$/i, '');
  out.add(n);
  out.add(n.replace(VARIANT, ''));
  return [...out].map((x) => x.trim());
};

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));
const round = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);
const num = (o, keys) => Object.fromEntries(keys.filter((k) => typeof o[k] === 'number').map((k) => [k, round(o[k])]));

// Como cada fonte de itens se liga aos mods: tipos de mod aceitos + categorias de compatibilidade.
const SOURCES = [
  { file: 'Warframes', label: 'Warframe', slotKind: 'warframe', modTypes: ['Warframe Mod'], compat: (i) => ['WARFRAME', ...baseNames(i.name)], aura: true },
  {
    file: 'Primary', label: 'Primária', slotKind: 'weapon',
    modTypes: (i) => (i.type === 'Shotgun' ? ['Primary Mod', 'Shotgun Mod'] : ['Primary Mod']),
    compat: (i) => ['PRIMARY', ...({ Rifle: ['Rifle', 'Assault Rifle'], Shotgun: ['Shotgun'], Sniper: ['Sniper'], Bow: ['Bow'] }[i.type] ?? []), ...baseNames(i.name)],
  },
  {
    file: 'Secondary', label: 'Secundária', slotKind: 'weapon',
    modTypes: ['Secondary Mod'],
    compat: (i) => ['SECONDARY', ...(i.type === 'Throwing' ? ['Thrown'] : ['Pistol']), ...(/grimoire/i.test(i.name) ? ['Tome'] : []), ...baseNames(i.name)],
  },
  {
    file: 'Melee', label: 'Melee', slotKind: 'weapon', stance: true,
    modTypes: ['Melee Mod'],
    compat: (i) => ['Melee', ...baseNames(i.name)],
    skip: (i) => i.type === 'Zaw Component',
  },
  { file: 'Arch-Gun', label: 'Arch-Gun', slotKind: 'weapon', modTypes: ['Arch-Gun Mod'], compat: (i) => ['Archgun', ...baseNames(i.name)] },
  { file: 'Arch-Melee', label: 'Arch-Melee', slotKind: 'weapon', modTypes: ['Arch-Melee Mod'], compat: (i) => ['Arch-Melee', 'Archmelee', ...baseNames(i.name)] },
  { file: 'Archwing', label: 'Archwing', slotKind: 'warframe', modTypes: ['Archwing Mod'], compat: (i) => ['Archwing', ...baseNames(i.name)] },
  { file: 'Sentinels', label: 'Sentinela', slotKind: 'warframe', modTypes: ['Companion Mod'], compat: (i) => ['COMPANION', 'ROBOTIC', 'Sentinel', ...baseNames(i.name)] },
  { file: 'SentinelWeapons', label: 'Arma de Sentinela', slotKind: 'weapon', modTypes: [], compat: () => [] }, // mods ainda não mapeados
];

const WEAPON_STATS = ['totalDamage', 'criticalChance', 'criticalMultiplier', 'procChance', 'fireRate', 'reloadTime', 'magazineSize', 'multishot', 'accuracy', 'range', 'disposition', 'followThrough', 'comboDuration', 'blockingAngle'];
const FRAME_STATS = ['health', 'shield', 'armor', 'power', 'sprintSpeed', 'stamina'];

function buildItem(raw, src) {
  const name = String(raw.name).trim();
  return {
    name,
    id: raw.uniqueName,
    category: src.label,
    type: raw.type,
    image: raw.imageName,
    prime: !!raw.isPrime,
    tags: (raw.tags ?? []).slice(0, 6),
    mastery: raw.masteryReq ?? 0,
    slotKind: src.slotKind,
    polarities: raw.polarities ?? [],
    ...(raw.aura ? { aura: raw.aura } : {}),
    ...(raw.exilusPolarity ? { exilusPolarity: raw.exilusPolarity } : {}),
    ...(raw.stancePolarity ? { stancePolarity: raw.stancePolarity } : {}),
    stats: src.slotKind === 'warframe' ? num(raw, FRAME_STATS) : num(raw, WEAPON_STATS),
    ...(raw.damage && typeof raw.damage === 'object' ? { damage: raw.damage } : {}),
    ...(raw.trigger ? { trigger: raw.trigger } : {}),
    modTypes: typeof src.modTypes === 'function' ? src.modTypes(raw) : src.modTypes,
    compat: [...new Set(src.compat(raw).map((c) => c.trim()))],
    hasAura: !!src.aura,
    hasStance: !!src.stance,
  };
}

function buildMods(raw) {
  // O dataset repete mods (versões antigas/hidden): fica a de maior rank e que tenha estatísticas.
  const best = new Map();
  for (const m of raw) {
    if (!m.name || /riven mod$/i.test(m.type ?? '')) continue;
    const key = `${m.name}|${m.type}|${(m.compatName ?? '').trim()}`;
    const cur = best.get(key);
    const score = (m.fusionLimit ?? 0) * 10 + (m.levelStats?.length ? 5 : 0) + (m.imageName ? 1 : 0);
    if (!cur || score > cur.score) best.set(key, { m, score });
  }
  return [...best.values()]
    .map(({ m }) => ({
      name: m.name.trim(),
      id: m.uniqueName,
      type: m.type,
      compat: (m.compatName ?? '').trim(),
      polarity: m.polarity ?? null,
      drain: m.baseDrain ?? 0,
      maxRank: m.fusionLimit ?? 0,
      rarity: m.rarity ?? null,
      image: m.imageName,
      stats: m.levelStats?.length ? (m.levelStats[m.levelStats.length - 1].stats ?? []) : [],
      ...(m.isAugment ? { augment: true } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const [modsRaw, ...groups] = await Promise.all([get('Mods'), ...SOURCES.map((s) => get(s.file))]);
  const items = [];
  SOURCES.forEach((src, i) => {
    for (const raw of groups[i]) {
      if (!raw.name || !raw.imageName || src.skip?.(raw)) continue;
      items.push(buildItem(raw, src));
    }
  });
  items.sort((a, b) => a.name.localeCompare(b.name));
  const mods = buildMods(modsRaw);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'items.json'), JSON.stringify(items));
  writeFileSync(join(OUT, 'mods.json'), JSON.stringify(mods));
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify({ generatedAt: new Date().toISOString(), items: items.length, mods: mods.length, source: 'WFCD/warframe-items' }));
  console.log(`✔ catálogo: ${items.length} itens, ${mods.length} mods`);
}

main().catch((err) => {
  if (existsSync(join(OUT, 'items.json')) && existsSync(join(OUT, 'mods.json'))) {
    console.warn(`⚠ Falha ao atualizar o catálogo (${err.message}). Mantendo o último catálogo gerado.`);
    return;
  }
  console.error(`✖ Falha ao gerar o catálogo: ${err.message}`);
  process.exit(1);
});
