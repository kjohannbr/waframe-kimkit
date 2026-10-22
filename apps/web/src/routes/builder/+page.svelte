<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { api, errorMessage, getToken } from '$lib/api';
  import { compatibleMods, loadCatalog, type Item, type Mod, type Searchable } from '$lib/catalog';
  import { POLARITIES, emptyBuild, equippedIds, loadBuild, saveBuild, summarize, type Build, type Slot } from '$lib/builder';
  import ItemSearch from '$lib/ItemSearch.svelte';
  import ModImage from '$lib/ModImage.svelte';
  import ModPicker from '$lib/ModPicker.svelte';
  import ModSlot from '$lib/ModSlot.svelte';
  import { session } from '$lib/session.svelte';
  import { RotateCcw, Save } from '@lucide/svelte';

  type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

  let catalog = $state<Catalog | null>(null);
  let loadError = $state('');
  let item = $state<Searchable<Item> | null>(null);
  let build = $state<Build | null>(null);
  let picker = $state<{ kind: 'main' | 'aura' | 'stance'; index: number } | null>(null);
  let search: ItemSearch | undefined = $state();
  let buildName = $state('');
  let saveMsg = $state<{ ok: boolean; text: string } | null>(null);
  let saving = $state(false);

  const modsById = $derived(new Map<string, Mod>((catalog?.mods ?? []).map((m) => [m.id, m])));
  const summary = $derived(build ? summarize(build, modsById) : null);
  const pct = $derived(summary ? Math.min(100, Math.round((summary.used / Math.max(summary.capacity, 1)) * 100)) : 0);

  onMount(async () => {
    try {
      catalog = await loadCatalog(base);
    } catch {
      loadError = 'Não consegui carregar o catálogo. Recarregue a página.';
      return;
    }
    // link direto: /builder?item=Nukor
    const wanted = new URLSearchParams(location.search).get('item');
    const found = wanted && catalog.items.find((i) => i.name.toLowerCase() === wanted.toLowerCase());
    if (found) {
      pick(found);
      search?.setQuery(found.name);
    }
  });

  function pick(it: Searchable<Item>) {
    item = it;
    build = loadBuild(it);
    buildName = `${it.name} — minha build`;
    saveMsg = null;
    const url = new URL(location.href);
    url.searchParams.set('item', it.name);
    history.replaceState(history.state, '', url);
  }

  // salva automaticamente no navegador a cada mudança
  $effect(() => {
    if (build) saveBuild($state.snapshot(build));
  });

  function slotAt(kind: 'main' | 'aura' | 'stance', index: number): Slot {
    return kind === 'aura' ? build!.aura! : kind === 'stance' ? build!.stance! : build!.slots[index];
  }

  function onpick(m: Mod) {
    if (!picker || !build) return;
    const s = slotAt(picker.kind, picker.index);
    s.modId = m.id;
    s.rank = m.maxRank; // por padrão, rank máximo
    picker = null;
  }

  function rank(kind: 'main' | 'aura' | 'stance', index: number, delta: number) {
    const s = slotAt(kind, index);
    const m = s.modId ? modsById.get(s.modId) : undefined;
    if (m) s.rank = Math.max(0, Math.min(m.maxRank, s.rank + delta));
  }

  function cyclePolarity(kind: 'main' | 'aura' | 'stance', index: number) {
    const s = slotAt(kind, index);
    const order = [null, ...POLARITIES];
    s.polarity = order[(order.indexOf(s.polarity as never) + 1) % order.length] ?? null;
  }

  function reset() {
    if (item && confirm('Limpar todos os mods desta build?')) build = emptyBuild(item);
  }

  async function saveToAccount() {
    if (!item || !build) return;
    saving = true;
    saveMsg = null;
    try {
      await api('/api/builds', {
        method: 'POST',
        json: { item_unique: item.id, item_type: item.category, name: buildName.trim() || item.name, visibility: 'private', config: $state.snapshot(build) }
      });
      saveMsg = { ok: true, text: 'Build salva na sua conta.' };
    } catch (e) {
      saveMsg = { ok: false, text: errorMessage(e) };
    } finally {
      saving = false;
    }
  }

  const pickerMods = $derived(item && catalog && picker ? compatibleMods(catalog.mods, item, picker.kind) : []);
  const pickerTitle = $derived(picker?.kind === 'aura' ? 'Escolher aura' : picker?.kind === 'stance' ? 'Escolher postura' : `Mods para ${item?.name ?? ''}`);

  // ── exibição dos atributos base ──
  const pctFmt = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const statRows = $derived.by(() => {
    if (!item) return [] as [string, string][];
    const s = item.stats;
    const rows: [string, string | undefined][] = [
      ['Dano total', s.totalDamage?.toString()],
      ['Chance crítica', s.criticalChance !== undefined ? pctFmt(s.criticalChance) : undefined],
      ['Multiplicador crít.', s.criticalMultiplier !== undefined ? `${s.criticalMultiplier}x` : undefined],
      ['Chance de status', s.procChance !== undefined ? pctFmt(s.procChance) : undefined],
      ['Cadência', s.fireRate?.toString()],
      ['Recarga', s.reloadTime !== undefined ? `${s.reloadTime}s` : undefined],
      ['Carregador', s.magazineSize?.toString()],
      ['Multishot', s.multishot?.toString()],
      ['Alcance', s.range?.toString()],
      ['Vida', s.health?.toString()],
      ['Escudo', s.shield?.toString()],
      ['Armadura', s.armor?.toString()],
      ['Energia', s.power?.toString()],
      ['Velocidade', s.sprintSpeed?.toString()],
      ['Disposição Riven', s.disposition ? '●'.repeat(Math.round(s.disposition)) + '○'.repeat(5 - Math.round(s.disposition)) : undefined]
    ];
    return rows.filter((r): r is [string, string] => r[1] !== undefined);
  });
