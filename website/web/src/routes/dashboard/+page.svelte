<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, authReady } from '$lib/auth';
  import { listFeeds, addFeed, deleteFeed, importOPML, type Feed } from '$lib/api';

  let feeds = $state<Feed[]>([]);
  let loading = $state(true);
  let url = $state('');
  let language = $state('en');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let importing = $state(false);
  let importMsg = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  async function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importing = true;
    importMsg = null;
    error = null;
    try {
      const text = await file.text();
      const r = await importOPML(text);
      importMsg = `Imported ${r.added} feed(s), ${r.skipped} already present, ${r.failed} failed.`;
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Import failed';
    } finally {
      importing = false;
      if (fileInput) fileInput.value = '';
    }
  }

  async function refresh() {
    loading = true;
    try {
      feeds = await listFeeds();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load feeds';
    } finally {
      loading = false;
    }
  }

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    busy = true;
    error = null;
    try {
      const feed = await addFeed(url.trim(), language);
      feeds = [feed, ...feeds];
      url = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not add feed';
    } finally {
      busy = false;
    }
  }

  async function remove(id: string) {
    const prev = feeds;
    feeds = feeds.filter((f) => f.id !== id);
    try {
      await deleteFeed(id);
    } catch {
      feeds = prev; // rollback on failure
    }
  }

  onMount(() => {
    // Redirect guests once auth state is known.
    const unsub = authReady.subscribe((ready) => {
      if (ready && !$user) goto('/login');
    });
    refresh();
    return unsub;
  });
</script>

<h1 class="mb-1 text-2xl font-semibold">Your feeds</h1>
<p class="mb-5 text-sm text-muted">Add RSS or Atom feeds. Articles from all your feeds appear on the home page.</p>

<form class="mb-6 flex flex-wrap gap-2" onsubmit={add}>
  <input
    class="surface min-w-0 flex-1 px-3 py-2"
    style="background: var(--bg-elevated); color: var(--text);"
    type="url"
    placeholder="https://example.com/rss.xml"
    bind:value={url}
    required
  />
  <select
    class="surface px-3 py-2"
    style="background: var(--bg-elevated); color: var(--text);"
    bind:value={language}
  >
    <option value="en">EN</option>
    <option value="de">DE</option>
    <option value="fr">FR</option>
  </select>
  <button class="btn-accent px-4 py-2 font-medium disabled:opacity-60" disabled={busy}>
    {busy ? 'Adding…' : 'Add feed'}
  </button>
</form>

<div class="mb-6 flex flex-wrap items-center gap-3 text-sm">
  <a class="surface px-3 py-1.5" href="/api/feeds/opml" download>Export OPML</a>
  <button class="surface px-3 py-1.5 disabled:opacity-60" disabled={importing} onclick={() => fileInput?.click()}>
    {importing ? 'Importing…' : 'Import OPML'}
  </button>
  <input
    bind:this={fileInput}
    type="file"
    accept=".opml,.xml,text/xml,application/xml"
    class="hidden"
    onchange={onImportFile}
  />
  {#if importMsg}<span class="text-muted">{importMsg}</span>{/if}
</div>

{#if error}
  <p class="mb-4 text-sm" style="color: #ef4444;">{error}</p>
{/if}

{#if loading}
  <div class="space-y-2">
    {#each Array(3) as _}
      <div class="surface animate-pulse" style="height: 3.5rem;"></div>
    {/each}
  </div>
{:else if feeds.length === 0}
  <p class="text-muted">No feeds yet. Add your first one above.</p>
{:else}
  <ul class="space-y-2">
    {#each feeds as feed (feed.id)}
      <li class="surface flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate font-medium">{feed.title ?? feed.url}</p>
          <p class="truncate text-xs text-muted">{feed.url}</p>
        </div>
        <button
          class="surface shrink-0 px-3 py-1.5 text-sm"
          style="color: #ef4444;"
          onclick={() => remove(feed.id)}>Remove</button
        >
      </li>
    {/each}
  </ul>
{/if}
