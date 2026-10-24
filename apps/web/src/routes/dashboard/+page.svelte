<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api, ApiError, getToken, setToken } from '$lib/api';
  import { enablePush, disablePush, pushSupported } from '$lib/push';
  import { Bell, BellOff, RefreshCw } from '@lucide/svelte';
  import { loadWorld, syncWorld, fmtDate, type World } from '$lib/world';
  import { TABS, TASK_CATEGORY, isTab, nextReset, type TabId } from '$lib/weekly';
  import Countdown from '$lib/Countdown.svelte';
  import DescendiaPanel from '$lib/DescendiaPanel.svelte';
  import VendorsPanel from '$lib/VendorsPanel.svelte';
  import RewardsPanel from '$lib/RewardsPanel.svelte';
  import ArchimedeaPanel from '$lib/ArchimedeaPanel.svelte';

  type Status = 'todo' | 'doing' | 'done';
  type Task = { key: string; title: string; category: string; status: Status };

  const columns: { id: Status; label: string }[] = [
    { id: 'todo', label: 'A fazer' },
    { id: 'doing', label: 'Em progresso' },
    { id: 'done', label: 'Concluído' }
  ];

  let tasks = $state<Task[]>([]);
  let period = $state('');
  let loading = $state(true);
  let pushOn = $state(false);
  let dragKey: string | null = null;
  let world = $state<World | null>(null);
  let worldLoading = $state(true);
  let tab = $state<TabId>('quadro');
  const reset = nextReset();
  const errors = $derived(world?.errors ?? {});

  let syncing = $state(false);
  let syncMsg = $state('');

  /** Busca dados novos do jogo e recarrega o quadro (a semana pode ter virado). */
  async function sync() {
    if (syncing) return;
    syncing = true;
    syncMsg = '';
    const w = await syncWorld();
    if (w) {
      world = w;
      try {
        const r = await api<{ period: string; tasks: Task[] }>('/api/tasks');
        tasks = r.tasks ?? [];
        period = r.period ?? '';
      } catch { /* mantém o quadro atual */ }
      syncMsg = w.stale.length ? `Sincronizado, mas ${w.stale.join(', ')} veio do cache.` : 'Tudo atualizado.';
    } else {
      syncMsg = 'Não foi possível sincronizar agora. Tente de novo em instantes.';
    }
    syncing = false;
  }

  function pick(id: TabId) {
    tab = id;
    history.replaceState(history.state, '', `#${id}`);
  }

  onMount(async () => {
    const h = location.hash.slice(1);
    if (isTab(h)) tab = h;
    if (!getToken()) return void goto(`${base}/`);
    loadWorld().then((w) => { world = w; worldLoading = false; });
    try {
      const r = await api<{ period: string; tasks: Task[] }>('/api/tasks');
      tasks = r.tasks ?? [];
      period = r.period ?? '';
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await setToken(null);
        await goto(`${base}/`);
      }
    } finally {
      loading = false;
    }
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.getRegistration(`${base}/`);
      pushOn = !!(await reg?.pushManager.getSubscription());
    }
  });

  async function move(key: string, status: Status) {
    const t = tasks.find((x) => x.key === key);
    if (!t || t.status === status) return;
    const prev = t.status;
    t.status = status; // otimista
    try {
      await api(`/api/tasks/${key}`, { method: 'PUT', json: { status } });
    } catch {
      t.status = prev; // desfaz se falhar
    }
  }

  async function togglePush() {
    if (pushOn) { await disablePush(); pushOn = false; }
    else pushOn = await enablePush();
  }
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h1 class="text-2xl font-bold">Resets semanais</h1>
    {#if period}<p class="text-sm text-zinc-400">Semana iniciada em {period} · reseta segunda 00:00 UTC (domingo 21:00 em Brasília)</p>{/if}
  </div>
  {#if pushSupported()}
    <button
      onclick={togglePush}
      class="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-amber-400"
    >
      {#if pushOn}<BellOff size={16} /> Desativar avisos{:else}<Bell size={16} /> Ativar avisos de reset{/if}
    </button>
  {/if}
</div>

<div class="mb-4 flex flex-wrap items-center gap-2" role="tablist">
  {#each TABS as t}
    <button role="tab" aria-selected={tab === t.id} onclick={() => pick(t.id)} class="rounded-lg px-3 py-1.5 text-sm {tab === t.id ? 'bg-amber-400 font-semibold text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700'}">{t.label}</button>
  {/each}
  <span class="ml-auto flex items-center gap-3">
    {#if world}<span class="hidden text-xs text-zinc-500 sm:inline">Dados de {fmtDate(world.fetchedAt)}</span>{/if}
    <Countdown to={reset} />
    <button onclick={sync} disabled={syncing} data-testid="sync" class="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-amber-400 disabled:opacity-60">
      <RefreshCw size={14} class={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando…' : 'Sincronizar'}
    </button>
  </span>
</div>

{#if syncMsg}<p class="mb-4 text-sm text-zinc-400" role="status" data-testid="sync-msg">{syncMsg}</p>{/if}
{#if !worldLoading && !world && tab !== 'quadro'}
  <p class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200" data-testid="world-error">
    Não consegui buscar os dados ao vivo da semana (API fora do ar ou sem resposta). Os dados fixos continuam abaixo.
  </p>
{/if}
{#if world && world.stale.length && tab !== 'quadro'}
  <p class="mb-4 text-xs text-zinc-500">Alguns dados vieram do cache: {world.stale.join(', ')}.</p>
{/if}

{#if tab === 'descendia'}
  <DescendiaPanel data={world?.descendia ?? null} error={errors.descendia} />
{:else if tab === 'mercadores'}
  <VendorsPanel baro={world?.baro ?? null} varzia={world?.varzia ?? null} steelPath={world?.steelPath ?? null} {errors} />
{:else if tab === 'recompensas'}
  <RewardsPanel circuit={world?.circuit ?? null} archon={world?.archon ?? null} nightwave={world?.nightwave ?? null} {reset} {errors} />
{:else if tab === 'archimedea'}
  <ArchimedeaPanel data={world?.archimedeas ?? null} error={errors.archimedeas} />
{:else if loading}
  <p class="text-zinc-400">Carregando…</p>
{:else}
  <div class="grid gap-4 md:grid-cols-3">
    {#each columns as col}
      <div
        role="list"
        class="min-h-48 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
        ondragover={(e) => e.preventDefault()}
        ondrop={() => dragKey && move(dragKey, col.id)}
      >
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {col.label} · {tasks.filter((t) => t.status === col.id).length}
        </h2>
        <div class="space-y-2">
          {#each tasks.filter((t) => t.status === col.id) as t (t.key)}
            <div
              role="listitem"
              draggable="true"
              ondragstart={() => (dragKey = t.key)}
              class="cursor-grab rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm active:cursor-grabbing"
            >
              <div class="font-medium">{t.title}</div>
              {#if TASK_CATEGORY[t.category]}
                {@const c = TASK_CATEGORY[t.category]}
                <div class="mt-1 flex items-center gap-2 text-xs">
                  <span class="rounded px-1.5 py-0.5 {c.color}">{c.label}</span>
                  {#if c.tab}<button class="text-zinc-400 underline hover:text-amber-300" onclick={() => pick(c.tab as TabId)}>ver detalhes</button>{/if}
                </div>
              {/if}
              <div class="mt-2 flex gap-1 md:hidden">
                {#each columns.filter((c) => c.id !== t.status) as c}
                  <button class="rounded bg-zinc-700 px-2 py-0.5 text-xs" onclick={() => move(t.key, c.id)}>→ {c.label}</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}
