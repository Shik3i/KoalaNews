import { NextResponse } from 'next/server';
import { asTrimmedString, getClientIp, jsonError, readJsonObject } from '@/lib/api';
import { runScheduledCleanup } from '@/lib/cleanup';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { refreshFeed } from '@/lib/rss';
import { requireAuth } from '@/lib/with-auth';

export const POST = requireAuth(async (request, userId) => {
  if (!(await checkRateLimit(`feed-refresh:${userId}:${getClientIp(request)}`, 20, 60_000))) {
    return jsonError('too_many_requests', 429);
  }

  try {
    const body = await readJsonObject(request);
    const feedId = asTrimmedString(body?.feedId, 128);
    if (!feedId) {
      return jsonError('feed_id_required', 400);
    }

    const feed = await prisma.feed.findUnique({ where: { id: feedId } });
    if (!feed || feed.userId !== userId) {
      return jsonError('not_found', 404);
    }

    await refreshFeed(feedId);
    runScheduledCleanup().catch(() => null);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError('could_not_refresh_feed', 422);
  }
});
