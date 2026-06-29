<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { user, fetchMe, logout } from '$lib/auth';
  import { locale, t } from '$lib/i18n';
  import { LOCALES, LOCALE_LABELS } from '$lib/messages';

  let { children } = $props();

  onMount(fetchMe);

  $effect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = $locale;
  });

  async function handleLogout() {
    await logout();
  }

  function active(path: string) {
    return page.url.pathname === path;
  }
</script>

<div class="flex min-h-screen flex-col">
  <a class="skip-link" href="#content">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="brand" aria-label="KoalaNews home">
        <span aria-hidden="true">🐨</span>
        <span>KoalaNews</span>
      </a>

      <nav class="top-nav" aria-label="Primary navigation">
        <a href="/statistics" class="surface nav-action" class:nav-active={active('/statistics')} aria-label={$t('nav.statistics')}>
          <span aria-hidden="true">📊</span>
          <span class="nav-label">{$t('nav.statistics')}</span>
        </a>
        <a href="/appearance" class="surface nav-action" class:nav-active={active('/appearance')} aria-label={$t('nav.appearance')}>
          <span aria-hidden="true">🎨</span>
          <span class="nav-label">{$t('nav.appearance')}</span>
        </a>
        {#if $user}
          <a href="/dashboard" class="surface nav-action" class:nav-active={active('/dashboard')} aria-label={$t('nav.dashboard')}>
            <span aria-hidden="true">🗂</span>
            <span class="nav-label">{$t('nav.dashboard')}</span>
          </a>
          <a href="/settings" class="surface nav-action" class:nav-active={active('/settings')} aria-label={$t('nav.settings')}>
            <span aria-hidden="true">⚙</span>
            <span class="nav-label">{$t('nav.settings')}</span>
          </a>
          {#if $user.role === 'ADMIN'}
            <a href="/admin" class="surface nav-action" class:nav-active={active('/admin')} aria-label={$t('nav.admin')}>
              <span aria-hidden="true">★</span>
              <span class="nav-label">{$t('nav.admin')}</span>
            </a>
          {/if}
          <button class="surface nav-action" onclick={handleLogout} aria-label={$t('nav.logout')}>
            <span aria-hidden="true">↩</span>
            <span class="nav-label">{$t('nav.logout')}</span>
          </button>
        {:else}
          <a href="/login" class="surface nav-action" class:nav-active={active('/login')} aria-label={$t('nav.signIn')}>
            <span aria-hidden="true">🔐</span>
            <span class="nav-label">{$t('nav.signIn')}</span>
          </a>
        {/if}
        <select
          class="surface nav-language"
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

  <main id="content" class="mx-auto w-full flex-1 px-4 py-6" style="max-width: var(--maxw);">
    {@render children()}
  </main>

  <footer class="site-footer">
    <div class="mx-auto flex flex-col gap-2 px-4 py-5 text-sm md:flex-row md:items-center md:justify-between" style="max-width: var(--maxw);">
      <p class="text-muted">KoalaNews - {$t('footer.openSource')}</p>
      <nav class="flex flex-wrap items-center gap-3" aria-label={$t('footer.legalNav')}>
        <a class="link-accent" href="/imprint">{$t('footer.imprint')}</a>
        <a class="link-accent" href="/privacy">{$t('footer.privacy')}</a>
        <a class="link-accent" href="https://github.com/Shik3i/KoalaNews" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </div>
  </footer>
</div>
