<script lang="ts">
  import { onMount } from 'svelte';
  import { getStatistics, type Statistics } from '$lib/api';
  import { feedLabel } from '$lib/feeds';
  import { t } from '$lib/i18n';

  let stats = $state<Statistics | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      stats = await getStatistics();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load statistics';
    }
  });

  const statCards = $derived(
    stats
      ? [
          [$t('statistics.users'), stats.users],
          [$t('statistics.feeds'), stats.feeds],
          [$t('statistics.articles'), stats.articles],
        ]
      : [],
  );
</script>

<h1 class="mb-1 text-2xl font-semibold">{$t('statistics.title')}</h1>
<p class="mb-6 text-sm text-muted">{$t('statistics.subtitle')}</p>

{#if error}
  <p class="text-sm" style="color: #ef4444;">{error}</p>
{:else if !stats}
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {#each Array(3) as _}
      <div class="surface animate-pulse" style="height: 5rem;"></div>
    {/each}
  </div>
{:else}
  <section class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
    {#each statCards as [label, value]}
      <div class="surface px-4 py-3">
        <p class="text-xs text-muted">{label}</p>
        <p class="mt-1 text-2xl font-semibold" style="color: var(--accent);">{value}</p>
      </div>
    {/each}
  </section>

  <h2 class="mb-3 text-lg font-semibold">{$t('statistics.topFeeds')}</h2>
  {#if stats.topFeeds.length === 0}
    <p class="text-muted">{$t('statistics.noFeeds')}</p>
  {:else}
    <ol class="space-y-2">
      {#each stats.topFeeds as feed, i}
        <li class="surface flex items-center justify-between gap-3 px-4 py-3">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-muted text-sm w-6 shrink-0">#{i + 1}</span>
            <div class="min-w-0">
              <p class="truncate font-medium">{feedLabel(feed)}</p>
              <p class="truncate text-xs text-muted">{feed.url}</p>
            </div>
          </div>
          <span class="shrink-0 text-sm text-muted">{feed.articleCount} {$t('statistics.articlesSuffix')}</span>
        </li>
      {/each}
    </ol>
  {/if}
{/if}
