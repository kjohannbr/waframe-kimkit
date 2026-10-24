// Respostas no formato do `warframe-worldstate-parser` (campos conferidos no código do pacote v5.5.7).
// Valores baseados em amostras reais da API; reduzidos para caber no teste.
const activation = '2026-10-19T00:00:00.000Z';
const expiry = '2026-10-26T00:00:00.000Z';

const mission = (missionType, devName, risks) => ({
  faction: 'Man in the Wall',
  factionKey: 'Man in the Wall',
  missionType,
  missionTypeKey: missionType,
  deviation: { key: 'FortifiedFoes', name: devName, description: 'Enemies take 90% less damage from non-Weak Point hits.' },
  risks
});
const risk = (name, isHard) => ({ key: name.replace(/\s/g, ''), name, description: `<DT_X>${name} description`, isHard });

export const archimedeas = [
  {
    id: 'deep1', activation, expiry, type: 'C T_ L A B', typeKey: 'C T_ L A B',
    missions: [
      mission('Extermination', 'Sealed Armor', [risk('Bold Venture', false), risk('Alluring Arcocanids', true)]),
      mission('Survival', 'Hasty Hunt', [risk('Slow Burn', false), risk('Frenzied Foes', true)]),
      mission('Disruption', 'Cold Snap', [risk('Thin Air', false), risk('Heavy Hitters', true)])
    ],
    personalModifiers: [
      { key: 'DullBlades', name: 'Dull Blades', description: '-50% melee combo chance' },
      { key: 'Slippery', name: 'Slippery', description: 'Lose traction' }
    ]
  },
  {
    id: 'temp1', activation, expiry, type: 'C T_ H E X', typeKey: 'C T_ H E X',
    missions: [mission('Defense', 'Mirror Image', [risk('Gloom', false)])],
    personalModifiers: [{ key: 'X', name: 'Heavy Gear', description: 'Slower' }]
  }
];

const infernum = (index, type, challenge, specs = [], auras = []) => ({
  index, type, typeKey: 'DT_X', challenge, challengeKey: 'K', level: 'Dark Refractory Hall', levelUniqueName: '/Lotus/Levels/X',
  specs: specs.map((n) => ({ uniqueName: `/Lotus/Specs/${n.replace(/\s/g, '')}`, name: n })),
  auras: auras.map((n) => ({ uniqueName: `/Lotus/Auras/${n.replace(/\s/g, '')}`, name: n }))
});
export const descendia = {
  id: 'desc1', activation, expiry, seed: 12345,
  challenges: [
    infernum(2, 'Gruzzling Plunder', 'Gruzzling Plunder'),
    infernum(1, 'Extermination', '', ['Frozen Light Eximus Cabal']),
    infernum(8, 'Legacyte Capture', 'Legacyte Capture', [], ['Manic Mania']),
    { ...infernum(21, "Roathe's Oblivion", ''), specs: [{ uniqueName: '/Lotus/Specs/FrostGiants', name: '' }] }
  ]
};

export const voidTraderInactive = {
  id: 'baro1', activation: '2026-10-23T13:00:00.000Z', expiry: '2026-10-25T13:00:00.000Z',
  character: 'Baro Ki\'Teer', location: 'Strata Relay (Earth)', inventory: [], schedule: []
};
export const voidTraderActive = {
  ...voidTraderInactive,
  inventory: [
    { uniqueName: '/Lotus/A', item: 'Primed Pistol Gambit', ducats: 350, credits: 150000 },
    { uniqueName: '/Lotus/B', item: 'Some Relic Pack', ducats: null, credits: 1 }
  ]
};
export const vaultTrader = {
  id: 'varzia1', activation: '2026-10-01T18:00:00.000Z', expiry: '2026-10-29T18:00:00.000Z',
  character: 'Varzia', location: "Maroo's Bazaar (Mars)",
  inventory: [
    { uniqueName: '/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVProteaPrimeSinglePack', item: 'M P V Protea Prime Single Pack', ducats: 6, credits: null },
    { uniqueName: '/Lotus/Types/Game/Projections/T1VoidProjectionProteaIvaraVaultABronze', item: 'T1 Void Projection Protea Ivara Vault A Bronze', ducats: null, credits: 1 }
  ]
};

export const steelPath = {
  currentReward: { name: '30,000 Endo', cost: 150 },
  rotation: [{ name: 'Umbra Forma Blueprint', cost: 150 }, { name: '50,000 Kuva', cost: 55 }],
  evergreens: [{ name: 'Veiled Riven Cipher', cost: 20 }, { name: 'Bishamo Pauldrons Blueprint', cost: 15 }],
  activation, expiry: '2026-10-25T23:59:59.000Z', remaining: '3d'
};

export const archonHunt = {
  boss: 'Archon Amar', faction: 'Narmer', rewardPool: 'Archon Sortie Rewards', activation, expiry,
  missions: [{ type: 'Rescue', node: 'Tharsis (Mars)' }, { type: 'Interception', node: 'Ara (Mars)' }, { type: 'Assassination', node: 'War (Mars)' }]
};

export const duviriCycle = {
  state: 'joy', activation: '2026-10-22T12:00:00.000Z', expiry: '2026-10-22T14:00:00.000Z',
  choices: [
    { category: 'normal', categoryKey: 'EXC_NORMAL', choices: ['Hydroid', 'Mirage', 'Limbo'] },
    { category: 'hard', categoryKey: 'EXC_HARD', choices: ['Dera', 'Cestra', 'Okina', 'Sybaris', 'Sicarus'] }
  ]
};

export const nightwave = {
  season: 18, tag: 'Radio Legion Intermission16 Syndicate', phase: 0, params: {},
  activeChallenges: [
    { id: 'a', title: 'Loyalty', desc: 'Interact with your Kubrow or Kavat', reputation: 1000, isDaily: true, isElite: false, expiry: '2026-10-24T00:00:00.000Z' },
    { id: 'b', title: 'Mission Complete XI', desc: 'Complete any 15 missions', reputation: 4500, isDaily: false, isElite: false, expiry },
    { id: 'c', title: 'Season Weekly Hard Going Down', desc: '[PH] Season Weekly Hard Going Down Desc', reputation: 7000, isDaily: false, isElite: true, expiry },
    { id: 'd', title: '', desc: 'sem título', reputation: 1, isDaily: false, isElite: false }
  ]
};

/** Mapa path → resposta, como o servidor falso devolve. */
export const routes = {
  archimedeas, descendia, voidTrader: voidTraderInactive, vaultTrader, steelPath, archonHunt, duviriCycle, nightwave
};
