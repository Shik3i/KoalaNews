import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refreshFeed } from '@/lib/rss';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { feedId } = await request.json();

    if (!feedId) {
      return NextResponse.json({ error: 'feedId required' }, { status: 400 });
    }

    const feed = await prisma.feed.findUnique({ where: { id: feedId } });
    if (!feed || feed.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await refreshFeed(feedId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not refresh feed' }, { status: 422 });
  }
}
