<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getAccount, updateAccount, updatePassword, type Account } from '$lib/api';
  import { authReady, user } from '$lib/auth';
  import { t } from '$lib/i18n';

  let account = $state<Account | null>(null);
  let name = $state('');
  let email = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let profileBusy = $state(false);
  let passwordBusy = $state(false);
  let message = $state<string | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    const unsub = authReady.subscribe((ready) => {
      if (ready && !$user) goto('/login');
    });
    void load();
    return unsub;
  });

  async function load() {
    try {
      account = await getAccount();
      name = account.name ?? '';
      email = account.email;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load account';
    }
  }

  async function saveProfile(e: SubmitEvent) {
    e.preventDefault();
    profileBusy = true;
    message = null;
    error = null;
    try {
      account = await updateAccount({ name, email });
      user.set({
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
      });
      message = $t('settings.saved');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save profile';
    } finally {
      profileBusy = false;
    }
  }

  async function savePassword(e: SubmitEvent) {
    e.preventDefault();
    passwordBusy = true;
    message = null;
    error = null;
    try {
      await updatePassword({ currentPassword, newPassword });
      currentPassword = '';
      newPassword = '';
      message = $t('settings.passwordSaved');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update password';
    } finally {
      passwordBusy = false;
    }
  }
</script>

<svelte:head>
  <title>Settings | KoalaNews</title>
  <meta name="description" content="Manage your KoalaNews account settings." />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="mb-6">
  <h1 class="text-2xl font-semibold">{$t('settings.title')}</h1>
  <p class="mt-1 max-w-2xl text-sm text-muted">{$t('settings.subtitle')}</p>
</div>

{#if error}
  <p class="mb-4 text-sm" style="color: #ef4444;">{error}</p>
{/if}
{#if message}
  <p class="mb-4 text-sm link-accent">{message}</p>
{/if}

<div class="grid gap-6 lg:grid-cols-2">
  <form class="surface space-y-3 px-4 py-4" onsubmit={saveProfile}>
    <h2 class="text-sm font-medium text-muted">{$t('settings.profile')}</h2>
    <label class="block text-sm">
      <span class="text-muted">{$t('auth.name')}</span>
      <input
        class="surface mt-1 w-full px-3 py-2"
        style="background: var(--bg); color: var(--text);"
        bind:value={name}
      />
    </label>
    <label class="block text-sm">
      <span class="text-muted">{$t('auth.email')}</span>
      <input
        class="surface mt-1 w-full px-3 py-2"
        style="background: var(--bg); color: var(--text);"
        type="email"
        required
        bind:value={email}
      />
    </label>
    <button class="btn-accent px-4 py-2 text-sm font-medium disabled:opacity-60" disabled={profileBusy}>
      {profileBusy ? '…' : $t('settings.saveProfile')}
    </button>
  </form>

  <form class="surface space-y-3 px-4 py-4" onsubmit={savePassword}>
    <h2 class="text-sm font-medium text-muted">{$t('settings.password')}</h2>
    {#if account?.hasPassword}
      <label class="block text-sm">
        <span class="text-muted">{$t('settings.currentPassword')}</span>
        <input
          class="surface mt-1 w-full px-3 py-2"
          style="background: var(--bg); color: var(--text);"
          type="password"
          bind:value={currentPassword}
        />
      </label>
    {/if}
    <label class="block text-sm">
      <span class="text-muted">{$t('settings.newPassword')}</span>
      <input
        class="surface mt-1 w-full px-3 py-2"
        style="background: var(--bg); color: var(--text);"
        type="password"
        minlength="8"
        required
        bind:value={newPassword}
      />
    </label>
    <button class="btn-accent px-4 py-2 text-sm font-medium disabled:opacity-60" disabled={passwordBusy}>
      {passwordBusy ? '…' : $t('settings.savePassword')}
    </button>
  </form>
</div>
