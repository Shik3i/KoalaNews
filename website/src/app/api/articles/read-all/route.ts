import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const POST = requireAuth(async (_request, userId) => {
  const count = await prisma.$executeRaw`
    INSERT OR IGNORE INTO ArticleRead (userId, articleId, readAt)
    SELECT ${userId}, a.id, CURRENT_TIMESTAMP
    FROM Article a
    JOIN Feed f ON a.sourceFeedId = f.sourceFeedId
    WHERE f.userId = ${userId}
  `;

  return NextResponse.json({ ok: true, marked: count });
});
