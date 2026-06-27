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
    type Article,
    type Category,
    type SmartFeed,
    type Feed,
  } from '$lib/api';
  import { user } from '$lib/auth';
  import { t } from '$lib/i18n';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
  import FeedPicker from '$lib/components/FeedPicker.svelte';

  const LANGS = [
    ['en', '🇬🇧 English'],
    ['de', '🇩🇪 Deutsch'],
    ['fr', '🇫🇷 Français'],
  ] as const;

  let lang = $state('en');
  let articles = $state<Article[]>([]);
  let categories = $state<Category[]>([]);
  let smartFeeds = $state<SmartFeed[]>([]);
  let feeds = $state<Feed[]>([]);
  let activeCategory = $state('');
  let activeSmartFeed = $state('');
  let adhocFeedIds = $state<string[]>([]);
  let feedPickerOpen = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      // Logged-in users get their personal subscription feed; guests get the locale feed.
      articles = $user
        ? await listArticles({
            limit: 40,
            category: activeSmartFeed || adhocFeedIds.length ? undefined : activeCategory || undefined,
            smartFeed: adhocFeedIds.length ? undefined : activeSmartFeed || undefined,
            feeds: adhocFeedIds.length ? adhocFeedIds : undefined,
          })
        : await listArticles({ lang, limit: 40 });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
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
    // Re-run when the user logs in/out, the guest language, or the active filter changes.
    void $user;
    void lang;
    void activeCategory;
    void activeSmartFeed;
    void adhocFeedIds;
    load();
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
  <div class="mb-5 flex items-center gap-2 text-sm">
    <label for="feed-lang" class="text-muted">{$t('home.feedLanguage')}</label>
    <select id="feed-lang" class="surface px-2 py-1.5" bind:value={lang}>
      {#each LANGS as [code, label]}
        <option value={code}>{label}</option>
      {/each}
    </select>
  </div>
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
{/if}
