<script lang="ts">
  import { api } from '$lib/api';

  type Item = { unique_name: string; name: string; type: string; variant: string | null };

  let q = $state('');
  let items = $state<Item[]>([]);
  let error = $state('');

  async function search() {
    error = '';
    try {
      items = await api<Item[]>(`/api/items?q=${encodeURIComponent(q)}`);
    } catch {
      error = 'Catálogo indisponível (ainda não sincronizado?).';
    }
  }
</script>

<h1 class="mb-2 text-2xl font-bold">Builder</h1>
<p class="mb-6 text-zinc-400">
  Em construção: slots de mods, Incarnon, cálculo de dano/DPS e Rivens entram a partir do motor em <code>packages/calc</code>.
</p>

<form onsubmit={(e) => { e.preventDefault(); search(); }} class="mb-4 flex gap-2">
  <input
    bind:value={q}
    placeholder="Buscar Warframe ou arma…"
    class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
  />
  <button class="rounded-lg bg-amber-500 px-4 py-2 font-medium text-zinc-950 hover:bg-amber-400">Buscar</button>
</form>

{#if error}<p class="text-sm text-red-400">{error}</p>{/if}
<ul class="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
  {#each items as it (it.unique_name)}
    <li class="flex justify-between px-3 py-2 text-sm"><span>{it.name}</span><span class="text-zinc-500">{it.type}</span></li>
  {/each}
</ul>
