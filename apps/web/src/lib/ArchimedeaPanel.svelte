<script lang="ts">
  import type { NArchimedea } from './world';
  import Countdown from './Countdown.svelte';
  let { data, error }: { data: NArchimedea[] | null; error?: string } = $props();
</script>

<section class="space-y-5">
  <h2 class="text-lg font-semibold">Archimedea desta semana</h2>
  {#if !data}
    <p class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Não carregou{error ? ` (${error})` : ''}. Tente de novo em alguns minutos.</p>
  {:else if !data.length}
    <p class="text-sm text-zinc-400">A API não listou nenhuma Archimedea agora.</p>
  {/if}
  {#each data ?? [] as a (a.id)}
    <div class="rounded-xl border border-zinc-800 p-4" data-testid="archimedea-{a.kind}">
      <div class="flex flex-wrap items-baseline justify-between gap-2"><h3 class="font-semibold">{a.title} <span class="text-sm font-normal text-zinc-400">· {a.place}</span></h3><Countdown to={a.expiry} /></div>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        {#each a.missions as m, i}
          <div class="rounded-lg bg-zinc-900/60 p-3 text-sm">
            <div class="font-semibold">Missão {i + 1}: {m.missionType}</div>
            <div class="text-xs text-zinc-400">{m.faction}</div>
            {#if m.deviation}<div class="mt-2"><b>{m.deviation.name}</b><div class="text-zinc-400">{m.deviation.description}</div></div>{/if}
            {#each m.risks as r}
              <div class="mt-1"><span class={r.elite ? 'text-fuchsia-300' : 'text-rose-300'}>{r.name}{r.elite ? ' (Elite)' : ''}</span><div class="text-xs text-zinc-400">{r.description}</div></div>
            {/each}
          </div>
        {/each}
      </div>
      {#if a.personalModifiers.length}
        <p class="mt-3 text-xs uppercase tracking-wide text-zinc-400">Modificadores pessoais</p>
        <ul class="text-sm">{#each a.personalModifiers as p}<li><b>{p.name}</b> <span class="text-zinc-400">· {p.description}</span></li>{/each}</ul>
      {/if}
    </div>
  {/each}
</section>
