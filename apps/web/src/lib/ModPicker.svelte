<script lang="ts">
  import { highlight, search, type Mod, type Searchable } from './catalog';
  import ModImage from './ModImage.svelte';
  import { X } from '@lucide/svelte';

  let {
    title,
    mods,
    taken,
    compatFilter = false,
    onpick,
    onclose
  }: {
    title: string;
    mods: Searchable<Mod>[];
    taken: Set<string>;
    compatFilter?: boolean;
    onpick: (m: Searchable<Mod>) => void;
    onclose: () => void;
  } = $props();

  const LIMIT = 150;
  let q = $state('');
  let rarity = $state('');
  let compat = $state('');
  let input: HTMLInputElement | undefined = $state();

  $effect(() => input?.focus());

  const rarities = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  const compats = $derived([...new Set(mods.map((m) => m.compat))].sort());
  const available = $derived(mods.filter((m) => !taken.has(m.id)));
  const filter = $derived((m: Mod) => (!rarity || m.rarity === rarity) && (!compat || m.compat === compat));
  const list = $derived(q.trim() ? search(available, q, { limit: LIMIT, filter }) : available.filter(filter).slice(0, LIMIT));
  const total = $derived(q.trim() ? list.length : available.filter(filter).length);

  const border: Record<string, string> = {
    Common: 'border-amber-800/70',
    Uncommon: 'border-zinc-400/70',
    Rare: 'border-yellow-400/80',
    Legendary: 'border-cyan-200/80'
  };
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-8" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div role="dialog" aria-modal="true" aria-label={title} class="w-full max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
    <div class="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
      <h2 class="mr-2 text-lg font-semibold">{title}</h2>
      <input
        bind:this={input}
        bind:value={q}
        placeholder="Buscar mod pelo nome…"
        autocomplete="off"
        class="min-w-48 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      <select bind:value={rarity} class="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
        <option value="">Toda raridade</option>
        {#each rarities as r}<option value={r}>{r}</option>{/each}
      </select>
      {#if compatFilter}
        <select bind:value={compat} class="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
          <option value="">Todas as armas</option>
          {#each compats as c}<option value={c}>{c}</option>{/each}
        </select>
      {/if}
      <button type="button" aria-label="Fechar" onclick={onclose} class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X size={20} /></button>
    </div>

    <div class="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each list as m (m.id)}
        {@const [a, hl, b] = highlight(m.name, q)}
        <button
          type="button"
          onclick={() => onpick(m)}
          title={m.stats.length ? `${m.name} (rank ${m.maxRank})\n${m.stats.join('\n')}` : m.name}
          class="group flex flex-col overflow-hidden rounded-xl border bg-zinc-900 text-left transition hover:-translate-y-0.5 hover:bg-zinc-800 {border[m.rarity ?? ''] ?? 'border-zinc-700'}"
        >
          <ModImage file={m.image} alt={m.name} class="aspect-[4/3] w-full bg-zinc-950 object-contain" />
          <span class="flex flex-1 flex-col gap-0.5 p-2">
            <span class="text-sm font-medium leading-tight">{a}{#if hl}<mark class="rounded bg-amber-400/25 px-0.5 text-amber-200">{hl}</mark>{/if}{b}</span>
            <span class="text-xs text-zinc-500">
              {m.drain < 0 ? `+${Math.abs(m.drain) + m.maxRank}` : m.drain + m.maxRank} cap.{m.polarity && m.polarity !== 'universal' ? ` · ${m.polarity}` : ''}
            </span>
            {#if m.stats[0]}<span class="line-clamp-2 text-xs text-zinc-400">{m.stats[0]}</span>{/if}
            {#if m.compat && !['PRIMARY', 'SECONDARY', 'WARFRAME', 'AURA', 'Rifle', 'Pistol', 'Shotgun', 'Melee'].includes(m.compat)}
              <span class="mt-auto pt-1 text-[10px] uppercase tracking-wide text-amber-400/80">{m.compat}</span>
            {/if}
          </span>
        </button>
      {:else}
        <p class="col-span-full py-10 text-center text-sm text-zinc-500">Nenhum mod encontrado.</p>
      {/each}
    </div>
    {#if total > LIMIT}
      <p class="px-3 pb-4 text-center text-xs text-zinc-500">Mostrando {LIMIT} de {total} — digite para refinar.</p>
    {/if}
  </div>
</div>
