<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import AppearancePanel from '$lib/components/AppearancePanel.svelte';
  import { user, fetchMe, logout } from '$lib/auth';
  import { locale, t } from '$lib/i18n';
  import { LOCALES, LOCALE_LABELS } from '$lib/messages';

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
        <a href="/statistics" class="surface px-3 py-1.5">{$t('nav.statistics')}</a>
        {#if $user}
          <a href="/dashboard" class="surface px-3 py-1.5">{$t('nav.dashboard')}</a>
          {#if $user.role === 'ADMIN'}
            <a href="/admin" class="surface px-3 py-1.5">{$t('nav.admin')}</a>
          {/if}
          <button class="surface px-3 py-1.5" onclick={handleLogout}>{$t('nav.logout')}</button>
        {:else}
          <a href="/login" class="surface px-3 py-1.5">{$t('nav.signIn')}</a>
        {/if}
        <button class="surface px-3 py-1.5" onclick={() => (panelOpen = !panelOpen)}>
          {$t('nav.appearance')}
        </button>
        <select
          class="surface px-2 py-1.5"
          style="background: var(--bg-elevated); color: var(--text);"
          bind:value={$locale}
          aria-label={$t('nav.language')}
        >
          {#each LOCALES as code}
            <option value={code}>{LOCALE_LABELS[code]}</option>
          {/each}
        </select>
      </nav>
    </div>
  </header>

  <main class="mx-auto px-4 py-6" style="max-width: var(--maxw);">
    {@render children()}
  </main>

  <AppearancePanel open={panelOpen} onclose={() => (panelOpen = false)} />
</div>
