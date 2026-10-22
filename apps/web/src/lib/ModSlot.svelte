<script lang="ts">
  import type { Mod } from './catalog';
  import { slotDrain, type Slot } from './builder';
  import ModImage from './ModImage.svelte';
  import { Minus, Plus, X } from '@lucide/svelte';

  let {
    label,
    slot,
    mod,
    isAura = false,
    onopen,
    onclear,
    onrank,
    onpolarity
  }: {
    label: string;
    slot: Slot;
    mod: Mod | undefined;
    isAura?: boolean;
    onopen: () => void;
    onclear: () => void;
    onrank: (delta: number) => void;
    onpolarity: () => void;
  } = $props();

  const POL: Record<string, { code: string; color: string }> = {
    madurai: { code: 'MAD', color: 'text-red-400' },
    vazarin: { code: 'VAZ', color: 'text-sky-400' },
    naramon: { code: 'NAR', color: 'text-orange-300' },
    zenurik: { code: 'ZEN', color: 'text-violet-300' },
    unairu: { code: 'UNA', color: 'text-emerald-300' },
    penjaga: { code: 'PEN', color: 'text-pink-300' },
    umbra: { code: 'UMB', color: 'text-indigo-300' },
    aura: { code: 'AUR', color: 'text-zinc-300' }
  };
  const pol = $derived(slot.polarity ? (POL[slot.polarity] ?? { code: slot.polarity.slice(0, 3).toUpperCase(), color: 'text-zinc-300' }) : null);
  const drain = $derived(mod ? slotDrain(mod, slot.rank, slot.polarity, isAura) : 0);
  const base = $derived(mod ? (isAura ? -(Math.abs(mod.drain) + slot.rank) : Math.abs(mod.drain) + slot.rank) : 0);
  const rarityBorder: Record<string, string> = {
    Common: 'border-amber-800/70',
    Uncommon: 'border-zinc-400/70',
    Rare: 'border-yellow-400/80',
    Legendary: 'border-cyan-200/80'
  };
</script>

<div class="flex flex-col overflow-hidden rounded-xl border bg-zinc-900 {mod ? (rarityBorder[mod.rarity ?? ''] ?? 'border-zinc-600') : 'border-dashed border-zinc-700'}">
  <div class="flex items-center justify-between px-2 pt-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
    <span>{label}</span>
    <button type="button" onclick={onpolarity} title="Clique para trocar a polaridade do slot (Forma)" class="rounded px-1 font-semibold hover:bg-zinc-800 {pol ? pol.color : 'text-zinc-600'}">
      {pol ? pol.code : '—'}
    </button>
  </div>

  {#if mod}
    <button type="button" onclick={onopen} title={mod.stats.length ? `${mod.name} (rank ${mod.maxRank})\n${mod.stats.join('\n')}` : mod.name} class="relative block text-left">
      <ModImage file={mod.image} alt={mod.name} class="aspect-[4/3] w-full bg-zinc-950 object-contain" />
      <span
        class="absolute right-1 top-1 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold tabular-nums {drain < base && !isAura ? 'text-emerald-400' : drain > base && !isAura ? 'text-red-400' : isAura ? 'text-emerald-400' : 'text-zinc-100'}"
      >
        {isAura ? `+${-drain}` : drain}
      </span>
    </button>
    <div class="px-2 pt-1">
      <div class="truncate text-sm font-medium" title={mod.name}>{mod.name}</div>
    </div>
    <div class="mt-auto flex items-center justify-between gap-1 p-2 pt-1">
      <div class="flex items-center gap-1">
        <button type="button" aria-label="Diminuir rank" onclick={() => onrank(-1)} disabled={slot.rank <= 0} class="rounded bg-zinc-800 p-1 hover:bg-zinc-700 disabled:opacity-30"><Minus size={12} /></button>
        <span class="w-9 text-center text-xs tabular-nums text-zinc-300">{slot.rank}/{mod.maxRank}</span>
        <button type="button" aria-label="Aumentar rank" onclick={() => onrank(1)} disabled={slot.rank >= mod.maxRank} class="rounded bg-zinc-800 p-1 hover:bg-zinc-700 disabled:opacity-30"><Plus size={12} /></button>
      </div>
      <button type="button" aria-label="Remover mod" onclick={onclear} class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"><X size={14} /></button>
    </div>
  {:else}
    <button type="button" onclick={onopen} class="grid aspect-[4/3] w-full place-items-center text-zinc-600 hover:bg-zinc-800/60 hover:text-amber-300">
      <Plus size={28} />
    </button>
    <div class="px-2 pb-2 pt-1 text-xs text-zinc-600">Vazio</div>
  {/if}
</div>
