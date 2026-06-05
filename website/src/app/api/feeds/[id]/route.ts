import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
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
