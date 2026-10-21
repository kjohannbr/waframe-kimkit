<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api, ApiError, getToken, setToken } from '$lib/api';
  import { enablePush, disablePush, pushSupported } from '$lib/push';
  import { Bell, BellOff } from '@lucide/svelte';

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

  onMount(async () => {
    if (!getToken()) return void goto(`${base}/`);
    try {
      const r = await api<{ period: string; tasks: Task[] }>('/api/tasks');
      tasks = r.tasks;
      period = r.period;
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

{#if loading}
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
