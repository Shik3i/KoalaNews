<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import AppearancePanel from '$lib/components/AppearancePanel.svelte';
  import { user, fetchMe, logout } from '$lib/auth';

  let { children } = $props();
  let panelOpen = $state(false);

  onMount(fetchMe);

  async function handleLogout() {
    await logout();
  }
</script>

<div class="min-h-screen">
  <header
    class="sticky top-0 z-10 border-b backdrop-blur"
    style="border-color: var(--border); background: color-mix(in srgb, var(--bg) 85%, transparent);"
  >
    <div class="mx-auto flex items-center justify-between px-4 py-3" style="max-width: var(--maxw);">
      <a href="/" class="text-lg font-semibold tracking-tight"> 🐨 <span>KoalaNews</span> </a>

      <nav class="flex items-center gap-2 text-sm">
        {#if $user}
          <a href="/dashboard" class="surface px-3 py-1.5">Dashboard</a>
          {#if $user.role === 'ADMIN'}
            <a href="/admin" class="surface px-3 py-1.5">Admin</a>
          {/if}
          <button class="surface px-3 py-1.5" onclick={handleLogout}>Logout</button>
        {:else}
          <a href="/login" class="surface px-3 py-1.5">Sign in</a>
        {/if}
        <button class="surface px-3 py-1.5" onclick={() => (panelOpen = !panelOpen)}>
          Appearance
        </button>
      </nav>
    </div>
  </header>

  <main class="mx-auto px-4 py-6" style="max-width: var(--maxw);">
    {@render children()}
  </main>

  <AppearancePanel open={panelOpen} onclose={() => (panelOpen = false)} />
</div>
