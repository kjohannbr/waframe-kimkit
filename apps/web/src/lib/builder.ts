// Estado da build e cálculo de capacidade (drain) dos mods.
import type { Item, Mod } from './catalog';

export type Slot = { modId: string | null; rank: number; polarity: string | null };
export type Build = {
  itemId: string;
  slots: Slot[]; // 8 slots principais
  aura: Slot | null; // Warframes
  stance: Slot | null; // armas melee
  reactor: boolean; // Orokin Reactor/Catalyst: dobra a capacidade
};

export const BASE_CAPACITY = 30;
export const POLARITIES = ['madurai', 'vazarin', 'naramon', 'zenurik', 'unairu', 'penjaga'] as const;

export function emptyBuild(item: Item): Build {
  const slots: Slot[] = Array.from({ length: 8 }, (_, i) => ({
    modId: null,
    rank: 0,
    // polaridades já existentes no item ocupam os primeiros slots (a ordem real varia por item)
    polarity: item.polarities[i] ?? null
  }));
  return {
    itemId: item.id,
    slots,
    aura: item.hasAura ? { modId: null, rank: 0, polarity: item.aura ?? null } : null,
    stance: item.hasStance ? { modId: null, rank: 0, polarity: item.stancePolarity ?? null } : null,
    reactor: false
  };
}

/** Custo do mod no rank atual, já com o efeito da polaridade do slot. */
export function slotDrain(mod: Mod, rank: number, slotPolarity: string | null, isAura = false): number {
  const raw = Math.abs(mod.drain) + rank;
  const modPol = mod.polarity && mod.polarity !== 'universal' ? mod.polarity : null;

  if (isAura) {
    // Aura soma capacidade em vez de gastar; polaridade igual dobra o bônus.
    return -(slotPolarity && slotPolarity === modPol ? raw * 2 : raw);
  }
  if (!slotPolarity) return raw; // slot neutro: custo normal
  if (slotPolarity === modPol) return Math.ceil(raw / 2); // mesma polaridade: metade
  return Math.ceil(raw * 1.25); // polaridade diferente (ou mod sem polaridade): +25%
}

export function summarize(build: Build, modsById: Map<string, Mod>) {
  const capacity = BASE_CAPACITY * (build.reactor ? 2 : 1);
  let used = 0;
  let bonus = 0;
  const each = (s: Slot | null, isAura = false, isStance = false) => {
    if (!s?.modId) return;
    const mod = modsById.get(s.modId);
    if (!mod) return;
    const d = slotDrain(mod, s.rank, s.polarity, isAura);
    if (isAura) bonus += -d;
    else if (!isStance) used += d;
    else used += d; // postura também gasta capacidade
  };
  build.slots.forEach((s) => each(s));
  each(build.aura, true);
  each(build.stance, false, true);

  const total = capacity + bonus;
  return { capacity: total, used, free: total - used, over: used > total };
}

export function equippedIds(build: Build): Set<string> {
  const ids = new Set<string>();
  for (const s of [...build.slots, build.aura, build.stance]) if (s?.modId) ids.add(s.modId);
  return ids;
}

// ───────────── Persistência local ─────────────
const key = (itemId: string) => `wf_build:${itemId}`;

export function loadBuild(item: Item): Build {
  try {
    const raw = localStorage.getItem(key(item.id));
    if (raw) {
      const b = JSON.parse(raw) as Build;
      if (b.itemId === item.id && Array.isArray(b.slots) && b.slots.length === 8) return b;
    }
  } catch {
    /* storage indisponível ou JSON inválido */
  }
  return emptyBuild(item);
}

export function saveBuild(b: Build) {
  try {
    localStorage.setItem(key(b.itemId), JSON.stringify(b));
  } catch {
    /* ignora */
  }
}
