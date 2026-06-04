import { DEFAULT_APPEARANCE, type AppearanceSettings } from '@/lib/appearance';

type ArticleCardProps = {
  title?: string | null;
  description?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  feedTitle?: string | null;
  pubDate?: Date | null;
  locale: string;
  readMoreLabel: string;
  fromFeedLabel: string;
  publishedAtLabel: string;
  appearance?: Partial<AppearanceSettings>;
};

export default function ArticleCard({
  title,
  description,
  link,
  imageUrl,
  feedTitle,
  pubDate,
  locale,
  readMoreLabel,
  fromFeedLabel,
  publishedAtLabel,
  appearance,
}: ArticleCardProps) {
  const settings = { ...DEFAULT_APPEARANCE, ...appearance };
  const safeLink = getSafeExternalLink(link);
  const proxiedImage = settings.showImages ? getProxiedImageUrl(imageUrl) : null;
  const isHeadline = settings.cardStyle === 'headline';
  const isCompact = settings.cardStyle === 'compact' || settings.cardStyle === 'dense';
  const showDescription = settings.showDescription && !isHeadline && description && settings.descriptionLines > 0;
  const articleClass = [
    'article-card bg-white border border-gray-200 transition dark:bg-gray-950 dark:border-gray-800',
    settings.cardStyle === 'minimal' ? 'rounded p-4' : 'rounded-lg hover:shadow-sm',
    settings.cardStyle === 'dense' ? 'p-3' : settings.density === 'dense' ? 'p-3' : 'p-5',
    settings.design === 'terminal' ? 'font-mono' : '',
  ].join(' ');
  const titleClass = isHeadline || isCompact ? 'text-base font-semibold' : 'text-lg font-semibold';

  return (
    <article
      className={articleClass}
      data-card-style={settings.cardStyle}
      data-design={settings.design}
      data-accent={settings.accentColor}
      data-font-scale={settings.fontScale}
      data-density={settings.density}
    >
      <div className={proxiedImage && !isCompact ? 'grid gap-4 sm:grid-cols-[160px_1fr]' : ''}>
        {proxiedImage && !isHeadline && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedImage}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className={
              isCompact
                ? 'mb-3 h-28 w-full rounded object-cover'
                : 'h-36 w-full rounded object-cover sm:h-full'
            }
          />
        )}

        <div>
          <h2 className={`${titleClass} mb-1`}>
            {safeLink ? (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                {title ?? 'Untitled'}
              </a>
            ) : (
              title ?? 'Untitled'
            )}
          </h2>

          {showDescription && (
            <p
              className="text-gray-600 text-sm mt-1 dark:text-gray-300"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: settings.descriptionLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}

          {(settings.showSource || settings.showDate) && (
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
              {settings.showSource && feedTitle && (
                <span>
                  {fromFeedLabel}: {feedTitle}
                </span>
              )}
              {settings.showDate && pubDate && (
                <span>
                  {publishedAtLabel}: {pubDate.toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          )}

          {settings.showReadMore && safeLink && settings.cardStyle !== 'headline' && (
            <a
              href={safeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300"
            >
              {readMoreLabel} &rarr;
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function getSafeExternalLink(link?: string | null) {
  if (!link) return null;
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function getProxiedImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return `/api/image?src=${encodeURIComponent(url.href)}`;
  } catch {
    return null;
  }
}
