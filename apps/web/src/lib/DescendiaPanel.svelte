<script lang="ts">
  import type { NDescendia } from './world';
  import Countdown from './Countdown.svelte';
  import Src from './Src.svelte';
  import { BLESSINGS, DESCENDIA, DESCENDIA_NOTES, DESCENDIA_REWARDS, WIKI, type RewardGroup } from './weekly';

  let { data, error }: { data: NDescendia | null; error?: string } = $props();
  let mode = $state<'normal' | 'steel'>('normal');
  const floors = Object.keys(DESCENDIA_REWARDS).map(Number).sort((a, b) => a - b);
  const live = $derived(new Map((data?.challenges ?? []).map((c) => [c.index, c])));
</script>

{#snippet group(g: RewardGroup)}
  <div class="text-xs text-zinc-400">{g.label}{#if g.each} · {g.each}{/if}</div>
  <div class="mt-1 flex flex-wrap gap-1">
    {#each g.items as it}<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{it}</span>{/each}
  </div>
{/snippet}

<section class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-lg font-semibold">The Descendia</h2>
    <div class="flex gap-1" role="tablist">
      <button role="tab" aria-selected={mode === 'normal'} onclick={() => (mode = 'normal')} class="rounded-lg px-3 py-1 text-sm {mode === 'normal' ? 'bg-amber-400 text-zinc-900' : 'bg-zinc-800'}">Normal · nível {DESCENDIA.level.normal}</button>
      <button role="tab" aria-selected={mode === 'steel'} onclick={() => (mode = 'steel')} class="rounded-lg px-3 py-1 text-sm {mode === 'steel' ? 'bg-amber-400 text-zinc-900' : 'bg-zinc-800'}">Steel Path · nível {DESCENDIA.level.steel}</button>
    </div>
  </div>
  <p class="text-sm text-zinc-400">{DESCENDIA.floors} andares; checkpoints nos andares {DESCENDIA.checkpoints.join(', ')}. {DESCENDIA.unlock}</p>

  <h3 class="font-medium">Andares desta semana <Countdown to={data?.expiry ?? null} /></h3>
  {#if data}
    <ol class="grid gap-2 md:grid-cols-2" data-testid="descendia-floors">
      {#each data.challenges as c (c.index)}
        <li class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
          <div class="flex items-center justify-between">
            <b>Andar {c.index}</b>
            {#if DESCENDIA.checkpoints.includes(c.index)}<span class="rounded bg-emerald-500/15 px-1.5 text-xs text-emerald-300">checkpoint</span>{/if}
          </div>
          {#if c.objective}<div>{c.objective}</div>{/if}
          {#if c.content}<div class="text-zinc-400">{c.content}</div>{/if}
          {#if c.penances.length}<div class="mt-1 text-xs text-rose-300">Penitências: {c.penances.join(' · ')}</div>{/if}
        </li>
      {/each}
    </ol>
  {:else}
    <p class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
      Não consegui carregar os andares desta semana{error ? ` (${error})` : ''}. As recompensas abaixo são fixas e continuam valendo.
    </p>
  {/if}

  <h3 class="font-medium">Recompensas semanais ({mode === 'normal' ? 'Normal' : 'Steel Path'})</h3>
  <div class="space-y-2" data-testid="descendia-rewards">
    {#each floors as n}
      {@const r = DESCENDIA_REWARDS[n][mode]}
      {#if r}
        <div class="rounded-lg border border-zinc-800 p-3">
          <div class="mb-1 text-sm font-semibold">Andar {n}{#if live.get(n)?.objective} <span class="font-normal text-zinc-400">· {live.get(n)?.objective}</span>{/if}</div>
          {@render group(r)}
        </div>
      {/if}
    {/each}
  </div>

  <ul class="list-disc space-y-1 pl-5 text-sm text-zinc-400">{#each DESCENDIA_NOTES as n}<li>{n}</li>{/each}</ul>

  <details class="rounded-lg border border-zinc-800 p-3">
    <summary class="cursor-pointer text-sm font-medium">Bênçãos dos santuários (andares 7 e 14)</summary>
    <div class="mt-2 grid gap-4 md:grid-cols-2 text-sm">
      <div><b>{DESCENDIA.sanctuaries[7]}</b><p class="text-zinc-400">{BLESSINGS.marie.join(' · ')}</p></div>
      <div><b>{DESCENDIA.sanctuaries[14]}</b><p class="text-zinc-400">{BLESSINGS.lyon.join(' · ')}</p></div>
    </div>
  </details>
  <Src href={WIKI.descendia} />
</section>
