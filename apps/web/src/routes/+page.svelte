<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api, getToken, setToken } from '$lib/api';

  let email = $state('');
  let status = $state<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  let message = $state('');

  onMount(async () => {
    // O link mágico leva a "/?token=..." — troca o token de uso único por uma sessão
    const url = new URL(location.href);
    const magic = url.searchParams.get('token');
    if (magic) {
      status = 'verifying';
      try {
        const r = await api<{ token: string }>('/api/auth/verify', { method: 'POST', json: { token: magic } });
        await setToken(r.token);
        history.replaceState(null, '', `${base}/`); // tira o token da URL
        await goto(`${base}/dashboard`);
      } catch {
        status = 'error';
        message = 'Link inválido ou expirado. Peça um novo.';
      }
    } else if (getToken()) {
      await goto(`${base}/dashboard`);
    }
  });

  async function requestLink(e: SubmitEvent) {
    e.preventDefault();
    status = 'sending';
    try {
      await api('/api/auth/request', { method: 'POST', json: { email } });
      status = 'sent';
    } catch {
      status = 'error';
      message = 'Não foi possível enviar o link agora.';
    }
  }
</script>

<section class="mx-auto max-w-md space-y-6 py-16">
  <h1 class="text-3xl font-bold">Entrar</h1>
  <p class="text-zinc-400">Sem senha: enviamos um link de acesso para o seu e-mail.</p>

  {#if status === 'verifying'}
    <p class="text-zinc-300">Validando link…</p>
  {:else if status === 'sent'}
    <p class="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-emerald-300">
      Link enviado para <strong>{email}</strong>. Vale por 15 minutos.
    </p>
  {:else}
    <form onsubmit={requestLink} class="space-y-3">
      <input
        type="email"
        required
        bind:value={email}
        placeholder="voce@exemplo.com"
        class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
      />
      <button
        disabled={status === 'sending'}
        class="w-full rounded-lg bg-amber-500 px-3 py-2 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {status === 'sending' ? 'Enviando…' : 'Enviar link mágico'}
      </button>
      {#if status === 'error'}<p class="text-sm text-red-400">{message}</p>{/if}
    </form>
  {/if}
</section>
