import { NextResponse } from 'next/server';
import { jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const POST = requireAuth(
  async (request: Request, userId, _role, { params }: { params: Promise<{ id: string }> }) => {
    const { id: articleId } = await params;
    const body = await readJsonObject(request);
    let read = body?.read;

    const article = await prisma.article.findUnique({
      where: { id: articleId }
    });
    if (!article) return jsonError('article_not_found', 404);

    const existing = await prisma.articleRead.findUnique({
      where: {
        userId_articleId: { userId, articleId }
      }
    });

    if (read === undefined) {
      read = !existing;
    }

    if (read) {
      if (!existing) {
        await prisma.articleRead.create({
          data: { userId, articleId }
        });
      }
    } else {
      if (existing) {
        await prisma.articleRead.delete({
          where: {
            userId_articleId: { userId, articleId }
          }
        });
      }
    }

    return NextResponse.json({ ok: true, read });
  }
);
