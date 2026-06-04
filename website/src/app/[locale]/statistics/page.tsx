import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function StatisticsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') notFound();

  const t = await getTranslations('statistics');

  const [userCount, feedCount, articleCount, bannedCount, topFeeds] =
    await Promise.all([
      prisma.user.count(),
      prisma.sourceFeed.count(),
      prisma.article.count(),
      prisma.user.count({ where: { banned: true } }),
      prisma.sourceFeed.findMany({
        orderBy: { articles: { _count: 'desc' } },
        take: 10,
        include: { _count: { select: { articles: true } } },
      }),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('subtitle')}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label={t('users')} value={userCount} />
        <StatCard label={t('feeds')} value={feedCount} />
        <StatCard label={t('articles')} value={articleCount} />
        <StatCard label={t('banned')} value={bannedCount} />
      </div>

      <h2 className="text-lg font-semibold mb-3">{t('topFeeds')}</h2>
      {topFeeds.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('noFeeds')}</p>
      ) : (
        <div className="space-y-2">
          {topFeeds.map((feed, i) => (
            <div
              key={feed.id}
              className="bg-white border border-gray-200 rounded p-3 flex items-center justify-between"
            >
              <div className="min-w-0 mr-4">
                <span className="text-gray-400 text-sm mr-2">#{i + 1}</span>
                <span className="text-sm font-medium">{feed.title || feed.url}</span>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {feed._count.articles} {t('articles').toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-blue-600">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
