<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api, errorMessage, getToken, setToken } from '$lib/api';
  import { refreshSession } from '$lib/session.svelte';

  let mode = $state<'login' | 'register'>('login');
  let email = $state('');
  let password = $state('');
  let name = $state('');
  let busy = $state(false);
  let error = $state('');

  onMount(() => {
    if (getToken()) goto(`${base}/dashboard`, { replaceState: true });
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      const body = mode === 'login' ? { email, password } : { email, password, display_name: name };
      const r = await api<{ token: string }>(`/api/auth/${mode}`, { method: 'POST', json: body });
      await setToken(r.token);
      await refreshSession();
      await goto(`${base}/dashboard`);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<section class="mx-auto max-w-md space-y-6 py-12">
  <div class="grid grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-900 p-1 text-sm">
    <button type="button" onclick={() => { mode = 'login'; error = ''; }} class="rounded-lg py-2 {mode === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}">Entrar</button>
    <button type="button" onclick={() => { mode = 'register'; error = ''; }} class="rounded-lg py-2 {mode === 'register' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}">Criar conta</button>
  </div>

  <div>
    <h1 class="text-3xl font-bold">{mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}</h1>
    <p class="mt-1 text-zinc-400">{mode === 'login' ? 'Entre com seu e-mail e senha.' : 'Salve builds e acompanhe seus resets semanais.'}</p>
  </div>

  <form onsubmit={submit} class="space-y-3">
    {#if mode === 'register'}
      <input bind:value={name} maxlength="60" autocomplete="nickname" placeholder="Nome de exibição (opcional)" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
    {/if}
    <input type="email" required bind:value={email} autocomplete="email" placeholder="voce@exemplo.com" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
    <input type="password" required minlength="8" maxlength="128" bind:value={password} autocomplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'Senha (mínimo 8 caracteres)' : 'Senha'} class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400" />
    <button disabled={busy} class="w-full rounded-lg bg-amber-500 px-3 py-2 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">
      {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
    </button>
    {#if error}<p role="alert" class="text-sm text-red-400">{error}</p>{/if}
  </form>
</section>
