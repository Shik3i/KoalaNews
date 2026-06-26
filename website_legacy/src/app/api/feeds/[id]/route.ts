import { NextResponse } from 'next/server';
import { jsonError, readJsonObject, asTrimmedString } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const DELETE = requireAuth(
  async (_request: Request, userId, _role, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const feed = await prisma.feed.findUnique({
      where: { id },
    });

    if (!feed || feed.userId !== userId) {
      return jsonError('not_found', 404);
    }

    await prisma.feed.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  },
);

export const PATCH = requireAuth(
  async (request: Request, userId, _role, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await readJsonObject(request);
    const categoryId = body && 'categoryId' in body ? (body.categoryId ? asTrimmedString(body.categoryId, 255) : null) : undefined;

    const feed = await prisma.feed.findFirst({
      where: { id, userId },
    });

    if (!feed) {
      return jsonError('not_found', 404);
    }

    if (categoryId !== undefined) {
      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: { id: categoryId, userId }
        });
        if (!category) return jsonError('category_not_found', 400);
      }

      const updated = await prisma.feed.update({
        where: { id },
        data: { categoryId }
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(feed);
  }
);
