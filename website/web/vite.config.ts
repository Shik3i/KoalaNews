import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    proxy: {
      // During `vite dev`, forward API calls to the running Go backend.
      '/api': 'http://localhost:3000',
    },
  },
});
