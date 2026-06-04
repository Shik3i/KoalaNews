type ArticleCardProps = {
  title?: string | null;
  description?: string | null;
  link?: string | null;
  feedTitle?: string | null;
  pubDate?: Date | null;
  locale: string;
  readMoreLabel: string;
  fromFeedLabel: string;
  publishedAtLabel: string;
};

export default function ArticleCard({
  title,
  description,
  link,
  feedTitle,
  pubDate,
  locale,
  readMoreLabel,
  fromFeedLabel,
  publishedAtLabel,
}: ArticleCardProps) {
  return (
    <article className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition">
      <h2 className="text-lg font-semibold mb-1">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:text-blue-900 hover:underline"
          >
            {title ?? 'Untitled'}
          </a>
        ) : (
          title ?? 'Untitled'
        )}
      </h2>

      {description && (
        <p className="text-gray-600 text-sm mt-1 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
        {feedTitle && (
          <span>
            {fromFeedLabel}: {feedTitle}
          </span>
        )}
        {pubDate && (
          <span>
            {publishedAtLabel}: {pubDate.toLocaleDateString(locale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          {readMoreLabel} &rarr;
        </a>
      )}
    </article>
  );
}
