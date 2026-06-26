<script lang="ts">
  import {
    appearance,
    THEMES,
    CARD_STYLES,
    DENSITIES,
    FONT_SCALES,
    BACKGROUNDS,
    FONT_FAMILIES,
  } from '$lib/appearance';
  import ArticleCard from './ArticleCard.svelte';
  import type { Article } from '$lib/api';

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

  const a = appearance;
  const accentPresets = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#64748b'];

  const previewArticle: Article = {
    id: 'preview',
    title: 'Your headline will look like this',
    link: '#',
    description:
      'A short preview of how article descriptions are rendered with your current card style, density, and font choices.',
    content: null,
    image_url: null,
    pub_date: new Date().toISOString(),
    guid: 'preview',
    source_feed_id: null,
    created_at: new Date().toISOString(),
    read: false,
  };
</script>

{#if open}
  <button class="fixed inset-0 z-20 bg-black/30" aria-label="Close" onclick={onclose}></button>
  <aside
    class="fixed right-0 top-0 z-30 h-full w-96 max-w-[90vw] overflow-y-auto border-l p-5"
    style="background: var(--bg); border-color: var(--border);"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">Appearance</h2>
      <button class="text-muted" onclick={onclose}>✕</button>
    </div>

    <div class="space-y-5 text-sm">
      <section>
        <h3 class="mb-2 font-medium">Preview</h3>
        <div
          class="rounded-lg p-3"
          style="background: var(--bg); border: 1px solid var(--border); overflow: hidden;"
          data-background={$a.background}
        >
          <ArticleCard article={previewArticle} />
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Theme</h3>
        <div class="grid grid-cols-3 gap-2">
          {#each THEMES as t}
            <button
              class="surface px-2 py-1.5 capitalize"
              style={$a.theme === t ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ theme: t })}>{t}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Accent</h3>
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
        <h3 class="mb-2 font-medium">Card style</h3>
        <div class="grid grid-cols-3 gap-2">
          {#each CARD_STYLES as c}
            <button
              class="surface px-2 py-1.5 capitalize"
              style={$a.cardStyle === c ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ cardStyle: c })}>{c}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Density</h3>
        <div class="grid grid-cols-3 gap-2">
          {#each DENSITIES as d}
            <button
              class="surface px-2 py-1.5 capitalize"
              style={$a.density === d ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ density: d })}>{d}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Font size</h3>
        <div class="grid grid-cols-3 gap-2">
          {#each FONT_SCALES as f}
            <button
              class="surface px-2 py-1.5 capitalize"
              style={$a.fontScale === f ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ fontScale: f })}>{f}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Background</h3>
        <div class="grid grid-cols-2 gap-2">
          {#each BACKGROUNDS as b}
            <button
              class="surface px-2 py-1.5 capitalize"
              style={$a.background === b ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ background: b })}>{b.replace('-', ' ')}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Font family</h3>
        <div class="grid grid-cols-3 gap-2">
          {#each FONT_FAMILIES as f}
            <button
              class="surface px-2 py-1.5 capitalize"
              style={$a.fontFamily === f ? 'outline: 2px solid var(--accent);' : ''}
              onclick={() => a.patch({ fontFamily: f })}>{f}</button
            >
          {/each}
        </div>
      </section>

      <section>
        <h3 class="mb-2 font-medium">Content</h3>
        <div class="space-y-2">
          {#each [['showImages', 'Images'], ['showSource', 'Source'], ['showDate', 'Date'], ['showDescription', 'Description']] as [key, label]}
            <label class="flex items-center justify-between">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={$a[key as keyof typeof $a] as boolean}
                onchange={(e) => a.patch({ [key]: (e.target as HTMLInputElement).checked })}
              />
            </label>
          {/each}
        </div>
      </section>

      <button class="btn-accent w-full px-3 py-2" onclick={() => a.reset()}>Reset to defaults</button>
    </div>
  </aside>
{/if}
