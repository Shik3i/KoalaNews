import { getTranslations } from 'next-intl/server';
import { DEFAULT_APPEARANCE } from '@/lib/appearance';
import { asBoundedInt } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import ArticleCard from '@/components/ArticleCard';

export default async function HomePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { q?: string; feed?: string; sort?: string; take?: string };
}) {
  const t = await getTranslations('home');
  const q = searchParams?.q?.trim();
  const feed = searchParams?.feed?.trim();
  const sort = searchParams?.sort === 'source' ? 'source' : 'date';
  const take = asBoundedInt(searchParams?.take, 50, 1, 100);

  const articles = await prisma.article.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { content: { contains: q } },
            ],
          }
        : {}),
      ...(feed ? { sourceFeed: { title: { contains: feed } } } : {}),
    },
    orderBy: sort === 'source' ? [{ sourceFeed: { title: 'asc' } }, { pubDate: 'desc' }] : { pubDate: 'desc' },
    take,
    include: {
      sourceFeed: { select: { title: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('subtitle')}</p>

      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder={t('search')}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="feed"
          defaultValue={feed}
          placeholder={t('filterFeed')}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">{t('sortDate')}</option>
          <option value="source">{t('sortSource')}</option>
        </select>
        <button className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700">
          {t('applyFilters')}
        </button>
      </form>

      {articles.length === 0 ? (
        <p className="text-gray-400 text-center py-12">{t('noArticles')}</p>
      ) : (
        <div className="space-y-4">
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
          {articles.length === take && (
            <a
              href={`?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(feed ? { feed } : {}),
                sort,
                take: String(take + 50),
              })}`}
              className="block text-center border border-gray-200 rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('loadMore')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
