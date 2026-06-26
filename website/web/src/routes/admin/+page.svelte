<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, authReady } from '$lib/auth';
  import {
    adminStats,
    adminListUsers,
    adminUpdateUser,
    type AdminUser,
    type AdminStats,
  } from '$lib/api';

  let stats = $state<AdminStats | null>(null);
  let users = $state<AdminUser[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  async function refresh() {
    loading = true;
    try {
      [stats, users] = await Promise.all([adminStats(), adminListUsers()]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function update(u: AdminUser, patch: { role?: string; banned?: boolean }) {
    try {
      await adminUpdateUser(u.id, patch);
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Update failed';
    }
  }

  onMount(() => {
    const unsub = authReady.subscribe((ready) => {
      if (ready && (!$user || $user.role !== 'ADMIN')) goto('/');
    });
    refresh();
    return unsub;
  });

  const statCards = $derived(
    stats
      ? [
          ['Users', stats.users],
          ['Subscriptions', stats.feeds],
          ['Source feeds', stats.sourceFeeds],
          ['Articles', stats.articles],
          ['Database', fmtBytes(stats.dbBytes)],
        ]
      : [],
  );
</script>

<h1 class="mb-5 text-2xl font-semibold">Admin</h1>

{#if error}
  <p class="mb-4 text-sm" style="color: #ef4444;">{error}</p>
{/if}

{#if loading}
  <div class="surface animate-pulse" style="height: 8rem;"></div>
{:else}
  <section class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
    {#each statCards as [label, value]}
      <div class="surface px-4 py-3">
        <p class="text-xs text-muted">{label}</p>
        <p class="mt-1 text-xl font-semibold">{value}</p>
      </div>
    {/each}
  </section>

  <h2 class="mb-3 text-lg font-semibold">Users</h2>
  <div class="surface overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-left text-muted" style="border-color: var(--border);">
          <th class="px-4 py-2 font-medium">Email</th>
          <th class="px-4 py-2 font-medium">Role</th>
          <th class="px-4 py-2 font-medium">Status</th>
          <th class="px-4 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each users as u (u.id)}
          <tr class="border-b last:border-0" style="border-color: var(--border);">
            <td class="px-4 py-2">
              {u.email}
              {#if u.id === $user?.id}<span class="text-muted">(you)</span>{/if}
            </td>
            <td class="px-4 py-2">{u.role}</td>
            <td class="px-4 py-2">
              {#if u.banned}
                <span style="color: #ef4444;">banned</span>
              {:else}
                active
              {/if}
            </td>
            <td class="px-4 py-2">
              {#if u.id !== $user?.id}
                <div class="flex gap-2">
                  {#if u.role === 'ADMIN'}
                    <button class="surface px-2 py-1 text-xs" onclick={() => update(u, { role: 'USER' })}
                      >Demote</button
                    >
                  {:else}
                    <button class="surface px-2 py-1 text-xs" onclick={() => update(u, { role: 'ADMIN' })}
                      >Promote</button
                    >
                  {/if}
                  {#if u.banned}
                    <button class="surface px-2 py-1 text-xs" onclick={() => update(u, { banned: false })}
                      >Unban</button
                    >
                  {:else}
                    <button
                      class="surface px-2 py-1 text-xs"
                      style="color: #ef4444;"
                      onclick={() => update(u, { banned: true })}>Ban</button
                    >
                  {/if}
                </div>
              {:else}
                <span class="text-xs text-muted">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
