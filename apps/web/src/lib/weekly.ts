// Dados fixos dos resets semanais (o que a API de worldstate NÃO publica) + funções auxiliares.
// Fonte: wiki.warframe.com, conferido em CHECKED_ON. Se o jogo mudar, é só editar este arquivo.
// Sem imports de SvelteKit: roda no navegador e direto no Node (testes).

export const CHECKED_ON = '2026-10-23';

export const WIKI = {
  descendia: 'https://wiki.warframe.com/w/Descendia',
  weeklyReset: 'https://wiki.warframe.com/w/Weekly_Reset',
  circuit: 'https://wiki.warframe.com/w/The_Circuit',
  deepArchimedea: 'https://wiki.warframe.com/w/Deep_Archimedea',
  temporalArchimedea: 'https://wiki.warframe.com/w/Temporal_Archimedea',
  netracells: 'https://wiki.warframe.com/w/Netracells',
  archonHunt: 'https://wiki.warframe.com/w/Archon_Hunt',
  palladino: 'https://wiki.warframe.com/w/Palladino',
  ironWake: 'https://wiki.warframe.com/w/Iron_Wake',
  acrithis: 'https://wiki.warframe.com/w/Acrithis',
  cavalero: 'https://wiki.warframe.com/w/Cavalero',
  kaya: 'https://wiki.warframe.com/w/Kaya',
  yonta: 'https://wiki.warframe.com/w/Archimedean_Yonta',
  bird3: 'https://wiki.warframe.com/w/Bird_3',
  maroo: 'https://wiki.warframe.com/w/Maroo',
  varzia: 'https://wiki.warframe.com/w/Varzia'
} as const;

// ───────────── Tempo ─────────────

/** Próximo reset semanal: segunda-feira 00:00 UTC. */
export function nextReset(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + (((8 - d.getUTCDay()) % 7) || 7));
  return d;
}

