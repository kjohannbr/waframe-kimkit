<script lang="ts">
  import type { NArchon, NCircuit, NNightwave } from './world';
  import { fmtDate } from './world';
  import Countdown from './Countdown.svelte';
  import Src from './Src.svelte';
  import {
    ARCHON_DROPS, ARCHON_NOTES, CIRCUIT_NORMAL, CIRCUIT_NORMAL_TIERS, CIRCUIT_NOTES, DEEP_NOTES, DEEP_TIERS, NETRACELLS_NOTES,
    OTHER_TIMES, OTHER_WEEKLY, SEARCH_PULSES, TEMPORAL_NOTES, WIKI, archonShard, circuitNormalWeek, circuitSteelWeek
  } from './weekly';

  let { circuit, archon, nightwave, reset, errors }: { circuit: NCircuit | null; archon: NArchon | null; nightwave: NNightwave | null; reset: Date; errors: Record<string, string> } = $props();

  const normal = $derived(circuit ? circuitNormalWeek(circuit.normal) : null);
  const steel = $derived(circuit ? circuitSteelWeek(circuit.steelPath) : null);
  const shard = $derived(archon ? archonShard(archon.boss) : null);
  const weekly = $derived((nightwave?.acts ?? []).filter((a) => a.kind !== 'daily'));
</script>

