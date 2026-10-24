<script lang="ts">
  import type { NSteelPath, NTrader } from './world';
  import { fmtDate } from './world';
  import Countdown from './Countdown.svelte';
  import OfferTable from './OfferTable.svelte';
  import Src from './Src.svelte';
  import {
    ACRITHIS_DAILY, ACRITHIS_WEEKLY, AYATAN_ROTATION, CAVALERO_BUNDLES, KAYA_OFFERS, PALLADINO, WIKI, YONTA_OFFERS,
    varziaKind, varziaLabel, varziaPrice
  } from './weekly';

  let { baro, varzia, steelPath, errors }: { baro: NTrader | null; varzia: NTrader | null; steelPath: NSteelPath | null; errors: Record<string, string> } = $props();

  const varziaGroups = $derived.by(() => {
    const items = varzia?.inventory ?? [];
    return [
      { id: 'pack', label: 'Packs e sets Prime', list: items.filter((i) => varziaKind(i.name) === 'pack') },
      { id: 'item', label: 'Itens', list: items.filter((i) => varziaKind(i.name) === 'item') },
      { id: 'relic', label: 'Relíquias', list: items.filter((i) => varziaKind(i.name) === 'relic') }
    ].filter((g) => g.list.length);
  });
</script>

<section class="space-y-5">
  <h2 class="text-lg font-semibold">Mercadores desta semana</h2>

  <!-- Teshin -->
  <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-teshin">
    <div class="flex flex-wrap items-baseline justify-between"><h3 class="font-semibold">Teshin · Steel Path Honors</h3><Countdown to={steelPath?.expiry ?? null} label="Rotação troca em" /></div>
    {#if steelPath}
      {#if steelPath.current}<p class="mt-2 text-sm">Oferta rotativa: <b class="text-amber-300">{steelPath.current.name}</b> <span class="text-zinc-400">· {steelPath.current.cost ?? '?'} Steel Essence</span></p>{/if}
      {#if steelPath.rotation.length}
        <p class="mt-2 text-xs text-zinc-400">Próximas na rotação</p>
        <OfferTable offers={steelPath.rotation.map((r) => ({ name: r.name, price: `${r.cost ?? '?'} Steel Essence` }))} />
      {/if}
      <details class="mt-2"><summary class="cursor-pointer text-sm">Itens fixos</summary>
        <OfferTable offers={steelPath.evergreens.map((r) => ({ name: r.name, price: `${r.cost ?? '?'} Steel Essence` }))} />
      </details>
    {:else}<p class="mt-2 text-sm text-amber-200">Não carregou{errors.steelPath ? ` (${errors.steelPath})` : ''}.</p>{/if}
  </div>

  <!-- Varzia -->
  <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-varzia">
    <div class="flex flex-wrap items-baseline justify-between"><h3 class="font-semibold">Varzia · Prime Resurgence {#if varzia?.location}<span class="text-sm font-normal text-zinc-400">({varzia.location})</span>{/if}</h3><Countdown to={varzia?.expiry ?? null} label="Troca em" /></div>
    {#if varzia}
      {#if !varzia.inventory.length}<p class="mt-2 text-sm text-zinc-400">Estoque vazio na API agora.</p>{/if}
      {#each varziaGroups as g}
        <p class="mt-3 text-xs uppercase tracking-wide text-zinc-400">{g.label} · {g.list.length}</p>
        <ul class="divide-y divide-zinc-800 text-sm">
          {#each g.list as i}<li class="flex justify-between gap-3 py-1"><span>{varziaLabel(i.name)}</span><span class="text-zinc-400">{varziaPrice(i)}</span></li>{/each}
        </ul>
      {/each}
      <p class="mt-2 text-xs text-zinc-500">Moeda deduzida do formato da API (Regal Aya / Aya); confira o preço no jogo antes de gastar. Atualizado {fmtDate(varzia.activation)}.</p>
    {:else}<p class="mt-2 text-sm text-amber-200">Não carregou{errors.varzia ? ` (${errors.varzia})` : ''}.</p>{/if}
  </div>

  <!-- Baro -->
  <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-baro">
    <div class="flex flex-wrap items-baseline justify-between"><h3 class="font-semibold">Baro Ki'Teer · Void Trader {#if baro?.location}<span class="text-sm font-normal text-zinc-400">({baro.location})</span>{/if}</h3><Countdown to={baro?.expiry ?? null} label="Sai em" /></div>
    {#if baro}
      {#if baro.inventory.length}
        <OfferTable offers={baro.inventory.map((i) => ({ name: i.name, price: `${i.ducats ?? '?'} Ducats + ${(i.credits ?? 0).toLocaleString('pt-BR')} Credits` }))} />
      {:else}
        <p class="mt-2 text-sm text-zinc-400">Ainda não chegou: aparece em {fmtDate(baro.activation)} e fica até {fmtDate(baro.expiry)}. O estoque só é divulgado quando ele chega.</p>
      {/if}
    {:else}<p class="mt-2 text-sm text-amber-200">Não carregou{errors.baro ? ` (${errors.baro})` : ''}.</p>{/if}
  </div>

  <!-- Iron Wake -->
  <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-palladino">
    <h3 class="font-semibold">Palladino · Iron Wake <span class="text-sm font-normal text-zinc-400">(Riven Slivers, reseta segunda)</span></h3>
    <OfferTable offers={PALLADINO} />
    <Src href={WIKI.palladino} />
  </div>

  <!-- Acrithis -->
  <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-acrithis">
    <h3 class="font-semibold">Acrithis · Pathos Clamps</h3>
    <p class="mt-1 text-sm text-amber-200">A API não publica quais 5 itens semanais estão à venda: o jogo sorteia entre os abaixo. Confira com ele em Sanctum Anatomica.</p>
    <p class="mt-2 text-xs uppercase tracking-wide text-zinc-400">Pool semanal (5 por semana)</p>
    <OfferTable offers={ACRITHIS_WEEKLY} />
    <details class="mt-2"><summary class="cursor-pointer text-sm">Pool diário de arcanes (reseta 00:00 UTC)</summary><OfferTable offers={ACRITHIS_DAILY} /></details>
    <Src href={WIKI.acrithis} />
  </div>

  <!-- Maroo, Kaya, Yonta, Cavalero, Bird 3 -->
  <div class="grid gap-4 md:grid-cols-2">
    <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-maroo">
      <h3 class="font-semibold">Maroo · Ayatan Treasure Hunt</h3>
      <p class="text-sm text-amber-200">A API não informa qual é a semana atual; a rotação tem 6 semanas:</p>
      <ul class="mt-1 text-sm">{#each AYATAN_ROTATION as a}<li class="flex justify-between"><span>Semana {a.week}: {a.treasure}</span><span class="text-zinc-400">{a.tileset}</span></li>{/each}</ul>
      <Src href={WIKI.maroo} />
    </div>
    <div class="space-y-4">
      <div class="rounded-xl border border-zinc-800 p-4"><h3 class="font-semibold">Kaya · Peely Pix</h3><OfferTable offers={KAYA_OFFERS} /><Src href={WIKI.kaya} /></div>
      <div class="rounded-xl border border-zinc-800 p-4"><h3 class="font-semibold">Archimedean Yonta</h3><OfferTable offers={YONTA_OFFERS} /><Src href={WIKI.yonta} /></div>
      <div class="rounded-xl border border-zinc-800 p-4"><h3 class="font-semibold">Bird 3</h3><p class="text-sm text-amber-200">Vende 1 Archon Shard por semana; a API não diz qual. Veja o do Archon Hunt na aba Recompensas e confira no jogo.</p><Src href={WIKI.bird3} /></div>
    </div>
  </div>

  <div class="rounded-xl border border-zinc-800 p-4" data-testid="vendor-cavalero">
    <h3 class="font-semibold">Cavalero · Incarnon Genesis Adapters</h3>
    <p class="text-sm text-zinc-400">Pacotes de adaptadores Incarnon (fonte: wiki).</p>
    <ul class="mt-1 text-sm">{#each CAVALERO_BUNDLES as c}<li class="flex justify-between gap-3 py-0.5"><b>{c.adapter}</b><span class="text-zinc-400">{c.cost}</span></li>{/each}</ul>
    <Src href={WIKI.cavalero} />
  </div>
</section>
