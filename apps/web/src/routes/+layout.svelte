<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { logout, refreshSession, session } from '$lib/session.svelte';
  import { LayoutDashboard, LogOut, Shield, Swords } from '@lucide/svelte';

  let { children } = $props();

  onMount(refreshSession);

  const links = $derived([
    { href: `${base}/dashboard`, label: 'Resets', icon: LayoutDashboard },
    { href: `${base}/builder`, label: 'Builder', icon: Swords },
    ...(session.user?.role === 'admin' ? [{ href: `${base}/admin`, label: 'Admin', icon: Shield }] : [])
  ]);

  async function out() {
    await logout();
    await goto(`${base}/`);
  }
</script>

<header class="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
  <nav class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
    <a href="{base}/" class="font-semibold tracking-wide text-amber-400">Warframe Toolkit</a>
    {#each links as l}
      <a href={l.href} class="flex items-center gap-1.5 text-sm {page.url.pathname.startsWith(l.href) ? 'text-white' : 'text-zinc-400 hover:text-white'}">
        <l.icon size={16} /> {l.label}
      </a>
    {/each}
    <div class="ml-auto flex items-center gap-3 text-sm">
      {#if session.user}
        <span class="hidden text-zinc-400 sm:inline">{session.user.display_name || session.user.email}</span>
        <button type="button" onclick={out} class="flex items-center gap-1.5 text-zinc-400 hover:text-white"><LogOut size={16} /> Sair</button>
      {:else if session.ready}
        <a href="{base}/" class="text-zinc-400 hover:text-white">Entrar</a>
      {/if}
    </div>
  </nav>
</header>

<main class="mx-auto max-w-6xl px-4 py-8">
  {@render children()}
</main>
