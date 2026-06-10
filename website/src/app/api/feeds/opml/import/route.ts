import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';
import { normalizeFeedUrl, saveFeed } from '@/lib/rss';

interface OpmlFeed {
  title: string;
  url: string;
  category?: string;
}

function parseOpml(xmlText: string): OpmlFeed[] {
  const feeds: OpmlFeed[] = [];
  const tagRegex = /<\/?outline(?:\s+[^>]*)?\/?>/gi;
  let match;
  const categoryStack: string[] = [];

  while ((match = tagRegex.exec(xmlText)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) {
      categoryStack.pop();
    } else {
      const attrs: Record<string, string> = {};
      const attrRegex = /(\w+)="([^"]*)"/gi;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(tag)) !== null) {
        attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
      }

      const xmlUrl = attrs['xmlurl'];
      const text = attrs['text'] || attrs['title'] || '';

      if (xmlUrl) {
        feeds.push({
          title: text || xmlUrl,
          url: xmlUrl,
          category: categoryStack[categoryStack.length - 1],
        });
      } else {
        const isSelfClosing = tag.endsWith('/>');
        if (!isSelfClosing && text) {
          categoryStack.push(text);
        }
      }
    }
  }
  return feeds;
}

export const POST = requireAuth(async (request, userId) => {
  try {
    let xmlText = '';
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (file && typeof file !== 'string') {
        xmlText = await file.text();
      }
    } else {
      xmlText = await request.text();
    }

    if (!xmlText.trim()) {
      return NextResponse.json({ error: 'No OPML content provided' }, { status: 400 });
    }

    const parsedFeeds = parseOpml(xmlText);
    if (parsedFeeds.length === 0) {
      return NextResponse.json({ error: 'No feeds found in OPML content' }, { status: 400 });
    }

    let importedCount = 0;
    const failedFeeds: { url: string; error: string }[] = [];

    for (const feedItem of parsedFeeds) {
      try {
        let categoryId: string | undefined = undefined;
        if (feedItem.category) {
          const categoryName = feedItem.category.trim();
          if (categoryName) {
            const category = await prisma.category.upsert({
              where: {
                userId_name: {
                  userId,
                  name: categoryName,
                },
              },
              create: {
                userId,
                name: categoryName,
              },
              update: {},
            });
            categoryId = category.id;
          }
        }

        const normalizedUrl = await normalizeFeedUrl(feedItem.url);
        let feed = await prisma.feed.findUnique({
          where: {
            userId_url: {
              userId,
              url: normalizedUrl,
            },
          },
        });

        if (!feed) {
          feed = await saveFeed(userId, feedItem.url);
        }

        if (categoryId && feed) {
          await prisma.feed.update({
            where: { id: feed.id },
            data: { categoryId },
          });
        }
        importedCount++;
      } catch (err) {
        failedFeeds.push({ url: feedItem.url, error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      failedCount: failedFeeds.length,
      failedFeeds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process OPML import: ' + String(error) },
      { status: 500 },
    );
  }
});
