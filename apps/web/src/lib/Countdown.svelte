<script lang="ts">
  import { onMount } from 'svelte';
  import { countdown } from './weekly';
  let { to, label = 'Reseta em' }: { to: Date | string | null; label?: string } = $props();
  let now = $state(Date.now());
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });
  const ms = $derived(to ? new Date(to).getTime() - now : NaN);
</script>

{#if to}<span class="text-xs text-zinc-400">{label} <b class="text-amber-300">{countdown(ms)}</b></span>{/if}
