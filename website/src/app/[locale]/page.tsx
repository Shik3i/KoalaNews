import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/routing';
import { DEFAULT_APPEARANCE } from '@/lib/appearance';
import { asBoundedInt } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { ensureDefaultFeed, normalizeFeedLanguage } from '@/lib/rss';
import ArticleCard from '@/components/ArticleCard';

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; feed?: string; sort?: string; take?: string } | undefined>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as any)) {
    notFound();
  }
  const language = normalizeFeedLanguage(locale);
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('home');
  const q = resolvedSearchParams?.q?.trim();
  const feed = resolvedSearchParams?.feed?.trim();
  const sort = resolvedSearchParams?.sort === 'source' ? 'source' : 'date';
  const take = asBoundedInt(resolvedSearchParams?.take, 50, 1, 100);

  await ensureDefaultFeed(language).catch(() => null);

  // Fetch unique feed titles in the current language for autocomplete datalist
  const feedsList = await prisma.sourceFeed.findMany({
    where: { language },
    select: { title: true },
    orderBy: { title: 'asc' },
  });
  const uniqueFeedTitles = Array.from(
    new Set(feedsList.map((f) => f.title).filter((t): t is string => Boolean(t)))
  );

  const articles = await prisma.article.findMany({
    where: {
      AND: [
        { sourceFeed: { language } },
        ...(feed ? [{ sourceFeed: { title: { contains: feed } } }] : []),
      ],
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { content: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy:
      sort === 'source'
        ? [{ sourceFeed: { title: 'asc' } }, { pubDate: 'desc' }]
        : { pubDate: 'desc' },
    take,
    include: {
      sourceFeed: { select: { title: true } },
    },
  });

  return (
    <div className="space-y-10">
      {/* Search, Filter and Heading Container */}
      <div className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-950 mt-3">
        <span className="absolute -top-2.5 left-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white dark:bg-slate-950">
          📰 {t('title')}
        </span>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-2">
          {/* Subtitle & Search Inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-sm truncate hidden lg:block">
              {t('subtitle')}
            </p>
            <form method="GET" className="flex flex-row items-center gap-2">
              <div className="relative">
                <input
                  name="q"
                  defaultValue={q}
                  placeholder={t('search')}
                  className="w-[180px] rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-2.5 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
                />
                <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">🔍</span>
              </div>
              <div className="relative">
                <input
                  name="feed"
                  defaultValue={feed}
                  list="feed-sources"
                  placeholder={t('filterFeed')}
                  className="w-[150px] rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-2.5 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
                />
                <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">📰</span>
                <datalist id="feed-sources">
                  {uniqueFeedTitles.map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
              </div>
              <select
                name="sort"
                defaultValue={sort}
                className="rounded-xl border border-gray-200 bg-white dark:bg-slate-900 px-2 py-1 text-xs outline-none dark:border-gray-800"
              >
                <option value="date">{t('sortDate')}</option>
                <option value="source">{t('sortSource')}</option>
              </select>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                {t('applyFilters')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {articles.length === 0 ? (
        <section className="rounded-[1.75rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted-fg)]">
            {t('emptyEyebrow')}
          </p>
          <p className="mt-3 text-lg font-medium text-[var(--page-fg)]">{t('noArticles')}</p>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-fg)]">
                {t('sectionEyebrow')}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--page-fg)]">
                {t('sectionTitle')}
              </h2>
            </div>
            <div className="hidden rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 py-2 text-sm text-[var(--muted-fg)] sm:block">
              {articles.length} {t('results')}
            </div>
          </div>

          <div className="grid gap-5">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                description={article.description}
                link={article.link}
                imageUrl={article.imageUrl}
                feedTitle={article.sourceFeed?.title}
                pubDate={article.pubDate}
                locale={locale}
                readMoreLabel={t('readMore')}
                fromFeedLabel={t('fromFeed')}
                publishedAtLabel={t('publishedAt')}
                appearance={DEFAULT_APPEARANCE}
              />
            ))}
          </div>

          {articles.length === take && (
            <a
              href={`?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(feed ? { feed } : {}),
                sort,
                take: String(take + 50),
              })}`}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-6 text-sm font-medium text-[var(--page-fg)] transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)]"
            >
              {t('loadMore')}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
