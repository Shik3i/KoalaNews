import { NextResponse } from 'next/server';
import { asBoundedInt, asTrimmedString, getClientIp, jsonError, readJsonObject } from '@/lib/api';
import { runScheduledCleanup } from '@/lib/cleanup';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeFeedLanguage, saveFeed } from '@/lib/rss';
import { requireAuth } from '@/lib/with-auth';

export const GET = requireAuth(async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const take = asBoundedInt(searchParams.get('take'), 25, 1, 50);
  const categoryId = searchParams.get('categoryId') ?? undefined;

  const feeds = await prisma.feed.findMany({
    where: {
      userId,
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      sourceFeed: {
        include: {
          articles: {
            orderBy: { pubDate: 'desc' },
            take: 20,
            select: {
              id: true,
              title: true,
              description: true,
              link: true,
              imageUrl: true,
              pubDate: true,
              reads: {
                where: { userId },
                select: { userId: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const items = await Promise.all(
    feeds.slice(0, take).map(async (feed) => {
      const unreadCount = feed.sourceFeedId
        ? await prisma.article.count({
            where: {
              sourceFeedId: feed.sourceFeedId,
              reads: {
                none: {
                  userId,
                },
              },
            },
          })
        : 0;

      return {
        ...feed,
        title: feed.sourceFeed?.title ?? feed.title,
        description: feed.sourceFeed?.description ?? feed.description,
        language: feed.sourceFeed?.language ?? feed.language,
        unreadCount,
        articles: (feed.sourceFeed?.articles ?? []).map((article) => ({
          id: article.id,
          title: article.title,
          description: article.description,
          link: article.link,
          imageUrl: article.imageUrl,
          pubDate: article.pubDate,
          read: article.reads.length > 0,
        })),
      };
    }),
  );

  return NextResponse.json({
    items,
    nextCursor: feeds.length > take ? feeds[take].id : null,
  });
});

export const POST = requireAuth(async (request, userId) => {
  if (!(await checkRateLimit(`feed-create:${userId}:${getClientIp(request)}`, 10, 60_000))) {
    return jsonError('too_many_requests', 429);
  }

  try {
    const body = await readJsonObject(request);
    const url = asTrimmedString(body?.url, 2048);
    const language = normalizeFeedLanguage(body?.language);
    const categoryId = asTrimmedString(body?.categoryId, 255) || undefined;
    if (!url) {
      return jsonError('invalid_url', 400);
    }

    const feed = await saveFeed(userId, url, language);

    let updatedFeed = feed;
    if (categoryId) {
      // verify category belongs to user
      const cat = await prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (cat) {
        updatedFeed = await prisma.feed.update({
          where: { id: feed.id },
          data: { categoryId },
        });
      }
    }

    runScheduledCleanup().catch(() => null);
    return NextResponse.json(updatedFeed, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return jsonError('feed_exists', 409);
    }
    return jsonError('could_not_fetch_feed', 422);
  }
});