/** 273_600_000 ms → "3d 04h 00m". Valores negativos viram "agora". */
export function countdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'agora';
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}h ${pad(mm)}m`;
  if (h > 0) return `${h}h ${pad(mm)}m`;
  return `${mm}m`;
}

// ───────────── Descendia ─────────────

export const DESCENDIA = {
  floors: 21,
  checkpoints: [7, 14, 21],
  sanctuaries: { 7: "Marie's Sanctuary", 14: "Lyon's Sanctuary" } as Record<number, string>,
  level: { normal: '65–85', steel: '165–185' },
  unlock: 'Conclua a quest The Old Peace (acesso pela região Dark Refractory). Com apenas The Teacher há uma prévia, sem matchmaking público até MR 10.'
};

export const ARCANES_25 = [
  'Acceleration', 'Agility', 'Arachne', 'Avenger', 'Awakening', 'Consequence', 'Deflection', 'Eruption', 'Fury', 'Healing', 'Ice',
  'Momentum', 'Nullifier', 'Phantasm', 'Precision', 'Pulse', 'Rage', 'Resistance', 'Strike', 'Tempo', 'Trickery', 'Ultimatum',
  'Velocity', 'Victory', 'Warmth'
];

export const STEEL_ARCANES_9 = [
  'Primary Bulwark', 'Primary Debilitate', 'Primary Overcharge', 'Arcane Concentration', 'Arcane Expertise', 'Arcane Persistence',
  'Arcane Circumvent', 'Secondary Irradiate', 'Melee Careen'
];

export type RewardGroup = { label: string; items: string[]; each?: string; note?: string };
export type FloorReward = { normal?: RewardGroup; steel?: RewardGroup };

const CACHE_NORMAL: RewardGroup = {
  label: 'Recompensa do andar',
  items: ['3× Cache de 10.000 Credits', '2.500 Endo', '50 Vosfor', '25 Ignia', '5 Maphica']
};
const ARCANE_POOL = (each: string): RewardGroup => ({ label: 'Pool de 25 Arcanes', items: ARCANES_25, each });
const STEEL_POOL = (each: string): RewardGroup => ({ label: 'Pool de Arcanes da Steel Path', items: STEEL_ARCANES_9, each });
const STEEL_IGNIA: RewardGroup = { label: 'Recompensa do andar', items: ['75 Ignia', '15 Maphica'] };
const STEEL_MIX: RewardGroup = {
  label: 'Pool de recompensas',
  each: '1× cada',
  items: [
    'Forma Blueprint', 'Riven Mod (Melee / Pistol / Rifle / Shotgun / Zaw / Kitgun)', 'Arcane Adapter (Primary / Secondary / Melee / Amp)',
    '3 Day Affinity Booster', '3 Day Resource Drop Chance Booster', '3 Day Mod Drop Chance Booster'
  ]
};

/** Recompensas por andar. Cada uma pode ser obtida uma vez por semana (reseta segunda 00:00 UTC). */
export const DESCENDIA_REWARDS: Record<number, FloorReward> = {
  2: { normal: CACHE_NORMAL, steel: STEEL_IGNIA },
  4: { normal: CACHE_NORMAL, steel: STEEL_MIX },
  6: { normal: ARCANE_POOL('1× cada'), steel: STEEL_POOL('1× cada') },
  9: { normal: CACHE_NORMAL, steel: STEEL_IGNIA },
  11: { normal: CACHE_NORMAL, steel: STEEL_MIX },
  13: { normal: ARCANE_POOL('1× cada'), steel: STEEL_POOL('1× cada') },
  16: { normal: CACHE_NORMAL, steel: STEEL_IGNIA },
  18: { normal: CACHE_NORMAL, steel: { label: 'Recompensa do andar', items: ['25 Steel Essence'] } },
  20: { normal: ARCANE_POOL('3× cada'), steel: STEEL_POOL('3× cada') },
  21: {
    normal: {
      label: 'Pool de recompensas',
      each: '1× cada',
      items: ['Forma Blueprint', 'Primary Arcane Adapter', 'Secondary Arcane Adapter', 'Melee Arcane Adapter', 'Amp Arcane Adapter']
    },
    steel: {
      label: 'Pool de recompensas',
      each: '1× cada',
      items: [
        'Orokin Catalyst Blueprint', 'Orokin Reactor Blueprint', 'Omni Forma Blueprint',
        'Eidolon Lens Blueprints (Madurai, Vazarin, Zenurik, Naramon, Unairu)', 'Archon Shards: Crimson, Azure, Amber'
      ]
    }
  }
};

export const DESCENDIA_NOTES = [
  'Todas as recompensas dos andares reiniciam na segunda 00:00 UTC. Dá para continuar jogando depois de esgotá-las.',
  'Andar 21 (Roathe): sempre cai um componente de Uriel (Neuroptics, Chassis ou Systems) ou um blueprint/componente de Vinquibus (Primary ou Melee), sem limite semanal. Dá para refazer o andar.',
  'Os andares 7, 14 e 21 são checkpoints: dá para sair sem perder o progresso e voltar depois. Não há auto-revive.',
  'Baús de armazenamento soltam Ignia, Maphica e Harrowing Spire. Cada vitória sobre Roathe dispara uma mensagem no KIM (máx. 7 por dia).'
];

export const BLESSINGS = {
  marie: [
    'Vol Sacré', 'Angelic Balm', 'Shroud of Invisibility', 'Renewed Faith', "Sol's Shield", 'Surging Vulnerability', 'Motes of Prayer',
    'Holy Roller', 'Avian Grace', 'Righteous Celerity', "Congregation's Protection", 'Triumphant Bounty', 'Fervent Gunner', 'Hidden Benevolence'
  ],
  lyon: [
    'Ascendant Penance', 'Restrained Fury', "Faithful's Wager", 'Mutual Suffering', 'Leaded Discipline', 'Sacred Annihilation',
    'Measured Force', 'Ferocious Condemnation', "Lua's Blessing", 'Nullified Nullifiers', 'Ascetic Munitions', "Sharpshooter's Benediction",
    'Hollow Decimation', "Sinner's Tithe", 'Flowing Slayer', "Agony's Enlightenment", 'Rejuvenating Temperance', 'Haunted Strength',
    'Steadfast Adherence'
  ]
};

// ───────────── The Circuit (Duviri) ─────────────

export type CircuitPick = { frame: string; mod: string };
/** Rotação normal: 11 semanas; a semana 12 volta à 1. */
export const CIRCUIT_NORMAL: CircuitPick[][] = [
  [{ frame: 'Excalibur', mod: 'Furious Javelin' }, { frame: 'Trinity', mod: 'Vampire Leech' }, { frame: 'Ember', mod: 'Exothermic' }],
  [{ frame: 'Loki', mod: 'Hushed Invisibility' }, { frame: 'Mag', mod: 'Fracturing Crush' }, { frame: 'Rhino', mod: 'Ironclad Charge' }],
  [{ frame: 'Ash', mod: 'Seeking Shuriken' }, { frame: 'Frost', mod: 'Chilling Globe' }, { frame: 'Nyx', mod: 'Assimilate' }],
  [{ frame: 'Saryn', mod: 'Venom Dose' }, { frame: 'Vauban', mod: 'Enduring Bastille' }, { frame: 'Nova', mod: 'Molecular Fission' }],
  [{ frame: 'Nekros', mod: 'Shield of Shadows' }, { frame: 'Valkyr', mod: 'Eternal War' }, { frame: 'Oberon', mod: 'Phoenix Renewal' }],
  [{ frame: 'Hydroid', mod: 'Viral Tempest' }, { frame: 'Mirage', mod: 'Total Eclipse' }, { frame: 'Limbo', mod: 'Rift Haven' }],
  [{ frame: 'Mesa', mod: "Mesa's Waltz" }, { frame: 'Chroma', mod: 'Everlasting Ward' }, { frame: 'Atlas', mod: 'Rubble Heap' }],
  [{ frame: 'Ivara', mod: 'Infiltrate' }, { frame: 'Inaros', mod: 'Negation Armor' }, { frame: 'Titania', mod: 'Razorwing Blitz' }],
  [{ frame: 'Nidus', mod: 'Insatiable' }, { frame: 'Octavia', mod: 'Conductor' }, { frame: 'Harrow', mod: 'Lasting Covenant' }],
  [{ frame: 'Gara', mod: 'Spectrosiphon' }, { frame: 'Khora', mod: 'Accumulating Whipclaw' }, { frame: 'Revenant', mod: 'Thrall Pact' }],
  [{ frame: 'Garuda', mod: 'Blending Talons' }, { frame: 'Baruuk', mod: 'Reactive Storm' }, { frame: 'Hildryn', mod: 'Blazing Pillage' }]
];

/** Rotação Steel Path: 9 semanas (A–I), depois repete. */
export const CIRCUIT_STEEL: string[][] = [
  ['Braton', 'Lato', 'Skana', 'Paris', 'Kunai'],
  ['Boar', 'Gammacor', 'Angstrum', 'Gorgon', 'Anku'],
  ['Bo', 'Latron', 'Furis', 'Furax', 'Strun'],
  ['Lex', 'Magistar', 'Boltor', 'Bronco', 'Ceramic Dagger'],
  ['Torid', 'Dual Toxocyst', 'Dual Ichor', 'Miter', 'Atomos'],
  ['Ack & Brunt', 'Soma', 'Vasto', 'Nami Solo', 'Burston'],
  ['Zylok', 'Sibear', 'Dread', 'Despair', 'Hate'],
  ['Dera', 'Sybaris', 'Cestra', 'Sicarus', 'Okina'],
  ['Vectis', 'Stug', 'Ballistica', 'Destreza', 'Obex']
];

const same = (a: string[], b: string[]) => {
  const x = a.map((s) => s.trim().toLowerCase()).sort();
  const y = b.map((s) => s.trim().toLowerCase()).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** Descobre a semana da rotação normal (1–11) a partir dos 3 Warframes que a API mostra. */
export function circuitNormalWeek(choices: string[]): { week: number; picks: CircuitPick[] } | null {
  const i = CIRCUIT_NORMAL.findIndex((w) => same(w.map((p) => p.frame), choices));
  return i < 0 ? null : { week: i + 1, picks: CIRCUIT_NORMAL[i] };
}

/** Descobre a semana da rotação Steel Path (A–I) a partir das 5 armas que a API mostra. */
export function circuitSteelWeek(choices: string[]): { letter: string; week: number } | null {
  const i = CIRCUIT_STEEL.findIndex((w) => same(w, choices));
  return i < 0 ? null : { letter: String.fromCharCode(65 + i), week: i + 1 };
}

export const CIRCUIT_NORMAL_TIERS: { tier: string; reward: string; progress: string }[] = [
  { tier: '1', reward: 'Recursos de Duviri, Endo, mods, blueprints de armas MR 2, Arcanes comuns de Warframe, 10.000 Credits', progress: '190 (2 estágios)' },
  { tier: '2', reward: 'Warframe Neuroptics Blueprint', progress: '400 (4)' },
  { tier: '3', reward: 'Mesmo pool do tier 1', progress: '630 (5)' },
  { tier: '4', reward: 'Rare Mod', progress: '890 (7)' },
  { tier: '5', reward: 'Warframe Chassis Blueprint', progress: '1190 (9, ou 8 com o bônus diário)' },
  { tier: '6', reward: 'Recursos de Duviri, Endo, mods raros, blueprints MR 2, Arcanes comuns, 50.000 Credits', progress: '1540 (11, ou 10)' },
  { tier: '7', reward: 'Warframe Augment Mod', progress: '1950 (13)' },
  { tier: '8', reward: 'Warframe Systems Blueprint', progress: '2430 (16)' },
  { tier: '9', reward: 'Arcane comum de Warframe', progress: '2990 (19)' },
  { tier: '10', reward: 'Warframe Blueprint', progress: '3640 (23)' },
  { tier: '11+', reward: '1.500 Credits e 250 Endo por nível', progress: '+900 de progresso por nível' }
];

export const CIRCUIT_NOTES = {
  progress: 'Progresso por estágio: 100, 110, 125, 145 (+50 uma vez por dia) e 170 do 5º em diante.',
  normal: 'Normal: a cada semana você escolhe 1 dos 3 blueprints de Warframe (cada um vem com um mod associado). Os tiers só podem ser resgatados uma vez por semana.',
  steel:
    'Steel Path: você escolhe 2 dos 5 Incarnon Genesis Adapters (entregues nos tiers 5 e 10). Com Drifter Intrinsics Opportunity Rank 9 também dá para escolher um Riven (Rifle, Pistol ou Melee) ou 20.000 Kuva. Tiers 1–4 (lista parcial): Arcanes de Duviri, recursos, Kuva, Endo, Riven Slivers e blueprints de Exilus/Forma; o tier 2 oferece Arcane Reaper, Secondary Shiver ou Longbow Sharpshot.'
};

// ───────────── Archimedea / Netracells / Archon Hunt ─────────────

export const SEARCH_PULSES =
  'Você ganha 5 Search Pulses por semana, compartilhados: Deep Archimedea custa 2, Temporal Archimedea custa 2 e cada Netracell com recompensa custa 1.';

export const DEEP_TIERS: { rp: number; reward: string; elite?: boolean }[] = [
  { rp: 5, reward: 'Reward Pool A (Uncommon)' },
  { rp: 10, reward: 'Reward Pool A (Uncommon)' },
  { rp: 15, reward: '3× Entrati Lanthorn' },
  { rp: 20, reward: 'Reward Pool B (Rare)' },
  { rp: 25, reward: 'Desbloqueia a Elite Archimedea de forma permanente' },
  { rp: 28, reward: '20 Vosfor', elite: true },
  { rp: 31, reward: 'Reward Pool B (Rare)', elite: true },
  { rp: 34, reward: 'Reward Pool C (Legendary)', elite: true },
  { rp: 37, reward: '50 Vosfor (o hotfix 44.0.3 cita Vosfor ou Pix Chips)', elite: true }
];

export const DEEP_NOTES = [
  'São 3 missões seguidas, sem trocar de loadout. Concluir as 3 dá 3 RP; cada parâmetro (loadout ou modificador pessoal) dá +1 RP por missão, até 24 RP no total. A versão Elite soma +10 RP.',
  'Cada recompensa sai uma vez por semana, na hora em que o tier é atingido. A 3ª missão também dá 15.000 de Cavia Standing.',
  'O wiki ainda traz a lista antiga das faixas Elite; o hotfix 44.0.3 indica que 37 RP pode dar Vosfor ou Pix Chips e que a recompensa Legendary voltou para 34 RP.'
];

export const TEMPORAL_NOTES = [
  'Custa 2 Search Pulses por semana. São 3 missões: concluir todas dá 3 RP, e itens de loadout e modificadores pessoais dão +1 RP cada por missão. A Elite soma 3, 3 e 4 RP (10 no total) e é liberada ao concluir uma run com 25 RP.',
  'As recompensas são principalmente Archon Shards, Arcanes e Tauforged Shards; mais RP abre chances de outros prêmios. Não consegui confirmar a tabela de RP por faixa: o jogo mostra a lista no menu da missão.',
  'Dá para abrir os prêmios do Temporal Archimedea falando com Kaya por 5 Peely Pix.'
];

export const NETRACELLS_NOTES = [
  'Máximo de 5 Netracells com recompensa por semana (1 Search Pulse cada). Sem Pulse dá para jogar, mas sem a tabela de drops. Não existe versão Steel Path.',
  'Cada Netracell dá 5.000 de Cavia Standing, Credits e Entrati Obols, e um baú principal com 1 Entrati Lanthorn garantido mais um item: Archon Shard (Crimson, Amber ou Azure, 17,5% cada; versões Tauforged 4,17% cada), Melee Arcane Adapter (15%), Melee Crescendo (10%) ou Melee Duplicate (10%).'
];

export const ARCHON_SHARD: Record<string, { shard: string; color: string }> = {
  amar: { shard: 'Crimson Archon Shard', color: 'text-red-400' },
  nira: { shard: 'Amber Archon Shard', color: 'text-amber-300' },
  boreal: { shard: 'Azure Archon Shard', color: 'text-sky-400' }
};

/** "Archon Amar" → dados do shard; null se for um Archon que não está na lista. */
export function archonShard(boss: string) {
  const key = boss.toLowerCase().replace(/^archon\s+/, '').trim();
  return ARCHON_SHARD[key] ?? null;
}

export const ARCHON_DROPS: { name: string; chance: string }[] = [
  { name: 'Ayatan Anasa Sculpture', chance: '28%' },
  { name: '8.000 Endo', chance: '12,1%' },
  { name: '12.000 Kuva', chance: '12%' },
  { name: 'Melee Riven Mod', chance: '8,14%' },
  { name: 'Pistol Riven Mod', chance: '7,61%' },
  { name: 'Rifle Riven Mod', chance: '6,79%' },
  { name: 'Affinity / Mod Drop Chance / Resource Drop Chance Booster', chance: '3,27% cada' },
  { name: 'Orokin Catalyst BP, Orokin Reactor BP, Exilus Warframe Adapter, 3× Forma', chance: '2,5% cada' },
  { name: 'Kitgun Riven Mod, Zaw Riven Mod', chance: '2% cada' },
  { name: 'Shotgun Riven Mod', chance: '1,36%' },
  { name: 'Legendary Core', chance: '0,18%' }
];

export const ARCHON_NOTES = [
  'O Archon da semana sempre solta o próprio shard. Cada shard tem versão Tauforged: a chance-base é 20% e sobe 20% a cada shard normal recebido no lugar (zera ao receber o Tauforged, e é contada por cor).',
  'A Forma é entregue depois da missão final. Os prêmios são parecidos com os da Sortie, mas com Endo e Kuva em dobro.'
];

// ───────────── Mercadores fixos ─────────────

export type Offer = { name: string; price: string; limit?: string };

export const PALLADINO: Offer[] = [
  { name: '150.000 Credits', price: '5 Riven Sliver', limit: '1/semana' },
  { name: '6.000 Endo', price: '10 Riven Sliver', limit: '1/semana' },
  { name: '35.000 Kuva', price: '10 Riven Sliver', limit: '1/semana' },
  { name: 'Requiem I, II, III e IV Relic', price: '10 Riven Sliver cada', limit: '10/semana cada' },
  { name: 'Requiem Ultimatum', price: '10 Riven Sliver', limit: '1/semana' },
  { name: 'Riven Mod (2 ofertas)', price: '10 Riven Sliver cada', limit: '1/semana' },
  { name: 'Riven Transmuter', price: '10 Riven Sliver', limit: '3/semana' },
  { name: 'Veiled Riven Cipher', price: '10 Riven Sliver', limit: '1/semana' },
  { name: 'Iron Wake Scene (Captura)', price: '10 Riven Sliver' },
  { name: "Rell's Emotiles (16 variações)", price: '5 Riven Sliver cada' },
  { name: "Rell's Donda", price: '25 Orokin Ducats' }
];

export const ACRITHIS_WEEKLY: Offer[] = [
  { name: 'Orokin Reactor Blueprint', price: '20 Pathos Clamp' },
  { name: 'Orokin Catalyst Blueprint', price: '20 Pathos Clamp' },
  { name: 'Exilus Warframe Adapter', price: '20 Pathos Clamp' },
  { name: 'Exilus Weapon Adapter', price: '20 Pathos Clamp' },
  { name: 'Primary Arcane Adapter', price: '25 Pathos Clamp' },
  { name: 'Secondary Arcane Adapter', price: '25 Pathos Clamp' },
  { name: 'Forma Blueprint', price: '10 Pathos Clamp' },
  { name: 'Melee Riven Mod', price: '15 Pathos Clamp' },
  { name: 'Pistol Riven Mod', price: '15 Pathos Clamp' },
  { name: 'Rifle Riven Mod', price: '15 Pathos Clamp' },
  { name: 'Kitgun Riven Mod', price: '15 Pathos Clamp' },
  { name: 'Zaw Riven Mod', price: '15 Pathos Clamp' },
  { name: 'Shotgun Riven Mod', price: '15 Pathos Clamp' },
  { name: 'Companion Weapon Riven Mod', price: '20 Pathos Clamp' },
  { name: '10.000 Kuva', price: '10 Pathos Clamp' }
];

export const ACRITHIS_DAILY: Offer[] = [
  { name: 'Arcane Intention', price: '10 Pathos Clamp' },
  { name: 'Arcane Power Ramp', price: '10 Pathos Clamp' },
  { name: 'Arcane Reaper', price: '20 Pathos Clamp' },
  { name: 'Longbow Sharpshot', price: '20 Pathos Clamp' },
  { name: 'Primary Blight', price: '10 Pathos Clamp' },
  { name: 'Primary Exhilarate', price: '10 Pathos Clamp' },
  { name: 'Primary Obstruct', price: '10 Pathos Clamp' },
  { name: 'Shotgun Vendetta', price: '10 Pathos Clamp' },
  { name: 'Akimbo Slip Shot', price: '10 Pathos Clamp' },
  { name: 'Secondary Shiver', price: '20 Pathos Clamp' },
  { name: 'Secondary Outburst', price: '10 Pathos Clamp' },
  { name: 'Magus Aggress', price: '10 Pathos Clamp' }
];

export const KAYA_OFFERS: Offer[] = [
  { name: 'Arcane Universal Fallout', price: '5 Pix Chips', limit: '1/semana' },
  { name: 'Arcane Hot Shot', price: '5 Pix Chips', limit: '1/semana' },
  { name: 'Arcane Escapist', price: '5 Pix Chips', limit: '1/semana' }
];

export const YONTA_OFFERS: Offer[] = [{ name: '35.000 Kuva', price: '5 Voidplume Pinions', limit: '1/semana' }];

/** Rotação de 6 semanas do Ayatan Treasure Hunt da Maroo. O wiki não diz qual é a semana atual. */
export const AYATAN_ROTATION: { week: number; treasure: string; tileset: string }[] = [
  { week: 1, treasure: 'Ayatan Sah', tileset: 'Orokin Derelict / Infested' },
  { week: 2, treasure: 'Ayatan Ayr', tileset: 'Orokin Tower' },
  { week: 3, treasure: 'Ayatan Orta', tileset: 'Orokin Derelict / Infested' },
  { week: 4, treasure: 'Ayatan Vaya', tileset: 'Orokin Tower' },
  { week: 5, treasure: 'Ayatan Piv', tileset: 'Orokin Derelict / Infested' },
  { week: 6, treasure: 'Ayatan Valana', tileset: 'Orokin Tower' }
];

export const CAVALERO_BUNDLES: { adapter: string; cost: string }[] = [
  { adapter: 'Boar', cost: '20 Pathos Clamp, 60 Rune Marrow, 60 Tasoma Extract' },
  { adapter: 'Gammacor', cost: '20 Pathos Clamp, 70 Ueymag, 80 Lamentus' },
  { adapter: 'Anku', cost: '20 Pathos Clamp, 70 Ueymag, 300 Ariette Scale' },
  { adapter: 'Gorgon', cost: '20 Pathos Clamp, 60 Rune Marrow, 60 Tasoma Extract' },
  { adapter: 'Angstrum', cost: '20 Pathos Clamp, 70 Ueymag, 80 Lamentus' },
  { adapter: 'Dera', cost: '20 Pathos Clamp, 80 Eevani, 70 Ueymag' },
  { adapter: 'Cestra', cost: '20 Pathos Clamp, 80 Kovnik, 150 Saggen Pearl' },
  { adapter: 'Okina', cost: '20 Pathos Clamp, 20 Maw Fang, 80 Lamentus' },
  { adapter: 'Sybaris', cost: '20 Pathos Clamp, 70 Ueymag, 150 Saggen Pearl' },
  { adapter: 'Sicarus', cost: '20 Pathos Clamp, 100 Nacreous Pebble, 150 Aggristone' }
];

/** Outros resets semanais (segunda 00:00 UTC), conforme o wiki. */
export const OTHER_WEEKLY: string[] = [
  'Nightwave: atos semanais e Elite',
  'Maroo: Ayatan Treasure Hunt',
  'Alerta "Help Clem"',
  'Fables & Frontiers: "Oops! All Eximus!"',
  'Iniciativas semanais do Clã',
  'Helminth: seleção de Invigoration',
  "Kahl's Garrison: missões Break Narmer",
  'Archon Hunt (missões da Narmer)',
  'Calendário 1999: nova temporada',
  'Search Pulses (5): Deep Archimedea, Temporal Archimedea e Netracells',
  'The Icebind: 3 Cryobells voltam a crescer',
  'Vendedores: Palladino, Archimedean Yonta, Teshin, Bird 3, Kaya, Acrithis e Cavalero'
];

export const OTHER_TIMES: string[] = [
  'Conclave: desafios semanais resetam sexta 00:00 UTC; leaderboards, segunda 09:00 UTC.',
  'Baro Ki’Teer: a cada 2 semanas. Prime Resurgence (Varzia): troca mensal.',
  'Resets diários: 00:00 UTC (Daily Tribute, Ticker, arcanes diários da Acrithis).'
];

// ───────────── Varzia (Prime Resurgence) ─────────────

export type VarziaKind = 'pack' | 'relic' | 'item';

export function varziaKind(name: string): VarziaKind {
  if (/Void Projection/i.test(name)) return 'relic';
  if (/\b(Pack|Set)\b/i.test(name)) return 'pack';
  return 'item';
}

const RELIC_ERA: Record<string, string> = { '1': 'Lith', '2': 'Meso', '3': 'Neo', '4': 'Axi', '5': 'Requiem' };

/** "T1 Void Projection Protea Ivara Vault A Bronze" → "Lith · Protea Ivara Vault A (Intact)". */
export function varziaLabel(name: string): string {
  const m = /^T(\d)\s+Void Projection\s+(.*?)(?:\s+(Bronze|Silver|Gold|Platinum))?$/i.exec(name.trim());
  if (!m) return name;
  const refine: Record<string, string> = { bronze: 'Intact', silver: 'Exceptional', gold: 'Flawless', platinum: 'Radiant' };
  const era = RELIC_ERA[m[1]] ?? `T${m[1]}`;
  return `${era} · ${m[2]}${m[3] ? ` (${refine[m[3].toLowerCase()] ?? m[3]})` : ''}`;
}

/**
 * Preço no Varzia. A API reaproveita o modelo do Baro: o campo `credits` guarda o preço em Aya e
 * `ducats` o preço em Regal Aya (Prime Warframe = 3 Regal Aya; relíquia = 1 Aya).
 */
export function varziaPrice(i: { ducats: number | null; credits: number | null }): string {
  const parts: string[] = [];
  if (i.ducats != null) parts.push(`${i.ducats} Regal Aya`);
  if (i.credits != null) parts.push(`${i.credits} Aya`);
  return parts.join(' ou ') || 'preço não informado';
}

// ───────────── Visual do Kanban ─────────────

/** categoria da tarefa → rótulo, cor e aba com mais detalhes */
export const TASK_CATEGORY: Record<string, { label: string; color: string; tab?: string }> = {
  archimedea: { label: 'Archimedea', color: 'bg-fuchsia-500/15 text-fuchsia-300', tab: 'archimedea' },
  descendia: { label: 'Descendia', color: 'bg-orange-500/15 text-orange-300', tab: 'descendia' },
  hex: { label: 'The Hex', color: 'bg-violet-500/15 text-violet-300', tab: 'archimedea' },
  netracells: { label: 'Netracells', color: 'bg-cyan-500/15 text-cyan-300', tab: 'recompensas' },
  archon: { label: 'Archon', color: 'bg-red-500/15 text-red-300', tab: 'recompensas' },
  kahl: { label: 'Kahl', color: 'bg-rose-500/15 text-rose-300', tab: 'recompensas' },
  nightwave: { label: 'Nightwave', color: 'bg-indigo-500/15 text-indigo-300', tab: 'recompensas' },
  duviri: { label: 'Duviri', color: 'bg-emerald-500/15 text-emerald-300', tab: 'recompensas' },
  vendor: { label: 'Mercador', color: 'bg-amber-500/15 text-amber-300', tab: 'mercadores' }
};

export const TABS = [
  { id: 'quadro', label: 'Quadro' },
  { id: 'descendia', label: 'Descendia' },
  { id: 'mercadores', label: 'Mercadores' },
  { id: 'recompensas', label: 'Recompensas' },
  { id: 'archimedea', label: 'Archimedea' }
] as const;
export type TabId = (typeof TABS)[number]['id'];
export const isTab = (v: unknown): v is TabId => TABS.some((t) => t.id === v);
