<script lang="ts">
  import { listArticles, type Article } from '$lib/api';
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
</script>

{#if $user}
  <h1 class="mb-4 text-xl font-semibold">Your feed</h1>
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
      <ArticleCard {article} />
    {/each}
  </div>
{/if}
