import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/with-auth';

export const GET = requireAdmin(async () => {
  const [users, feeds, articles, bannedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.sourceFeed.count(),
    prisma.article.count(),
    prisma.user.count({ where: { banned: true } }),
  ]);

  const topFeeds = await prisma.sourceFeed.findMany({
    orderBy: { articles: { _count: 'desc' } },
    take: 10,
    include: { _count: { select: { articles: true } } },
  });

  return NextResponse.json({
    users,
    feeds,
    articles,
    bannedUsers,
    topFeeds: topFeeds.map((f) => ({
      title: f.title,
      url: f.url,
      articleCount: f._count.articles,
    })),
  });
});
