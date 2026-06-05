import { getTranslations } from 'next-intl/server';
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
  const language = normalizeFeedLanguage(locale);
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('home');
  const q = resolvedSearchParams?.q?.trim();
  const feed = resolvedSearchParams?.feed?.trim();
  const sort = resolvedSearchParams?.sort === 'source' ? 'source' : 'date';
  const take = asBoundedInt(resolvedSearchParams?.take, 50, 1, 100);

  await ensureDefaultFeed(language).catch(() => null);

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
      <section className="overflow-hidden rounded-[2rem] border border-white/40 bg-[var(--surface-hero)] px-6 py-10 shadow-[0_28px_90px_rgba(15,23,42,0.16)] sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/60 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-fg)] shadow-sm">
            {t('eyebrow')}
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--page-fg)] sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted-fg)] sm:text-lg">
            {t('subtitle')}
          </p>
        </div>

        <details className="group mx-auto mt-8 max-w-4xl rounded-[1.75rem] border border-white/60 bg-white/75 p-3 shadow-[0_20px_60px_rgba(148,163,184,0.20)] backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--page-fg)] marker:hidden">
            <span>{t('filterToggle')}</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-elevated)] text-lg leading-none transition group-open:rotate-45">
              +
            </span>
          </summary>
          <form className="mt-3 grid gap-3 xl:grid-cols-[1.3fr_1fr_180px_auto]">
            <input
              name="q"
              defaultValue={q}
              placeholder={t('search')}
              className="h-12 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--page-fg)] outline-none transition placeholder:text-[var(--muted-fg)] focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
            <input
              name="feed"
              defaultValue={feed}
              placeholder={t('filterFeed')}
              className="h-12 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--page-fg)] outline-none transition placeholder:text-[var(--muted-fg)] focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
            <select
              name="sort"
              defaultValue={sort}
              className="h-12 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 text-sm font-medium text-[var(--page-fg)] outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            >
              <option value="date">{t('sortDate')}</option>
              <option value="source">{t('sortSource')}</option>
            </select>
            <button className="h-12 rounded-2xl bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(14,116,144,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(14,116,144,0.34)]">
              {t('applyFilters')}
            </button>
          </form>
        </details>
      </section>

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
