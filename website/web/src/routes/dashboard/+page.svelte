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
    renameFeed,
    discoverFeeds,
    refreshFeed,
    listSmartFeeds,
    createSmartFeed,
    deleteSmartFeed,
    type Feed,
    type Category,
    type SmartFeed,
    type FeedCandidate,
  } from '$lib/api';
  import FeedPicker from '$lib/components/FeedPicker.svelte';
  import { feedLabel } from '$lib/feeds';
  import { FEED_LANGUAGES, feedLanguageFlag, feedLanguageLabel } from '$lib/languages';
  import { locale, t } from '$lib/i18n';

  let feeds = $state<Feed[]>([]);
  let categories = $state<Category[]>([]);
  let smartFeeds = $state<SmartFeed[]>([]);
  let loading = $state(true);
  let url = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let discovering = $state(false);
  let candidates = $state<FeedCandidate[]>([]);
  let importing = $state(false);
  let importMsg = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let newCategoryName = $state('');
  let newSmartFeedName = $state('');
  let newSmartFeedQuery = $state('');
  let newSmartFeedFeedIds = $state<string[]>([]);
  let renameTitles = $state<Record<string, string>>({});
  let renamingFeed = $state('');
  let refreshingFeed = $state('');
  let feedLanguage = $state('en');

  async function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importing = true;
    importMsg = null;
    error = null;
    try {
      const text = await file.text();
      const r = await importOPML(text, feedLanguage);
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
      syncRenameDrafts();
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
      const feed = await addFeed(url.trim(), feedLanguage);
      feeds = [feed, ...feeds];
      renameTitles = { ...renameTitles, [feed.id]: feed.custom_title ?? '' };
      url = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not add feed';
    } finally {
      busy = false;
    }
  }

  async function discover() {
    if (!url.trim()) return;
    discovering = true;
    error = null;
    candidates = [];
    try {
      candidates = await discoverFeeds(url.trim());
      if (candidates.length === 1) {
        url = candidates[0].url;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not discover feed';
    } finally {
      discovering = false;
    }
  }

  async function addCandidate(candidate: FeedCandidate) {
    busy = true;
    error = null;
    try {
      const feed = await addFeed(candidate.url, feedLanguage);
      feeds = [feed, ...feeds];
      renameTitles = { ...renameTitles, [feed.id]: feed.custom_title ?? '' };
      url = '';
      candidates = [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not add feed';
    } finally {
      busy = false;
    }
  }

  async function refreshOne(feed: Feed) {
    refreshingFeed = feed.id;
    error = null;
    try {
      const result = await refreshFeed(feed.id);
      feeds = feeds.map((f) => (f.id === feed.id ? result.feed : f));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not refresh feed';
      await refresh();
    } finally {
      refreshingFeed = '';
    }
  }

  async function remove(id: string) {
    const prev = feeds;
    const prevRenameTitles = renameTitles;
    feeds = feeds.filter((f) => f.id !== id);
    const { [id]: _removed, ...rest } = renameTitles;
    renameTitles = rest;
    try {
      await deleteFeed(id);
    } catch {
      feeds = prev; // rollback on failure
      renameTitles = prevRenameTitles;
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

  function syncRenameDrafts() {
    const next: Record<string, string> = {};
    for (const feed of feeds) {
      next[feed.id] = renameTitles[feed.id] ?? feed.custom_title ?? '';
    }
    renameTitles = next;
  }

  async function saveFeedTitle(feed: Feed) {
    const title = (renameTitles[feed.id] ?? '').trim();
    const prev = feeds;
    renamingFeed = feed.id;
    error = null;
    feeds = feeds.map((f) => (f.id === feed.id ? { ...f, custom_title: title || null } : f));
    try {
      await renameFeed(feed.id, title);
    } catch (err) {
      feeds = prev;
      error = err instanceof Error ? err.message : 'Could not rename feed';
    } finally {
      renamingFeed = '';
    }
  }

  async function addSmartFeed(e: SubmitEvent) {
    e.preventDefault();
    const name = newSmartFeedName.trim();
    const query = newSmartFeedQuery.trim();
    if (!name || (!query && newSmartFeedFeedIds.length === 0)) return;
    try {
      const sf = await createSmartFeed(name, query, newSmartFeedFeedIds);
      smartFeeds = [...smartFeeds, sf].sort((a, b) => a.name.localeCompare(b.name));
      newSmartFeedName = '';
      newSmartFeedQuery = '';
      newSmartFeedFeedIds = [];
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

  function smartFeedDetail(sf: SmartFeed): string {
    const parts: string[] = [];
    if (sf.query) parts.push(`"${sf.query}"`);
    if (sf.feed_ids.length > 0) {
      const labels = sf.feed_ids
        .map((feedId) => feeds.find((feed) => feed.id === feedId))
        .filter((feed): feed is Feed => Boolean(feed))
        .map(feedLabel);
      parts.push(labels.length > 0 ? labels.join(', ') : `${sf.feed_ids.length} feeds`);
    }
    return parts.join(' · ');
  }

  const failedFeeds = $derived(feeds.filter((feed) => feed.lastError).length);
  const pendingFeeds = $derived(feeds.filter((feed) => !feed.lastFetchedAt && !feed.lastError).length);
  const healthyFeeds = $derived(Math.max(0, feeds.length - failedFeeds - pendingFeeds));

  function feedHealth(feed: Feed): { label: string; tone: string } {
    if (feed.lastError) return { label: $t('dashboard.healthError'), tone: 'error' };
    if (!feed.lastFetchedAt) return { label: $t('dashboard.healthPending'), tone: 'pending' };
    return { label: $t('dashboard.healthOk'), tone: 'ok' };
  }

  function formatFeedDate(value: string): string {
    return new Intl.DateTimeFormat($locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: false,
    }).format(new Date(value));
  }

  onMount(() => {
    feedLanguage = $locale;
    // Redirect guests once auth state is known.
    const unsub = authReady.subscribe((ready) => {
      if (ready && !$user) goto('/login');
    });
    refresh();
    return unsub;
  });
</script>

<svelte:head>
  <title>Dashboard | KoalaNews</title>
  <meta name="description" content="Manage KoalaNews feeds, categories, smart feeds and OPML imports." />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<h1 class="mb-1 text-2xl font-semibold">{$t('dashboard.title')}</h1>
<p class="mb-5 text-sm text-muted">{$t('dashboard.subtitle')}</p>

<form class="mb-6 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)_auto_auto]" onsubmit={add}>
  <input
    class="surface min-w-0 flex-1 px-3 py-2"
    style="background: var(--bg-elevated); color: var(--text);"
    type="url"
    placeholder={$t('dashboard.urlPlaceholder')}
    bind:value={url}
    required
  />
  <select
    class="surface px-3 py-2"
    style="background: var(--bg-elevated); color: var(--text);"
    bind:value={feedLanguage}
    aria-label={$t('dashboard.feedLanguage')}
  >
    {#each FEED_LANGUAGES as lang (lang.code)}
      <option value={lang.code}>{lang.flag} {lang.name}</option>
    {/each}
  </select>
  <button class="btn-accent px-4 py-2 font-medium disabled:opacity-60" disabled={busy}>
    {busy ? $t('dashboard.adding') : $t('dashboard.addFeed')}
  </button>
  <button type="button" class="surface px-4 py-2 font-medium disabled:opacity-60" disabled={discovering} onclick={discover}>
    {discovering ? $t('dashboard.discovering') : $t('dashboard.discover')}
  </button>
</form>

{#if candidates.length > 0}
  <div class="mb-6 space-y-2">
    {#each candidates as candidate (candidate.url)}
      <div class="surface flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{candidate.title || candidate.url}</p>
          <p class="truncate text-xs text-muted">{candidate.url}</p>
        </div>
        <button class="btn-accent shrink-0 px-3 py-1.5 text-sm" disabled={busy} onclick={() => addCandidate(candidate)}>
          {$t('dashboard.add')}
        </button>
      </div>
    {/each}
  </div>
{/if}

<div class="mb-6 flex flex-wrap items-center gap-3 text-sm">
  <a class="surface px-3 py-1.5" href="/api/feeds/opml" download>{$t('dashboard.exportOpml')}</a>
  <button class="surface px-3 py-1.5 disabled:opacity-60" disabled={importing} onclick={() => fileInput?.click()}>
    {importing ? $t('dashboard.importing') : $t('dashboard.importOpml')}
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

{#if feeds.length > 0}
  <section class="mb-6 grid gap-2 sm:grid-cols-3" aria-label={$t('dashboard.healthTitle')}>
    <div class="surface px-4 py-3">
      <p class="text-xs text-muted">{$t('dashboard.healthOk')}</p>
      <p class="text-xl font-semibold" style="color: var(--accent);">{healthyFeeds}</p>
    </div>
    <div class="surface px-4 py-3">
      <p class="text-xs text-muted">{$t('dashboard.healthPending')}</p>
      <p class="text-xl font-semibold">{pendingFeeds}</p>
    </div>
    <div class="surface px-4 py-3">
      <p class="text-xs text-muted">{$t('dashboard.healthError')}</p>
      <p class="text-xl font-semibold" style={failedFeeds ? 'color: #ef4444;' : ''}>{failedFeeds}</p>
    </div>
  </section>
{/if}

{#if error}
  <p class="mb-4 text-sm" style="color: #ef4444;">{error}</p>
{/if}

<section class="mb-6">
  <h2 class="mb-2 text-sm font-medium text-muted">{$t('dashboard.categories')}</h2>
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
        placeholder={$t('dashboard.newCategory')}
        bind:value={newCategoryName}
      />
      <button class="surface px-3 py-1.5 text-sm">{$t('dashboard.add')}</button>
    </form>
  </div>
</section>

<section class="mb-6">
  <h2 class="mb-2 text-sm font-medium text-muted">{$t('dashboard.smartFeeds')}</h2>
  <p class="mb-2 text-xs text-muted">
    {$t('dashboard.smartFeedsHint')}
  </p>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    {#each smartFeeds as sf (sf.id)}
      <span class="surface flex items-center gap-2 px-3 py-1.5 text-sm">
        {sf.name}
        {#if smartFeedDetail(sf)}
          <span class="max-w-sm truncate text-muted">{smartFeedDetail(sf)}</span>
        {/if}
        <button class="text-muted hover:text-current" onclick={() => removeSmartFeed(sf.id)} title="Delete smart feed"
          >✕</button
        >
      </span>
    {/each}
  </div>
  <form class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]" onsubmit={addSmartFeed}>
    <div class="space-y-2">
      <input
        class="surface w-full px-2 py-1.5 text-sm"
        style="background: var(--bg-elevated); color: var(--text);"
        placeholder={$t('dashboard.name')}
        bind:value={newSmartFeedName}
      />
      <input
        class="surface w-full px-2 py-1.5 text-sm"
        style="background: var(--bg-elevated); color: var(--text);"
        placeholder={$t('dashboard.searchText')}
        bind:value={newSmartFeedQuery}
      />
      <button class="surface px-3 py-1.5 text-sm">{$t('dashboard.add')}</button>
    </div>
    <FeedPicker feeds={feeds} bind:selectedIds={newSmartFeedFeedIds} />
  </form>
</section>

{#if loading}
  <div class="space-y-2">
    {#each Array(3) as _}
      <div class="surface animate-pulse" style="height: 3.5rem;"></div>
    {/each}
  </div>
{:else if feeds.length === 0}
  <section class="surface empty-state">
    <div>
      <h2>{$t('dashboard.emptyTitle')}</h2>
      <p class="mt-2">{$t('dashboard.noFeeds')}</p>
    </div>
  </section>
{:else}
  <ul class="space-y-2">
    {#each feeds as feed (feed.id)}
      {@const health = feedHealth(feed)}
      <li class="surface flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">
            {feedLanguageFlag(feed.language)} {feedLabel(feed)}
            <span class="health-pill" data-tone={health.tone}>{health.label}</span>
          </p>
          <p class="truncate text-xs text-muted">{feed.url}</p>
          <p class="truncate text-xs text-muted">{feedLanguageLabel(feed.language)}</p>
          <p class="mt-1 text-xs" class:text-muted={!feed.lastError} style={feed.lastError ? 'color: #ef4444;' : ''}>
            {feed.lastError
              ? `${$t('dashboard.feedError')}: ${feed.lastError}`
              : feed.lastFetchedAt
                ? `${$t('dashboard.lastRefresh')}: ${formatFeedDate(feed.lastFetchedAt)}`
                : $t('dashboard.notRefreshed')}
          </p>
          <div class="mt-2 flex max-w-md items-center gap-2">
            <input
              class="surface min-w-0 flex-1 px-2 py-1.5 text-sm"
              style="background: var(--bg-elevated); color: var(--text);"
              placeholder={$t('dashboard.feedTitlePlaceholder')}
              value={renameTitles[feed.id] ?? ''}
              oninput={(e) =>
                (renameTitles = { ...renameTitles, [feed.id]: (e.target as HTMLInputElement).value })}
            />
            <button
              class="surface px-3 py-1.5 text-sm disabled:opacity-60"
              disabled={renamingFeed === feed.id}
              onclick={() => saveFeedTitle(feed)}>{renamingFeed === feed.id ? '…' : $t('dashboard.rename')}</button
            >
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <select
            class="surface px-2 py-1.5 text-sm"
            style="background: var(--bg-elevated); color: var(--text);"
            value={feed.category_id ?? ''}
            onchange={(e) => assignCategory(feed, (e.target as HTMLSelectElement).value)}
          >
            <option value="">{$t('dashboard.noCategory')}</option>
            {#each categories as cat (cat.id)}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
          <button class="surface px-3 py-1.5 text-sm" style="color: #ef4444;" onclick={() => remove(feed.id)}
            >{$t('dashboard.remove')}</button
          >
          <button
            class="surface px-3 py-1.5 text-sm disabled:opacity-60"
            disabled={refreshingFeed === feed.id}
            onclick={() => refreshOne(feed)}
          >
            {refreshingFeed === feed.id ? '…' : $t('dashboard.refresh')}
          </button>
        </div>
      </li>
    {/each}
  </ul>
{/if}
