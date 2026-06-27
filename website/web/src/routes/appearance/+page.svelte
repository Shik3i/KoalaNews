<script lang="ts">
  import {
    appearance,
    THEMES,
    DESIGNS,
    CARD_STYLES,
    DENSITIES,
    FONT_SCALES,
    BACKGROUNDS,
    FONT_FAMILIES,
  } from '$lib/appearance';
  import { t } from '$lib/i18n';
  import type { Article } from '$lib/api';
  import ArticleCard from '$lib/components/ArticleCard.svelte';

  const a = appearance;
  const accentPresets = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#64748b'];

  // Two sample articles so the preview shows list spacing/density too.
  const samples: Article[] = [
    {
      id: 'p1',
      title: 'Your headline will look exactly like this',
      link: 'https://example.com',
      description:
        'A live preview of how article cards render with your current theme, design skin, card style, density, fonts and visible fields. Every change here is instant.',
      content: null,
      image_url: null,
      pub_date: new Date().toISOString(),
      guid: 'p1',
      source_feed_id: null,
      created_at: new Date().toISOString(),
      read: false,
    },
    {
      id: 'p2',
      title: 'A second card, already marked as read',
      link: 'https://example.com/2',
      description: 'Read articles dim slightly so your unread items stand out at a glance.',
      content: null,
      image_url: null,
      pub_date: new Date(Date.now() - 3600_000).toISOString(),
      guid: 'p2',
      source_feed_id: null,
      created_at: new Date().toISOString(),
      read: true,
    },
  ];

  const toggles: [keyof typeof $a, string][] = [
    ['showImages', 'appearance.images'],
    ['showSource', 'appearance.source'],
    ['showDate', 'appearance.date'],
    ['showDescription', 'appearance.description'],
    ['showReadMore', 'appearance.readMore'],
  ];
</script>

<div class="mb-6">
  <h1 class="text-2xl font-semibold">{$t('appearance.title')}</h1>
  <p class="mt-1 max-w-2xl text-sm text-muted">{$t('appearance.subtitle')}</p>
</div>

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
  <!-- Controls -->
  <div class="space-y-6">
    <section>
      <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.theme')}</h2>
      <div class="flex flex-wrap gap-2">
        {#each THEMES as opt}
          <button
            class="surface px-3 py-1.5 text-sm capitalize"
            style={$a.theme === opt ? 'outline: 2px solid var(--accent);' : ''}
            onclick={() => a.patch({ theme: opt })}>{opt}</button
          >
        {/each}
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.design')}</h2>
      <div class="flex flex-wrap gap-2">
        {#each DESIGNS as opt}
          <button
            class="surface px-3 py-1.5 text-sm capitalize"
            style={$a.design === opt ? 'outline: 2px solid var(--accent);' : ''}
            onclick={() => a.patch({ design: opt })}>{opt.replace('-', ' ')}</button
          >
        {/each}
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.accent')}</h2>
      <div class="flex flex-wrap items-center gap-2">
        {#each accentPresets as c}
          <button
            class="h-7 w-7 rounded-full border"
            style="background: {c}; border-color: var(--border);"
            aria-label={c}
            onclick={() => a.patch({ accent: c })}
          ></button>
        {/each}
        <input
          type="color"
          value={$a.accent}
          class="h-7 w-7 cursor-pointer rounded"
          oninput={(e) => a.patch({ accent: (e.target as HTMLInputElement).value })}
        />
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.cardStyle')}</h2>
      <div class="flex flex-wrap gap-2">
        {#each CARD_STYLES as opt}
          <button
            class="surface px-3 py-1.5 text-sm capitalize"
            style={$a.cardStyle === opt ? 'outline: 2px solid var(--accent);' : ''}
            onclick={() => a.patch({ cardStyle: opt })}>{opt}</button
          >
        {/each}
      </div>
    </section>

    <div class="grid gap-6 sm:grid-cols-2">
      <section>
        <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.density')}</h2>
        <div class="flex flex-wrap gap-2">
          {#each DENSITIES as opt}
            <button
              class="surface px-3 py-1.5 text-sm capitalize"
              style={$a.density === opt ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ density: opt })}>{opt}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.fontSize')}</h2>
        <div class="flex flex-wrap gap-2">
          {#each FONT_SCALES as opt}
            <button
              class="surface px-3 py-1.5 text-sm capitalize"
              style={$a.fontScale === opt ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ fontScale: opt })}>{opt}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.background')}</h2>
        <div class="flex flex-wrap gap-2">
          {#each BACKGROUNDS as opt}
            <button
              class="surface px-3 py-1.5 text-sm capitalize"
              style={$a.background === opt ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ background: opt })}>{opt.replace('-', ' ')}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.fontFamily')}</h2>
        <div class="flex flex-wrap gap-2">
          {#each FONT_FAMILIES as opt}
            <button
              class="surface px-3 py-1.5 text-sm capitalize"
              style={$a.fontFamily === opt ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ fontFamily: opt })}>{opt}</button
            >
          {/each}
        </div>
      </section>
    </div>

    <section>
      <h2 class="mb-2 text-sm font-medium text-muted">
        {$t('appearance.descriptionLines')}: {$a.descriptionLines}
      </h2>
      <input
        type="range"
        min="0"
        max="5"
        step="1"
        value={$a.descriptionLines}
        class="w-full max-w-xs"
        oninput={(e) => a.patch({ descriptionLines: Number((e.target as HTMLInputElement).value) })}
      />
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium text-muted">{$t('appearance.content')}</h2>
      <div class="grid gap-2 sm:grid-cols-2">
        {#each toggles as [key, label]}
          <label class="surface flex items-center justify-between px-3 py-2 text-sm">
            <span>{$t(label)}</span>
            <input
              type="checkbox"
              checked={$a[key] as boolean}
              onchange={(e) => a.patch({ [key]: (e.target as HTMLInputElement).checked })}
            />
          </label>
        {/each}
      </div>
    </section>

    <button class="btn-accent px-4 py-2 text-sm font-medium" onclick={() => a.reset()}>
      {$t('appearance.reset')}
    </button>
  </div>

  <!-- Live preview -->
  <aside class="lg:sticky lg:top-24 lg:self-start">
    <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
      {$t('appearance.preview')}
    </h2>
    <div
      class="rounded-lg p-3"
      style="background: var(--bg); border: 1px solid var(--border); overflow: hidden;"
      data-background={$a.background}
    >
      <div class="flex flex-col" style="gap: var(--density-gap);">
        {#each samples as article (article.id)}
          <ArticleCard {article} />
        {/each}
      </div>
    </div>
  </aside>
</div>