</script>

<div class="mb-6">
  <h1 class="mb-1 text-2xl font-bold">Builder</h1>
  <p class="text-sm text-zinc-400">Busque qualquer Warframe ou arma. A lista completa aparece enquanto você digita.</p>
</div>

{#if loadError}
  <p class="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{loadError}</p>
{:else if !catalog}
  <p class="text-zinc-400">Carregando catálogo…</p>
{:else}
  <ItemSearch bind:this={search} items={catalog.items} onselect={pick} />
  <p class="mt-2 text-xs text-zinc-600">
    {catalog.items.length} itens · {catalog.mods.length} mods{catalog.generatedAt ? ` · atualizado em ${new Date(catalog.generatedAt).toLocaleDateString('pt-BR')}` : ''}
  </p>

  {#if item && build && summary}
    <div class="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <!-- ── Item ── -->
      <aside class="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <ModImage file={item.image} alt={item.name} class="mx-auto mb-3 h-44 w-full object-contain" />
        <h2 class="text-xl font-semibold">{item.name}</h2>
        <p class="text-sm text-zinc-400">{item.category} · {item.type}{item.mastery ? ` · MR ${item.mastery}` : ''}</p>
        {#if item.tags.length}
          <div class="mt-2 flex flex-wrap gap-1">
            {#each item.tags as t}<span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{t}</span>{/each}
          </div>
        {/if}
        <dl class="mt-4 space-y-1.5 text-sm">
          {#each statRows as [k, v]}
            <div class="flex justify-between gap-3 border-b border-zinc-800/70 pb-1">
              <dt class="text-zinc-400">{k}</dt>
              <dd class="tabular-nums">{v}</dd>
            </div>
          {/each}
        </dl>
        <p class="mt-3 text-xs text-zinc-600">Valores base, antes dos mods.</p>
      </aside>

      <!-- ── Mods ── -->
      <section>
        {#if item.modTypes.length === 0}
          <p class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">Os mods deste tipo de item ainda não foram mapeados.</p>
        {:else}
          <div class="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div class="text-sm">
                Capacidade: <strong class="tabular-nums {summary.over ? 'text-red-400' : 'text-amber-300'}">{summary.used}</strong>
                <span class="text-zinc-500"> / {summary.capacity}</span>
                {#if summary.over}<span class="ml-2 text-red-400">excedida em {-summary.free}</span>{/if}
              </div>
              <div class="flex items-center gap-3">
                <label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" bind:checked={build.reactor} class="accent-amber-400" />
                  {item.slotKind === 'warframe' ? 'Reator Orokin' : 'Catalisador Orokin'}
                </label>
                <button type="button" onclick={reset} class="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-red-400 hover:text-red-300"><RotateCcw size={13} /> Limpar</button>
              </div>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div class="h-full rounded-full transition-all {summary.over ? 'bg-red-500' : 'bg-amber-400'}" style="width: {pct}%"></div>
            </div>
          </div>

          {#if build.aura || build.stance}
            <div class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {#if build.aura}
                <ModSlot label="Aura" slot={build.aura} mod={build.aura.modId ? modsById.get(build.aura.modId) : undefined} isAura
                  onopen={() => (picker = { kind: 'aura', index: 0 })}
                  onclear={() => (build!.aura!.modId = null)}
                  onrank={(d) => rank('aura', 0, d)} onpolarity={() => cyclePolarity('aura', 0)} />
              {/if}
              {#if build.stance}
                <ModSlot label="Postura" slot={build.stance} mod={build.stance.modId ? modsById.get(build.stance.modId) : undefined}
                  onopen={() => (picker = { kind: 'stance', index: 0 })}
                  onclear={() => (build!.stance!.modId = null)}
                  onrank={(d) => rank('stance', 0, d)} onpolarity={() => cyclePolarity('stance', 0)} />
              {/if}
            </div>
          {/if}

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {#each build.slots as s, i}
              <ModSlot label={`Slot ${i + 1}`} slot={s} mod={s.modId ? modsById.get(s.modId) : undefined}
                onopen={() => (picker = { kind: 'main', index: i })}
                onclear={() => (s.modId = null)}
                onrank={(d) => rank('main', i, d)} onpolarity={() => cyclePolarity('main', i)} />
            {/each}
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <input bind:value={buildName} maxlength="80" aria-label="Nome da build" class="min-w-48 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-400" />
            {#if session.user || getToken()}
              <button type="button" onclick={saveToAccount} disabled={saving} class="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60"><Save size={15} /> {saving ? 'Salvando…' : 'Salvar na conta'}</button>
            {:else}
              <a href="{base}/" class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-amber-400">Entre para salvar na conta</a>
            {/if}
            {#if saveMsg}<span class="text-sm {saveMsg.ok ? 'text-emerald-400' : 'text-red-400'}">{saveMsg.text}</span>{/if}
          </div>
          <p class="mt-2 text-xs text-zinc-600">A build também fica salva automaticamente neste navegador. Clique na sigla de polaridade de um slot para trocar (Forma). A posição das polaridades iniciais é aproximada.</p>
        {/if}
      </section>
    </div>
  {:else}
    <div class="mt-10 rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">Escolha um item acima para montar a build.</div>
  {/if}

  {#if picker && build && item}
    <ModPicker title={pickerTitle} mods={pickerMods} taken={(() => { const t = equippedIds(build); const cur = slotAt(picker.kind, picker.index); if (cur.modId) t.delete(cur.modId); return t; })()}
      compatFilter={picker.kind === 'stance'} {onpick} onclose={() => (picker = null)} />
  {/if}
{/if}
