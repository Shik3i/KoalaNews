<script lang="ts">
  import type { Feed } from '$lib/api';
  import { feedLabel } from '$lib/feeds';
  import { t } from '$lib/i18n';

  let {
    feeds,
    selectedIds = $bindable([]),
  }: {
    feeds: Feed[];
    selectedIds?: string[];
  } = $props();

  let query = $state('');

  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const selected = $derived(new Set(selectedIds));
  const visibleFeeds = $derived(
    feeds.filter((feed) => {
      if (!normalizedQuery) return true;
      const haystack = `${feedLabel(feed)} ${feed.title ?? ''} ${feed.url}`.toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    }),
  );

  function toggle(id: string, checked: boolean) {
    selectedIds = checked ? [...selectedIds, id] : selectedIds.filter((feedId) => feedId !== id);
  }
</script>

<div class="surface p-3">
  <input
    class="surface w-full px-3 py-2 text-sm"
    style="background: var(--bg); color: var(--text);"
    placeholder={$t('home.searchFeeds')}
    bind:value={query}
  />

  <div class="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1" role="group" aria-label={$t('home.feeds')}>
    {#each visibleFeeds as feed (feed.id)}
      <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--bg-sunken)]">
        <input
          type="checkbox"
          checked={selected.has(feed.id)}
          onchange={(e) => toggle(feed.id, (e.target as HTMLInputElement).checked)}
        />
        <span class="min-w-0 flex-1 truncate">{feedLabel(feed)}</span>
      </label>
    {/each}
    {#if visibleFeeds.length === 0}
      <p class="px-2 py-3 text-sm text-muted">{$t('dashboard.noFeeds')}</p>
    {/if}
  </div>
</div>
