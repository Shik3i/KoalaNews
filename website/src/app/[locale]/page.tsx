import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import ArticleCard from '@/components/ArticleCard';

export default async function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations('home');

  const articles = await prisma.article.findMany({
    orderBy: { pubDate: 'desc' },
    take: 50,
    include: {
      feed: { select: { title: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('subtitle')}</p>

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
              feedTitle={article.feed.title}
              pubDate={article.pubDate}
              locale={locale}
              readMoreLabel={t('readMore')}
              fromFeedLabel={t('fromFeed')}
              publishedAtLabel={t('publishedAt')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
