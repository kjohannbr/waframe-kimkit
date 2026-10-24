<script lang="ts">
  import type { Offer } from './weekly';
  let { offers }: { offers: Offer[] } = $props();
</script>

<ul class="divide-y divide-zinc-800 text-sm">
  {#each offers as o}
    <li class="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
      <span>{o.name}</span>
      <span class="text-zinc-400">{o.price}{#if o.limit} · <i>{o.limit}</i>{/if}</span>
    </li>
  {/each}
</ul>
