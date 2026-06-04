import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const POST = requireAuth(async (_request, userId) => {
  const articles = await prisma.article.findMany({
    where: { sourceFeed: { subscriptions: { some: { userId } } } },
    select: { id: true },
  });

  const existing = await prisma.articleRead.findMany({
    where: { userId },
    select: { articleId: true },
  });
  const existingIds = new Set(existing.map((item) => item.articleId));
  const unread = articles.filter((article) => !existingIds.has(article.id));

  if (unread.length > 0) {
    await prisma.articleRead.createMany({
      data: unread.map((article) => ({ userId, articleId: article.id })),
    });
  }

  return NextResponse.json({ ok: true, marked: unread.length });
});
