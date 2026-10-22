<script lang="ts">
  import { imageUrl } from './catalog';

  let { file, alt, class: cls = '' }: { file: string; alt: string; class?: string } = $props();
  let failed = $state(false);

  $effect(() => {
    file; // nova imagem → tenta de novo
    failed = false;
  });
</script>

{#if failed}
  <div class="grid place-items-center bg-zinc-800 text-xs font-semibold text-zinc-500 {cls}" role="img" aria-label={alt}>
    {alt.slice(0, 2).toUpperCase()}
  </div>
{:else}
  <img src={imageUrl(file)} {alt} loading="lazy" decoding="async" class={cls} onerror={() => (failed = true)} />
{/if}
