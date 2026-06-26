<script lang="ts">
  import { goto } from '$app/navigation';
  import { login, register } from '$lib/auth';
  import { t } from '$lib/i18n';

  let { mode }: { mode: 'login' | 'register' } = $props();

  let email = $state('');
  let password = $state('');
  let name = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  const isRegister = $derived(mode === 'register');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    busy = true;
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      await goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong';
    } finally {
      busy = false;
    }
  }
</script>

<div class="mx-auto max-w-sm">
  <h1 class="mb-5 text-2xl font-semibold">
    {isRegister ? $t('auth.registerTitle') : $t('auth.loginTitle')}
  </h1>

  <form class="space-y-3" onsubmit={submit}>
    {#if isRegister}
      <input
        class="surface w-full px-3 py-2"
        style="background: var(--bg-elevated); color: var(--text);"
        placeholder={$t('auth.namePlaceholder')}
        bind:value={name}
        autocomplete="name"
      />
    {/if}
    <input
      class="surface w-full px-3 py-2"
      style="background: var(--bg-elevated); color: var(--text);"
      type="email"
      placeholder={$t('auth.email')}
      bind:value={email}
      autocomplete="email"
      required
    />
    <input
      class="surface w-full px-3 py-2"
      style="background: var(--bg-elevated); color: var(--text);"
      type="password"
      placeholder={isRegister ? $t('auth.passwordMin') : $t('auth.password')}
      bind:value={password}
      autocomplete={isRegister ? 'new-password' : 'current-password'}
      required
    />

    {#if error}
      <p class="text-sm" style="color: #ef4444;">{error}</p>
    {/if}

    <button class="btn-accent w-full px-3 py-2 font-medium disabled:opacity-60" disabled={busy}>
      {busy ? '…' : isRegister ? $t('auth.submitRegister') : $t('auth.submitLogin')}
    </button>
  </form>

  <p class="mt-4 text-sm text-muted">
    {#if isRegister}
      {$t('auth.haveAccount')} <a class="link-accent" href="/login">{$t('auth.login')}</a>
    {:else}
      {$t('auth.noAccount')} <a class="link-accent" href="/register">{$t('auth.register')}</a>
    {/if}
  </p>
</div>
