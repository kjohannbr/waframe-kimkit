<script lang="ts">
  import { CHECKED_ON } from './weekly';
  let { href, text = 'wiki' }: { href: string; text?: string } = $props();
</script>

<a {href} target="_blank" rel="noopener noreferrer" class="text-xs text-zinc-500 underline hover:text-amber-300">{text} · conferido em {CHECKED_ON.split('-').reverse().join('/')}</a>
