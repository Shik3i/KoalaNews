import { NextResponse } from 'next/server';
import { jsonError, readJsonObject, asTrimmedString } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const GET = requireAuth(async (_request, userId) => {
  const smartFeeds = await prisma.smartFeed.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(smartFeeds);
});

export const POST = requireAuth(async (request, userId) => {
  const body = await readJsonObject(request);
  const name = asTrimmedString(body?.name, 255);
  const query = asTrimmedString(body?.query, 255);
  const feedId = asTrimmedString(body?.feedId, 255) || null;

  if (!name || !query) {
    return jsonError('invalid_input', 400);
  }

  try {
    const smartFeed = await prisma.smartFeed.create({
      data: { name, query, feedId, userId }
    });
    return NextResponse.json(smartFeed, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return jsonError('smart_feed_exists', 409);
    }
    return jsonError('could_not_create_smart_feed', 500);
  }
});
