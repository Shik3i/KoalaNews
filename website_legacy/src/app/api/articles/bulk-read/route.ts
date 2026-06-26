import { NextResponse } from 'next/server';
import { jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const POST = requireAuth(async (request, userId) => {
  const body = await readJsonObject(request);
  const articleIds = body?.articleIds;
  const read = body?.read === true;

  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return jsonError('invalid_article_ids', 400);
  }

  if (articleIds.length > 200) {
    return jsonError('batch_too_large', 400);
  }

  if (read) {
    const existing = await prisma.articleRead.findMany({
      where: {
        userId,
        articleId: { in: articleIds },
      },
      select: { articleId: true },
    });
    const existingIds = new Set(existing.map((e) => e.articleId));
    const toCreate = articleIds.filter((id) => !existingIds.has(id));

    if (toCreate.length > 0) {
      await prisma.articleRead.createMany({
        data: toCreate.map((id) => ({ userId, articleId: id })),
      });
    }
  } else {
    await prisma.articleRead.deleteMany({
      where: {
        userId,
        articleId: { in: articleIds },
      },
    });
  }

  return NextResponse.json({ ok: true, count: articleIds.length });
});
