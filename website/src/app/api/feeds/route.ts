import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveFeed } from '@/lib/rss';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feeds = await prisma.feed.findMany({
    where: { userId: session.user.id },
    include: {
      articles: {
        orderBy: { pubDate: 'desc' },
        take: 20,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(feeds);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const feed = await saveFeed(session.user.id, url);
    return NextResponse.json(feed, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not fetch feed' }, { status: 422 });
  }
}
