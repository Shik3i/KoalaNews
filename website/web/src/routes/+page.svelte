<script lang="ts">
  import { listArticles, markRead, markUnread, markAllRead, type Article } from '$lib/api';
  import { user } from '$lib/auth';
  import ArticleCard from '$lib/components/ArticleCard.svelte';

  const LANGS = [
    ['en', 'English'],
    ['de', 'Deutsch'],
    ['fr', 'Français'],
  ] as const;

  let lang = $state('en');
  let articles = $state<Article[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      // Logged-in users get their personal subscription feed; guests get the locale feed.
      articles = $user ? await listArticles({ limit: 40 }) : await listArticles({ lang, limit: 40 });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Re-run when the user logs in/out or the guest language changes.
    void $user;
    void lang;
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
      Your feed
      {#if unreadCount > 0}<span class="text-sm font-normal text-muted">· {unreadCount} unread</span>{/if}
    </h1>
    {#if unreadCount > 0}
      <button class="surface px-3 py-1.5 text-sm" onclick={markAll}>Mark all read</button>
    {/if}
  </div>
{:else}
  <div class="mb-5 flex items-center gap-2">
    {#each LANGS as [code, label]}
      <button
        class="surface px-3 py-1.5 text-sm"
        style={lang === code ? 'outline: 2px solid var(--accent);' : ''}
        onclick={() => (lang = code)}>{label}</button
      >
    {/each}
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
      No articles yet. <a class="link-accent" href="/dashboard">Add some feeds</a> to get started.
    </p>
  {:else}
    <p class="text-muted">No articles yet — the feed worker may still be fetching.</p>
  {/if}
{:else}
  <div class="flex flex-col" style="gap: var(--density-gap);">
    {#each articles as article (article.id)}
      <ArticleCard {article} ontoggleread={$user ? (read) => toggleRead(article, read) : undefined} />
    {/each}
  </div>
{/if}