<section class="space-y-5">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <h2 class="text-lg font-semibold">Recompensas semanais</h2><Countdown to={reset} label="Tudo reseta em" />
  </div>

  <div class="rounded-xl border border-zinc-800 p-4" data-testid="rewards-circuit">
    <h3 class="font-semibold">The Circuit (Duviri)</h3>
    {#if circuit}
      <p class="mt-1 text-sm">Normal: <b class="text-amber-300">{circuit.normal.join(', ') || '—'}</b>{#if normal} <span class="text-zinc-400">· semana {normal.week}/11</span>{/if}</p>
      {#if normal}<p class="text-sm text-zinc-400">Mods associados: {normal.picks.map((p) => `${p.frame} → ${p.mod}`).join(' · ')}</p>{/if}
      <p class="mt-1 text-sm">Steel Path: <b class="text-amber-300">{circuit.steelPath.join(', ') || '—'}</b>{#if steel} <span class="text-zinc-400">· rotação {steel.letter} ({steel.week}/9)</span>{/if}</p>
    {:else}<p class="mt-1 text-sm text-amber-200">Escolhas da semana não carregaram{errors.circuit ? ` (${errors.circuit})` : ''}. Rotação normal de 11 semanas: {CIRCUIT_NORMAL.length} conjuntos fixos.</p>{/if}
    <p class="mt-2 text-sm text-zinc-400">{CIRCUIT_NOTES.normal}</p>
    <details class="mt-2"><summary class="cursor-pointer text-sm">Recompensas por tier (Normal)</summary>
      <table class="mt-2 w-full text-sm"><tbody>
        {#each CIRCUIT_NORMAL_TIERS as t}<tr class="border-t border-zinc-800"><td class="py-1 pr-2 font-semibold">{t.tier}</td><td class="pr-2">{t.reward}</td><td class="text-zinc-400">{t.progress}</td></tr>{/each}
      </tbody></table>
      <p class="mt-1 text-xs text-zinc-500">{CIRCUIT_NOTES.progress}</p>
    </details>
    <p class="mt-2 text-sm text-zinc-400">{CIRCUIT_NOTES.steel}</p>
    <Src href={WIKI.circuit} />
  </div>

  <div class="rounded-xl border border-zinc-800 p-4" data-testid="rewards-archon">
    <h3 class="font-semibold">Archon Hunt</h3>
    {#if archon}
      <p class="mt-1 text-sm"><b class="text-amber-300">{archon.boss}</b> ({archon.faction}) {#if shard}· garante <span class={shard.color}>{shard.shard}</span>{/if} <Countdown to={archon.expiry} label="· até" /></p>
      <ol class="ml-5 list-decimal text-sm text-zinc-400">{#each archon.missions as m}<li>{m.type} · {m.node}</li>{/each}</ol>
    {:else}<p class="mt-1 text-sm text-amber-200">Não carregou{errors.archon ? ` (${errors.archon})` : ''}.</p>{/if}
    <details class="mt-2"><summary class="cursor-pointer text-sm">Tabela de drops</summary>
      <ul class="mt-1 text-sm">{#each ARCHON_DROPS as d}<li class="flex justify-between gap-3"><span>{d.name}</span><span class="text-zinc-400">{d.chance}</span></li>{/each}</ul>
    </details>
    <ul class="mt-2 list-disc pl-5 text-sm text-zinc-400">{#each ARCHON_NOTES as n}<li>{n}</li>{/each}</ul>
    <Src href={WIKI.archonHunt} />
  </div>

  <div class="rounded-xl border border-zinc-800 p-4" data-testid="rewards-archimedea">
    <h3 class="font-semibold">Deep Archimedea · faixas de Research Points</h3>
    <p class="text-sm text-zinc-400">{SEARCH_PULSES}</p>
    <table class="mt-2 w-full text-sm"><tbody>
      {#each DEEP_TIERS as t}<tr class="border-t border-zinc-800"><td class="w-16 py-1 font-semibold">{t.rp} RP</td><td>{t.reward}</td><td class="text-right text-xs text-fuchsia-300">{t.elite ? 'Elite' : ''}</td></tr>{/each}
    </tbody></table>
    <ul class="mt-2 list-disc pl-5 text-sm text-zinc-400">{#each DEEP_NOTES as n}<li>{n}</li>{/each}</ul>
    <Src href={WIKI.deepArchimedea} />
    <h3 class="mt-4 font-semibold">Temporal Archimedea (1999)</h3>
    <ul class="mt-1 list-disc pl-5 text-sm text-zinc-400">{#each TEMPORAL_NOTES as n}<li>{n}</li>{/each}</ul>
    <Src href={WIKI.temporalArchimedea} />
  </div>

  <div class="rounded-xl border border-zinc-800 p-4">
    <h3 class="font-semibold">Netracells</h3>
    <ul class="mt-1 list-disc pl-5 text-sm text-zinc-400">{#each NETRACELLS_NOTES as n}<li>{n}</li>{/each}</ul>
    <Src href={WIKI.netracells} />
  </div>

  <div class="rounded-xl border border-zinc-800 p-4" data-testid="rewards-nightwave">
    <h3 class="font-semibold">Nightwave {#if nightwave?.season != null}<span class="text-sm font-normal text-zinc-400">· temporada {nightwave.season}</span>{/if}</h3>
    {#if nightwave}
      {#if weekly.length}
        <ul class="divide-y divide-zinc-800 text-sm">
          {#each weekly as a}
            <li class="py-1.5"><div class="flex justify-between gap-3"><b>{a.title}{#if a.kind === 'elite'} <span class="text-xs text-fuchsia-300">Elite</span>{/if}</b><span class="text-amber-300">{a.reputation ?? '?'} rep</span></div>
              <div class="text-zinc-400">{a.desc}</div></li>
          {/each}
        </ul>
      {:else}<p class="text-sm text-zinc-400">Sem atos semanais ativos agora.</p>{/if}
    {:else}<p class="text-sm text-amber-200">Não carregou{errors.nightwave ? ` (${errors.nightwave})` : ''}.</p>{/if}
  </div>

  <div class="rounded-xl border border-zinc-800 p-4">
    <h3 class="font-semibold">Outros resets semanais (segunda 00:00 UTC)</h3>
    <ul class="mt-1 grid list-disc gap-x-6 pl-5 text-sm text-zinc-300 md:grid-cols-2">{#each OTHER_WEEKLY as o}<li>{o}</li>{/each}</ul>
    <ul class="mt-2 list-disc pl-5 text-xs text-zinc-500">{#each OTHER_TIMES as o}<li>{o}</li>{/each}</ul>
    <Src href={WIKI.weeklyReset} />
  </div>
</section>
