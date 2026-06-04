import Parser from 'rss-parser';
import { prisma } from './prisma';

type FeedItem = {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
};

type ParsedFeed = {
  title?: string;
  description?: string;
  items: FeedItem[];
};

export async function fetchAndParseFeed(url: string): Promise<ParsedFeed> {
  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'KoalaNews/1.0',
    },
  });
  const feed = await parser.parseURL(url);
  return {
    title: feed.title,
    description: feed.description,
    items: feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      content: item.content,
      contentSnippet: item.contentSnippet,
      guid: item.guid ?? item.link,
      pubDate: item.pubDate,
      isoDate: item.isoDate,
    })),
  };
}

export async function saveFeed(userId: string, url: string) {
  const parsed = await fetchAndParseFeed(url);

  const feed = await prisma.feed.create({
    data: {
      url,
      title: parsed.title,
      description: parsed.description,
      userId,
    },
  });

  if (parsed.items.length > 0) {
    const existing = await prisma.article.findMany({
      where: { feedId: feed.id },
      select: { guid: true },
    });
    const existingGuids = new Set(existing.map((a) => a.guid).filter(Boolean));

    const articles = parsed.items
      .filter((item) => item.guid && !existingGuids.has(item.guid))
      .map((item) => ({
        title: item.title,
        link: item.link,
        description: item.contentSnippet ?? item.content,
        content: item.content,
        pubDate: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
        guid: item.guid!,
        feedId: feed.id,
      }));

    if (articles.length > 0) {
      await prisma.article.createMany({ data: articles });
    }
  }

  return feed;
}

export async function refreshFeed(feedId: string) {
  const feed = await prisma.feed.findUnique({ where: { id: feedId } });
  if (!feed) throw new Error('Feed not found');

  const parsed = await fetchAndParseFeed(feed.url);

  await prisma.feed.update({
    where: { id: feedId },
    data: {
      title: parsed.title,
      description: parsed.description,
    },
  });

  if (parsed.items.length > 0) {
    const existing = await prisma.article.findMany({
      where: { feedId },
      select: { guid: true },
    });
    const existingGuids = new Set(existing.map((a) => a.guid).filter(Boolean));

    const articles = parsed.items
      .filter((item) => item.guid && !existingGuids.has(item.guid))
      .map((item) => ({
        title: item.title,
        link: item.link,
        description: item.contentSnippet ?? item.content,
        content: item.content,
        pubDate: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
        guid: item.guid!,
        feedId,
      }));

    if (articles.length > 0) {
      await prisma.article.createMany({ data: articles });
    }
  }
}
