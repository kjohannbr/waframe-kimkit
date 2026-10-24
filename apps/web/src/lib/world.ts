// Tipos da resposta de GET /api/world (espelham apps/api/src/world.ts) + carregamento.
import { API_URL, api } from './api';

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

/** Busca o estado do mundo; erro de rede/502 vira `null` (a tela mostra o aviso e usa só os dados fixos). */
export async function loadWorld(): Promise<World | null> {
  try {
    const res = await fetch(`${API_URL}/api/world`);
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as World | null;
    return data && typeof data === 'object' && data.week ? data : null;
  } catch {
    return null;
  }
}

/** Botão "Sincronizar": pede ao servidor uma busca nova. Devolve `null` se falhar. */
export async function syncWorld(): Promise<World | null> {
  try {
    const res = await api<World>('/api/world/sync', { method: 'POST' });
    return res && res.week ? res : null;
  } catch {
    return null;
  }
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
