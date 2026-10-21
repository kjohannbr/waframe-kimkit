import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BASE_PATH é definido no CI: "/nome-do-repositorio" (GitHub Pages de projeto). Local: vazio.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // fallback 404.html: o GitHub Pages serve esse arquivo em rotas desconhecidas → links diretos funcionam (SPA)
    adapter: adapter({ fallback: '404.html' }),
    paths: { base, relative: false }
  }
};
