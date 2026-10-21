<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { Swords, LayoutDashboard } from '@lucide/svelte';

  let { children } = $props();

  const links = [
    { href: `${base}/dashboard`, label: 'Resets', icon: LayoutDashboard },
    { href: `${base}/builder`, label: 'Builder', icon: Swords }
  ];
</script>

<header class="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
  <nav class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
    <a href="{base}/" class="font-semibold tracking-wide text-amber-400">Warframe Toolkit</a>
    {#each links as l}
      <a
        href={l.href}
        class="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white"
        class:text-white={page.url.pathname.startsWith(l.href)}
      >
        <l.icon size={16} /> {l.label}
      </a>
    {/each}
  </nav>
</header>

<main class="mx-auto max-w-6xl px-4 py-8">
  {@render children()}
</main>
