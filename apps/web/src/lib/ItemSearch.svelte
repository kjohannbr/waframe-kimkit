<script lang="ts">
  import { highlight, search, type Item, type Searchable } from './catalog';
  import ModImage from './ModImage.svelte';
  import { Search, X } from '@lucide/svelte';

  let { items, onselect }: { items: Searchable<Item>[]; onselect: (item: Searchable<Item>) => void } = $props();

  let q = $state('');
  let open = $state(false);
  let active = $state(0);
  let cat = $state('');
  let listEl: HTMLElement | undefined = $state();

  const categories = $derived([...new Set(items.map((i) => i.category))]);
  const results = $derived(search(items, q, { limit: 80, filter: cat ? (i) => i.category === cat : undefined }));

  $effect(() => {
    results; // resultado mudou → volta para o primeiro
    active = 0;
  });

  function choose(item: Searchable<Item>) {
    q = item.name;
    open = false;
    onselect(item);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open = true;
      active = Math.min(active + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      open = false;
    }
    queueMicrotask(() => listEl?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
  }

  export function setQuery(v: string) {
    q = v;
  }
</script>

<svelte:window onpointerdown={(e) => { if (!(e.target as HTMLElement).closest('[data-itemsearch]')) open = false; }} />

<div class="relative" data-itemsearch>
  <div class="relative">
    <Search size={18} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
    <input
      bind:value={q}
      onfocus={() => (open = true)}
      oninput={() => (open = true)}
      {onkeydown}
      role="combobox"
      aria-expanded={open}
      aria-controls="item-results"
      aria-autocomplete="list"
      autocomplete="off"
      spellcheck="false"
      placeholder="Digite o nome de um Warframe ou arma… (ex.: nukor, so, kuva)"
      class="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-10 text-base outline-none focus:border-amber-400"
    />
    {#if q}
      <button type="button" aria-label="Limpar" onclick={() => { q = ''; open = true; }} class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200">
        <X size={18} />
      </button>
    {/if}
  </div>

  <div class="mt-2 flex flex-wrap gap-1.5">
    <button type="button" onclick={() => (cat = '')} class="rounded-full border px-3 py-1 text-xs {cat === '' ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}">Todos</button>
    {#each categories as c}
      <button type="button" onclick={() => (cat = cat === c ? '' : c)} class="rounded-full border px-3 py-1 text-xs {cat === c ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}">{c}</button>
    {/each}
  </div>

  {#if open && q.trim()}
    <ul
      bind:this={listEl}
      id="item-results"
      role="listbox"
      class="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
    >
      {#each results as it, i (it.id)}
        {@const [a, m, b] = highlight(it.name, q)}
        <li role="option" aria-selected={i === active}>
          <button
            type="button"
            onclick={() => choose(it)}
            onpointermove={() => (active = i)}
            class="flex w-full items-center gap-3 px-3 py-2 text-left {i === active ? 'bg-zinc-800' : ''}"
          >
            <ModImage file={it.image} alt={it.name} class="h-10 w-10 shrink-0 rounded object-contain" />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{a}{#if m}<mark class="rounded bg-amber-400/25 px-0.5 text-amber-200">{m}</mark>{/if}{b}</span>
              <span class="block truncate text-xs text-zinc-500">{it.category} · {it.type}{it.mastery ? ` · MR ${it.mastery}` : ''}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="px-4 py-6 text-center text-sm text-zinc-500">Nada encontrado para “{q}”.</li>
      {/each}
      {#if results.length === 80}
        <li class="px-4 py-2 text-center text-xs text-zinc-500">Mostrando os 80 primeiros — digite mais para refinar.</li>
      {/if}
    </ul>
  {/if}
</div>
