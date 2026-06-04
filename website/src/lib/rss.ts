import { lookup } from 'node:dns/promises';
import net from 'node:net';
import Parser from 'rss-parser';
import { prisma } from './prisma';

type FeedItem = {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  enclosure?: { url?: string; type?: string };
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  [key: string]: unknown;
};

type ParsedFeed = {
  title?: string;
  description?: string;
  items: FeedItem[];
};

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'localhost' || lower.endsWith('.localhost');
}

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:')
    );
  }

  return true;
}

async function assertSafeFeedUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Unsupported feed URL protocol');
  }
  if (url.href.length > 2048 || isBlockedHostname(url.hostname)) {
    throw new Error('Unsafe feed URL');
  }

  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
    throw new Error('Unsafe feed host');
  }
}

export async function normalizeFeedUrl(input: string): Promise<string> {
  const value = input.trim();
  const url = new URL(value);
  await assertSafeFeedUrl(url);
  return url.href;
}

export async function normalizeExternalAssetUrl(input: string): Promise<string> {
  return normalizeFeedUrl(input);
}

async function fetchFeedText(input: string, redirects = 0): Promise<string> {
  const url = new URL(input);
  await assertSafeFeedUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'KoalaNews/1.0' },
      redirect: 'manual',
      signal: controller.signal,
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects >= MAX_REDIRECTS) throw new Error('Too many redirects');
      return fetchFeedText(new URL(location, url).href, redirects + 1);
    }

    if (!response.ok || !response.body) throw new Error('Could not fetch feed');

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_FEED_BYTES) throw new Error('Feed too large');
      chunks.push(value);
    }

    return new TextDecoder().decode(Buffer.concat(chunks));
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeedDate(item: FeedItem): Date | null {
  const value = item.isoDate ?? item.pubDate;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getItemImageUrl(item: FeedItem): string | null {
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) return item.enclosure.url;

  const mediaContent = item['media:content'];
  if (Array.isArray(mediaContent)) {
    for (const entry of mediaContent) {
      const meta = (entry as { $?: { url?: string; medium?: string; type?: string } }).$;
      if (meta?.url && (meta.medium === 'image' || meta.type?.startsWith('image/'))) {
        return meta.url;
      }
    }
  }

  const mediaThumbnail = item['media:thumbnail'];
  if (Array.isArray(mediaThumbnail)) {
    for (const entry of mediaThumbnail) {
      const url = (entry as { $?: { url?: string } }).$?.url;
      if (url) return url;
    }
  }

  return null;
}

function buildNewArticles(items: FeedItem[], existingGuids: Set<string>, sourceFeedId: string) {
  const seen = new Set(existingGuids);
  return items.flatMap((item) => {
    if (!item.guid || seen.has(item.guid)) return [];
    seen.add(item.guid);
    return [
      {
        title: item.title,
        link: item.link,
        description: item.contentSnippet ?? item.content,
        content: item.content,
        imageUrl: getItemImageUrl(item),
        pubDate: parseFeedDate(item),
        guid: item.guid,
        sourceFeedId,
      },
    ];
  });
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}

async function createArticles(data: ReturnType<typeof buildNewArticles>) {
  if (data.length === 0) return;
  try {
    await prisma.article.createMany({ data });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
  }
}

export async function fetchAndParseFeed(url: string): Promise<ParsedFeed> {
  const parser = new Parser();
  const feedText = await fetchFeedText(url);
  const feed = await parser.parseString(feedText);
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
      enclosure: item.enclosure,
      'media:content': item['media:content'],
      'media:thumbnail': item['media:thumbnail'],
    })),
  };
}

export async function saveFeed(userId: string, url: string) {
  const normalizedUrl = await normalizeFeedUrl(url);
  const sourceFeed = await prisma.sourceFeed.upsert({
    where: { url: normalizedUrl },
    create: { url: normalizedUrl },
    update: {},
  });
  const parsed = await fetchAndParseFeed(normalizedUrl);

  const feed = await prisma.feed.create({
    data: {
      url: normalizedUrl,
      title: parsed.title,
      description: parsed.description,
      userId,
      sourceFeedId: sourceFeed.id,
      lastFetchedAt: new Date(),
    },
  });

  await prisma.sourceFeed.update({
    where: { id: sourceFeed.id },
    data: {
      title: parsed.title,
      description: parsed.description,
      lastFetchedAt: new Date(),
    },
  });

  if (parsed.items.length > 0) {
    const existing = await prisma.article.findMany({
      where: { sourceFeedId: sourceFeed.id },
      select: { guid: true },
    });
    const existingGuids = new Set(existing.map((a) => a.guid).filter(isString));

    const articles = buildNewArticles(parsed.items, existingGuids, sourceFeed.id);

    await createArticles(articles);
  }

  return feed;
}

export async function refreshFeed(feedId: string) {
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
    include: { sourceFeed: true },
  });
  if (!feed) throw new Error('Feed not found');
  const sourceFeed = feed.sourceFeed;
  if (!sourceFeed) throw new Error('Source feed not found');
  if (sourceFeed.lastFetchedAt && Date.now() - sourceFeed.lastFetchedAt.getTime() < 60_000) {
    throw new Error('Feed refreshed too recently');
  }

  const parsed = await fetchAndParseFeed(sourceFeed.url);

  await prisma.sourceFeed.update({
    where: { id: sourceFeed.id },
    data: {
      title: parsed.title,
      description: parsed.description,
      lastFetchedAt: new Date(),
    },
  });

  await prisma.feed.updateMany({
    where: { sourceFeedId: sourceFeed.id },
    data: {
      title: parsed.title,
      description: parsed.description,
      lastFetchedAt: new Date(),
    },
  });

  if (parsed.items.length > 0) {
    const existing = await prisma.article.findMany({
      where: { sourceFeedId: sourceFeed.id },
      select: { guid: true },
    });
    const existingGuids = new Set(existing.map((a) => a.guid).filter(isString));

    const articles = buildNewArticles(parsed.items, existingGuids, sourceFeed.id);

    await createArticles(articles);
  }
}
