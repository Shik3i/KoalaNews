import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // SPA mode: prerender the shell, serve everything else client-side.
    // The Go server embeds `build/` and falls back to index.html for unknown routes.
    adapter: adapter({
      fallback: 'index.html',
      precompress: false,
      strict: false,
    }),
  },
};

export default config;
