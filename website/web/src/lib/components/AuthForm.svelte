<script lang="ts">
  import { goto } from '$app/navigation';
  import { login, register } from '$lib/auth';

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
    {isRegister ? 'Create account' : 'Sign in'}
  </h1>

  <form class="space-y-3" onsubmit={submit}>
    {#if isRegister}
      <input
        class="surface w-full px-3 py-2"
        style="background: var(--bg-elevated); color: var(--text);"
        placeholder="Name (optional)"
        bind:value={name}
        autocomplete="name"
      />
    {/if}
    <input
      class="surface w-full px-3 py-2"
      style="background: var(--bg-elevated); color: var(--text);"
      type="email"
      placeholder="Email"
      bind:value={email}
      autocomplete="email"
      required
    />
    <input
      class="surface w-full px-3 py-2"
      style="background: var(--bg-elevated); color: var(--text);"
      type="password"
      placeholder={isRegister ? 'Password (min 8 chars)' : 'Password'}
      bind:value={password}
      autocomplete={isRegister ? 'new-password' : 'current-password'}
      required
    />

    {#if error}
      <p class="text-sm" style="color: #ef4444;">{error}</p>
    {/if}

    <button class="btn-accent w-full px-3 py-2 font-medium disabled:opacity-60" disabled={busy}>
      {busy ? '…' : isRegister ? 'Create account' : 'Sign in'}
    </button>
  </form>

  <p class="mt-4 text-sm text-muted">
    {#if isRegister}
      Already have an account? <a class="link-accent" href="/login">Sign in</a>
    {:else}
      No account yet? <a class="link-accent" href="/register">Register</a>
    {/if}
  </p>
</div>
