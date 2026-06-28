<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listArticles,
    markRead,
    markUnread,
    markAllRead,
    listCategories,
    listSmartFeeds,
    listFeeds,
    createSmartFeed,
    getArticlesOverview,
    type Article,
    type Category,
    type SmartFeed,
    type Feed,
    type Story,
    type DaySummary,
  } from '$lib/api';
  import { user } from '$lib/auth';
  import { locale, t } from '$lib/i18n';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
  import FeedPicker from '$lib/components/FeedPicker.svelte';

  let articles = $state<Article[]>([]);
  let categories = $state<Category[]>([]);
  let smartFeeds = $state<SmartFeed[]>([]);
  let feeds = $state<Feed[]>([]);
  let activeCategory = $state('');
  let activeSmartFeed = $state('');
  let adhocFeedIds = $state<string[]>([]);
  let feedPickerOpen = $state(false);
  let loading = $state(true);
  let loadingMore = $state(false);
  let error = $state<string | null>(null);
  let query = $state('');
  let unreadOnly = $state(false);
  let sort = $state<'newest' | 'oldest' | 'title' | 'source'>('newest');
  let hasMore = $state(false);
  let topStories = $state<Story[]>([]);
  let daySummaries = $state<DaySummary[]>([]);

  const pageSize = 40;

  function articleOptions(offset = 0) {
    return $user
      ? {
          limit: pageSize,
          offset,
          category: activeSmartFeed || adhocFeedIds.length ? undefined : activeCategory || undefined,
          smartFeed: adhocFeedIds.length ? undefined : activeSmartFeed || undefined,
          feeds: adhocFeedIds.length ? adhocFeedIds : undefined,
          q: query.trim() || undefined,
          unread: unreadOnly,
          sort,
        }
      : {
          lang: $locale,
          limit: pageSize,
          offset,
          q: query.trim() || undefined,
          sort,
        };
  }

  async function load(reset = true) {
    if (reset) loading = true;
    else loadingMore = true;
    error = null;
    try {
      const next = await listArticles(articleOptions(reset ? 0 : articles.length));
      articles = reset ? next : [...articles, ...next];
      hasMore = next.length === pageSize;
      if (reset) {
        const overview = await getArticlesOverview(articleOptions(0));
        topStories = overview.topStories;
        daySummaries = overview.days;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  onMount(async () => {
    try {
      [categories, smartFeeds, feeds] = await Promise.all([
        listCategories(),
        listSmartFeeds(),
        listFeeds(),
      ]);
    } catch {
      // categories/smart feeds/feeds are optional UI; ignore failures
    }
  });

  function selectCategory(id: string) {
    activeCategory = id;
    activeSmartFeed = '';
    adhocFeedIds = [];
  }

  function selectSmartFeed(id: string) {
    activeSmartFeed = id;
    activeCategory = '';
    adhocFeedIds = [];
  }

  function openFeedPicker() {
    feedPickerOpen = !feedPickerOpen;
    activeCategory = '';
    activeSmartFeed = '';
  }

  async function saveAdhocFeed() {
    if (adhocFeedIds.length === 0) return;
    const name = window.prompt($t('home.customFeedName'));
    if (!name?.trim()) return;
    try {
      const sf = await createSmartFeed(name.trim(), '', adhocFeedIds);
      smartFeeds = [...smartFeeds, sf].sort((a, b) => a.name.localeCompare(b.name));
      activeSmartFeed = sf.id;
      adhocFeedIds = [];
      feedPickerOpen = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not save custom feed';
    }
  }

  $effect(() => {
    // Re-run when the user logs in/out, the global locale, or the active filter changes.
    void $user;
    void $locale;
    void activeCategory;
    void activeSmartFeed;
    void adhocFeedIds;
    void query;
    void unreadOnly;
    void sort;
    load(true);
  });

  // Optimistic read toggle: update the UI immediately, then persist; roll back on error.
  async function toggleRead(article: Article, read: boolean) {
    if (article.read === read) return;
    articles = articles.map((a) => (a.id === article.id ? { ...a, read } : a));
    try {
      await (read ? markRead(article.id) : markUnread(article.id));
    } catch {
      articles = articles.map((a) => (a.id === article.id ? { ...a, read: !read } : a));
    }
  }

  async function markAll() {
    const prev = articles;
    articles = articles.map((a) => ({ ...a, read: true }));
    try {
      await markAllRead();
    } catch {
      articles = prev;
    }
  }

  const unreadCount = $derived(articles.filter((a) => !a.read).length);
</script>

{#if $user}
  <div class="mb-4 flex items-center justify-between">
    <h1 class="text-xl font-semibold">
      {$t('home.yourFeed')}
      {#if unreadCount > 0}<span class="text-sm font-normal text-muted">· {unreadCount} {$t('home.unread')}</span>{/if}
    </h1>
    {#if unreadCount > 0}
      <button class="surface px-3 py-1.5 text-sm" onclick={markAll}>{$t('home.markAllRead')}</button>
    {/if}
  </div>
  <div class="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
    <input
      class="surface min-w-0 px-3 py-2 text-sm"
      style="background: var(--bg-elevated); color: var(--text);"
      placeholder={$t('home.searchArticles')}
      bind:value={query}
    />
    <select
      class="surface px-3 py-2 text-sm"
      style="background: var(--bg-elevated); color: var(--text);"
      bind:value={sort}
    >
      <option value="newest">{$t('home.sortNewest')}</option>
      <option value="oldest">{$t('home.sortOldest')}</option>
      <option value="title">{$t('home.sortTitle')}</option>
      <option value="source">{$t('home.sortSource')}</option>
    </select>
    <label class="surface flex items-center gap-2 px-3 py-2 text-sm">
      <input type="checkbox" bind:checked={unreadOnly} />
      {$t('home.unreadOnly')}
    </label>
    <button class="surface px-3 py-2 text-sm" onclick={() => load(true)}>{$t('home.refresh')}</button>
  </div>
  {#if categories.length > 0 || smartFeeds.length > 0 || feeds.length > 0}
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <button
        class="surface px-3 py-1.5 text-sm"
        style={activeCategory === '' && activeSmartFeed === '' && adhocFeedIds.length === 0
          ? 'outline: 2px solid var(--accent);'
          : ''}
        onclick={() => selectCategory('')}>{$t('home.all')}</button
      >
      {#each categories as cat (cat.id)}
        <button
          class="surface px-3 py-1.5 text-sm"
          style={activeCategory === cat.id ? 'outline: 2px solid var(--accent);' : ''}
          onclick={() => selectCategory(cat.id)}>{cat.name}</button
        >
      {/each}
      {#each smartFeeds as sf (sf.id)}
        <button
          class="surface px-3 py-1.5 text-sm"
          style={activeSmartFeed === sf.id ? 'outline: 2px solid var(--accent);' : ''}
          onclick={() => selectSmartFeed(sf.id)}>🔍 {sf.name}</button
        >
      {/each}
      {#if feeds.length > 0}
        <button
          class="surface px-3 py-1.5 text-sm"
          style={adhocFeedIds.length > 0 ? 'outline: 2px solid var(--accent);' : ''}
          onclick={openFeedPicker}>{$t('home.feeds')} ▾{adhocFeedIds.length ? ` ${adhocFeedIds.length}` : ''}</button
        >
      {/if}
    </div>
    {#if feedPickerOpen}
      <div class="mb-5 max-w-md">
        <FeedPicker feeds={feeds} bind:selectedIds={adhocFeedIds} />
        <div class="mt-2 flex items-center gap-2">
          <button
            class="btn-accent px-3 py-1.5 text-sm disabled:opacity-60"
            disabled={adhocFeedIds.length === 0}
            onclick={saveAdhocFeed}>{$t('home.saveAsFeed')}</button
          >
          {#if adhocFeedIds.length > 0}
            <button class="surface px-3 py-1.5 text-sm" onclick={() => (adhocFeedIds = [])}>{$t('home.all')}</button>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
{:else}
  <div class="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
    <input
      class="surface min-w-0 px-3 py-2 text-sm"
      style="background: var(--bg-elevated); color: var(--text);"
      placeholder={$t('home.searchArticles')}
      bind:value={query}
    />
    <select
      class="surface px-3 py-2 text-sm"
      style="background: var(--bg-elevated); color: var(--text);"
      bind:value={sort}
    >
      <option value="newest">{$t('home.sortNewest')}</option>
      <option value="oldest">{$t('home.sortOldest')}</option>
      <option value="title">{$t('home.sortTitle')}</option>
      <option value="source">{$t('home.sortSource')}</option>
    </select>
  </div>
{/if}

{#if !loading && (topStories.length > 0 || daySummaries.length > 0)}
  <section class="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
    {#if topStories.length > 0}
      <div class="surface px-4 py-3">
        <h2 class="mb-2 text-sm font-medium text-muted">{$t('home.topStories')}</h2>
        <div class="flex flex-wrap gap-2">
          {#each topStories as story (story.key)}
            <button
              class="surface max-w-full px-3 py-1.5 text-left text-sm"
              title={story.title}
              onclick={() => (query = story.title)}
            >
              <span class="font-medium">{story.title}</span>
              {#if story.count > 1}<span class="ml-1 text-muted">({story.count})</span>{/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    {#if daySummaries.length > 0}
      <div class="surface px-4 py-3">
        <h2 class="mb-2 text-sm font-medium text-muted">{$t('home.dailyOverview')}</h2>
        <div class="space-y-1 text-sm">
          {#each daySummaries as day (day.date)}
            <div class="flex justify-between gap-3">
              <span>{day.date}</span>
              <span class="text-muted">{day.count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}

{#if loading}
  <div class="flex flex-col" style="gap: var(--density-gap);">
    {#each Array(5) as _}
      <div class="surface animate-pulse" style="height: 6rem; padding: var(--card-pad);"></div>
    {/each}
  </div>
{:else if error}
  <p class="text-muted">⚠️ {error}</p>
{:else if articles.length === 0}
  {#if $user}
    <p class="text-muted">
      {$t('home.noArticlesUser')} <a class="link-accent" href="/dashboard">{$t('home.addFeeds')}</a> {$t('home.toGetStarted')}
    </p>
  {:else}
    <p class="text-muted">{$t('home.noArticlesGuest')}</p>
  {/if}
{:else}
  <div class="flex flex-col" style="gap: var(--density-gap);">
    {#each articles as article (article.id)}
      <ArticleCard {article} ontoggleread={$user ? (read) => toggleRead(article, read) : undefined} />
    {/each}
  </div>
  {#if hasMore}
    <div class="mt-5 flex justify-center">
      <button class="surface px-4 py-2 text-sm disabled:opacity-60" disabled={loadingMore} onclick={() => load(false)}>
        {loadingMore ? $t('home.loadingMore') : $t('home.loadMore')}
      </button>
    </div>
  {/if}
{/if}
