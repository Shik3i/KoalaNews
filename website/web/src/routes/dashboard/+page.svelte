<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, authReady } from '$lib/auth';
  import {
    listFeeds,
    addFeed,
    deleteFeed,
    importOPML,
    listCategories,
    createCategory,
    deleteCategory,
    setFeedCategory,
    listSmartFeeds,
    createSmartFeed,
    deleteSmartFeed,
    type Feed,
    type Category,
    type SmartFeed,
  } from '$lib/api';

  let feeds = $state<Feed[]>([]);
  let categories = $state<Category[]>([]);
  let smartFeeds = $state<SmartFeed[]>([]);
  let loading = $state(true);
  let url = $state('');
  let language = $state('en');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let importing = $state(false);
  let importMsg = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let newCategoryName = $state('');
  let newSmartFeedName = $state('');
  let newSmartFeedQuery = $state('');
  let newSmartFeedFeedId = $state('');

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
      [feeds, categories, smartFeeds] = await Promise.all([
        listFeeds(),
        listCategories(),
        listSmartFeeds(),
      ]);
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

  async function addCategory(e: SubmitEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const cat = await createCategory(name);
      categories = [...categories, cat].sort((a, b) => a.name.localeCompare(b.name));
      newCategoryName = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not create category';
    }
  }

  async function removeCategory(id: string) {
    const prevCats = categories;
    const prevFeeds = feeds;
    categories = categories.filter((c) => c.id !== id);
    feeds = feeds.map((f) => (f.category_id === id ? { ...f, category_id: null } : f));
    try {
      await deleteCategory(id);
    } catch {
      categories = prevCats;
      feeds = prevFeeds;
    }
  }

  async function assignCategory(feed: Feed, categoryId: string) {
    const prev = feeds;
    const nextId = categoryId || null;
    feeds = feeds.map((f) => (f.id === feed.id ? { ...f, category_id: nextId } : f));
    try {
      await setFeedCategory(feed.id, nextId);
    } catch {
      feeds = prev;
    }
  }

  async function addSmartFeed(e: SubmitEvent) {
    e.preventDefault();
    const name = newSmartFeedName.trim();
    const query = newSmartFeedQuery.trim();
    if (!name || !query) return;
    try {
      const sf = await createSmartFeed(name, query, newSmartFeedFeedId || null);
      smartFeeds = [...smartFeeds, sf].sort((a, b) => a.name.localeCompare(b.name));
      newSmartFeedName = '';
      newSmartFeedQuery = '';
      newSmartFeedFeedId = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not create smart feed';
    }
  }

  async function removeSmartFeed(id: string) {
    const prev = smartFeeds;
    smartFeeds = smartFeeds.filter((s) => s.id !== id);
    try {
      await deleteSmartFeed(id);
    } catch {
      smartFeeds = prev;
    }
  }

  function feedTitle(feedId: string | null): string {
    if (!feedId) return '';
    return feeds.find((f) => f.id === feedId)?.title ?? '';
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

<section class="mb-6">
  <h2 class="mb-2 text-sm font-medium text-muted">Categories</h2>
  <div class="flex flex-wrap items-center gap-2">
    {#each categories as cat (cat.id)}
      <span class="surface flex items-center gap-2 px-3 py-1.5 text-sm">
        {cat.name}
        <button class="text-muted hover:text-current" onclick={() => removeCategory(cat.id)} title="Delete category"
          >✕</button
        >
      </span>
    {/each}
    <form class="flex gap-2" onsubmit={addCategory}>
      <input
        class="surface px-2 py-1.5 text-sm"
        style="background: var(--bg-elevated); color: var(--text); width: 10rem;"
        placeholder="New category"
        bind:value={newCategoryName}
      />
      <button class="surface px-3 py-1.5 text-sm">Add</button>
    </form>
  </div>
</section>

<section class="mb-6">
  <h2 class="mb-2 text-sm font-medium text-muted">Smart feeds</h2>
  <p class="mb-2 text-xs text-muted">
    Saved searches: matches articles whose title or description contains the query, optionally
    limited to one feed.
  </p>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    {#each smartFeeds as sf (sf.id)}
      <span class="surface flex items-center gap-2 px-3 py-1.5 text-sm">
        {sf.name}
        <span class="text-muted">"{sf.query}"{feedTitle(sf.feed_id) ? ` in ${feedTitle(sf.feed_id)}` : ''}</span>
        <button class="text-muted hover:text-current" onclick={() => removeSmartFeed(sf.id)} title="Delete smart feed"
          >✕</button
        >
      </span>
    {/each}
  </div>
  <form class="flex flex-wrap gap-2" onsubmit={addSmartFeed}>
    <input
      class="surface px-2 py-1.5 text-sm"
      style="background: var(--bg-elevated); color: var(--text); width: 9rem;"
      placeholder="Name"
      bind:value={newSmartFeedName}
    />
    <input
      class="surface px-2 py-1.5 text-sm"
      style="background: var(--bg-elevated); color: var(--text); width: 12rem;"
      placeholder="Search text"
      bind:value={newSmartFeedQuery}
    />
    <select
      class="surface px-2 py-1.5 text-sm"
      style="background: var(--bg-elevated); color: var(--text);"
      bind:value={newSmartFeedFeedId}
    >
      <option value="">Any feed</option>
      {#each feeds as feed (feed.id)}
        <option value={feed.id}>{feed.title ?? feed.url}</option>
      {/each}
    </select>
    <button class="surface px-3 py-1.5 text-sm">Add</button>
  </form>
</section>

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
        <div class="flex shrink-0 items-center gap-2">
          <select
            class="surface px-2 py-1.5 text-sm"
            style="background: var(--bg-elevated); color: var(--text);"
            value={feed.category_id ?? ''}
            onchange={(e) => assignCategory(feed, (e.target as HTMLSelectElement).value)}
          >
            <option value="">No category</option>
            {#each categories as cat (cat.id)}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
          <button class="surface px-3 py-1.5 text-sm" style="color: #ef4444;" onclick={() => remove(feed.id)}
            >Remove</button
          >
        </div>
      </li>
    {/each}
  </ul>
{/if}
