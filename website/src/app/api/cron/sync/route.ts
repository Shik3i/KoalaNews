import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAndParseFeed, normalizeFeedLanguage } from '@/lib/rss';

// Helper to check authorization
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || 'koalanews-secret';

  return token === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return runSync();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return runSync();
}

async function runSync() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
  const sourceFeeds = await prisma.sourceFeed.findMany({
    where: {
      OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: twoHoursAgo } }],
    },
    take: 10,
  });

  let updatedCount = 0;
  for (const sourceFeed of sourceFeeds) {
    try {
      const parsed = await fetchAndParseFeed(sourceFeed.url);

      await prisma.sourceFeed.update({
        where: { id: sourceFeed.id },
        data: {
          title: parsed.title,
          description: parsed.description,
          language: normalizeFeedLanguage(sourceFeed.language),
          lastFetchedAt: new Date(),
        },
      });

      await prisma.feed.updateMany({
        where: { sourceFeedId: sourceFeed.id },
        data: {
          title: parsed.title,
          description: parsed.description,
          language: normalizeFeedLanguage(sourceFeed.language),
          lastFetchedAt: new Date(),
        },
      });

      if (parsed.items.length > 0) {
        const existing = await prisma.article.findMany({
          where: { sourceFeedId: sourceFeed.id },
          select: { guid: true },
        });
        const existingGuids = new Set(
          existing.map((a) => a.guid).filter((g): g is string => typeof g === 'string'),
        );

        // Manually build new articles to insert
        const newArticles = parsed.items.flatMap((item) => {
          if (!item.guid || existingGuids.has(item.guid)) return [];

          // Helper to find image url
          let imageUrl: string | null = null;
          if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
            imageUrl = item.enclosure.url;
          } else {
            const mediaContent = item['media:content'];
            if (Array.isArray(mediaContent)) {
              for (const entry of mediaContent) {
                const meta = (entry as { $?: { url?: string; medium?: string; type?: string } }).$;
                if (meta?.url && (meta.medium === 'image' || meta.type?.startsWith('image/'))) {
                  imageUrl = meta.url;
                  break;
                }
              }
            }
          }

          return [
            {
              title: item.title ?? 'Untitled',
              link: item.link ?? null,
              description: item.contentSnippet ?? item.content ?? null,
              content: item.content ?? null,
              imageUrl,
              pubDate:
                item.isoDate || item.pubDate ? new Date(item.isoDate ?? item.pubDate!) : new Date(),
              guid: item.guid,
              sourceFeedId: sourceFeed.id,
            },
          ];
        });

        if (newArticles.length > 0) {
          await Promise.allSettled(
            newArticles.map((item) =>
              prisma.article.create({ data: item }).catch((err) => {
                if ((err as { code?: string }).code !== 'P2002') throw err;
              }),
            ),
          );
        }
      }
      updatedCount++;
    } catch (e) {
      console.error(`Failed to refresh source feed ${sourceFeed.url}`, e);
    }
  }

  return NextResponse.json({ ok: true, synced: updatedCount });
}
