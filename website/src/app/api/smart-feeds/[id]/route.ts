import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const DELETE = requireAuth(
  async (_request: Request, userId, _role, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const smartFeed = await prisma.smartFeed.findFirst({
      where: { id, userId }
    });
    if (!smartFeed) return jsonError('not_found', 404);

    await prisma.smartFeed.delete({
      where: { id }
    });

    return NextResponse.json({ ok: true });
  }
);
