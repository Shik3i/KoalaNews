<script lang="ts">
  import type { Article } from '$lib/api';
  import { appearance } from '$lib/appearance';
  import { t } from '$lib/i18n';

  let {
    article,
    ontoggleread,
  }: { article: Article; ontoggleread?: (read: boolean) => void } = $props();

  const a = appearance;

  function host(link: string | null): string {
    if (!link) return '';
    try {
      return new URL(link).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function formatDate(s: string | null): string {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Cache-proxied image via the Go backend (never hot-links third parties).
  function imgSrc(url: string | null): string | null {
    if (!url) return null;
    return `/api/image?url=${encodeURIComponent(url)}`;
  }
</script>

<article
  class="surface overflow-hidden transition-shadow hover:shadow-sm"
  style="padding: var(--card-pad); opacity: {article.read ? 0.55 : 1};"
  data-card-style={$a.cardStyle}
  data-design={$a.design}
  data-read={article.read}
>
  <div class="flex gap-3" class:flex-col={$a.cardStyle === 'magazine'}>
    {#if $a.showImages && $a.cardStyle !== 'headline' && article.image_url}
      <img
        src={imgSrc(article.image_url)}
        alt=""
        loading="lazy"
        class="w-full object-cover"
        class:rounded-md={true}
        style={$a.cardStyle === 'compact'
          ? 'width:6rem;height:6rem;flex:none;'
          : 'max-height:14rem;'}
      />
    {/if}

    <div class="min-w-0 flex-1">
      <div class="mb-1 flex items-center gap-2 text-xs text-muted">
        {#if $a.showSource && host(article.link)}<span>{host(article.link)}</span>{/if}
        {#if $a.showSource && $a.showDate && formatDate(article.pub_date)}<span>·</span>{/if}
        {#if $a.showDate && formatDate(article.pub_date)}<span>{formatDate(article.pub_date)}</span>{/if}
        {#if ontoggleread}
          <button
            class="ml-auto shrink-0 rounded px-2 py-0.5 transition-colors hover:underline"
            onclick={() => ontoggleread?.(!article.read)}
            title={article.read ? 'Mark as unread' : 'Mark as read'}
          >
            {article.read ? '○ Unread' : '✓ Read'}
          </button>
        {/if}
      </div>

      <h2
        class="font-semibold leading-snug"
        class:text-lg={$a.cardStyle === 'magazine'}
        class:text-base={$a.cardStyle !== 'magazine'}
      >
        <a
          href={article.link ?? '#'}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onclick={() => ontoggleread?.(true)}
          >{article.title ? stripTags(article.title) : 'Untitled'}</a
        >
      </h2>

      {#if $a.showDescription && $a.descriptionLines > 0 && $a.cardStyle !== 'headline' && article.description}
        <p
          class="mt-1 overflow-hidden text-sm text-muted"
          style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:{$a.descriptionLines};"
        >
          {stripTags(article.description)}
        </p>
      {/if}

      {#if $a.showReadMore && $a.cardStyle !== 'headline' && article.link}
        <a
          class="link-accent mt-2 inline-block text-sm"
          href={article.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onclick={() => ontoggleread?.(true)}>{$t('home.readMore')} →</a
        >
      {/if}
    </div>
  </div>
</article>

<script lang="ts" module>
  // Strip tags and decode HTML entities from RSS descriptions (display only).
  export function stripTags(html: string): string {
    const stripped = html.replace(/<[^>]*>/g, '');
    const el = document.createElement('textarea');
    el.innerHTML = stripped;
    return el.value.trim();
  }
</script>
