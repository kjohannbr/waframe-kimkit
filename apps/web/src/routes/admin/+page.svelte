<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api, errorMessage } from '$lib/api';
  import { refreshSession, session } from '$lib/session.svelte';

  type Row = { id: string; email: string; display_name: string | null; role: string; created_at: number; last_login_at: number | null };
  let rows = $state<Row[]>([]);
  let error = $state('');
  let loading = $state(true);

  const fmt = (t: number | null) => (t ? new Date(t * 1000).toLocaleString('pt-BR') : '—');

  onMount(async () => {
    if (!session.ready) await refreshSession();
    if (session.user?.role !== 'admin') return void goto(`${base}/`, { replaceState: true });
    try {
      rows = await api<Row[]>('/api/admin/users');
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });
</script>

<h1 class="mb-1 text-2xl font-bold">Administração</h1>
<p class="mb-6 text-sm text-zinc-400">Usuários cadastrados{rows.length ? ` (${rows.length})` : ''}.</p>

{#if loading}
  <p class="text-zinc-400">Carregando…</p>
{:else if error}
  <p class="text-red-400">{error}</p>
{:else}
  <div class="overflow-x-auto rounded-xl border border-zinc-800">
    <table class="w-full text-left text-sm">
      <thead class="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
        <tr><th class="px-3 py-2">E-mail</th><th class="px-3 py-2">Nome</th><th class="px-3 py-2">Perfil</th><th class="px-3 py-2">Criado</th><th class="px-3 py-2">Último acesso</th></tr>
      </thead>
      <tbody class="divide-y divide-zinc-800">
        {#each rows as r (r.id)}
          <tr>
            <td class="px-3 py-2">{r.email}</td>
            <td class="px-3 py-2 text-zinc-400">{r.display_name ?? '—'}</td>
            <td class="px-3 py-2"><span class="rounded px-2 py-0.5 text-xs {r.role === 'admin' ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800 text-zinc-300'}">{r.role}</span></td>
            <td class="px-3 py-2 text-zinc-400">{fmt(r.created_at)}</td>
            <td class="px-3 py-2 text-zinc-400">{fmt(r.last_login_at)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
