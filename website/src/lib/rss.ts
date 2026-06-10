import { lookup } from 'node:dns/promises';
import net from 'node:net';
import dns from 'node:dns';
import { Agent } from 'undici';
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
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DEFAULT_FEEDS = {
  de: {
    title: 'Tagesschau',
    url: 'https://www.tagesschau.de/xml/rss2/',
  },
  en: {
    title: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
  },
  fr: {
    title: 'BFMTV',
    url: 'https://www.bfmtv.com/rss/news-24-7/',
  },
} as const;

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

export const safeDispatcher = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      if (isBlockedHostname(hostname)) {
        callback(new Error('Blocked hostname'), '', 0);
        return;
      }
      dns.lookup(hostname, options, (err, address, family) => {
        if (err) {
          callback(err, '', 0);
          return;
        }
        const addresses = Array.isArray(address) ? address : [{ address, family }];
        const isUnsafe = addresses.some((addr) => isPrivateIp(addr.address));
        if (isUnsafe) {
          callback(new Error('Unsafe IP address resolved'), '', 0);
          return;
        }
        callback(null, address, family);
      });
    },
  },
});

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
      dispatcher: safeDispatcher,
    } as any);

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

  const contentHtml = (item['content:encoded'] as string) || (item.content as string);
  if (contentHtml && typeof contentHtml === 'string') {
    const match = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export type FeedLanguage = keyof typeof DEFAULT_FEEDS;

export function normalizeFeedLanguage(value: unknown): FeedLanguage {
  return value === 'de' || value === 'fr' ? value : 'en';
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
  await Promise.allSettled(
    data.map((item) =>
      prisma.article.create({ data: item }).catch((err) => {
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }),
    ),
  );
}

async function cacheArticleImages(data: ReturnType<typeof buildNewArticles>) {
  const imageUrls = Array.from(new Set(data.map((item) => item.imageUrl).filter(isString))).slice(
    0,
    12,
  );
  await Promise.allSettled(imageUrls.map((imageUrl) => cacheImage(imageUrl)));
}

async function cacheImage(imageUrl: string) {
  const sourceUrl = await normalizeExternalAssetUrl(imageUrl);
  const existing = await prisma.imageCache.findUnique({ where: { sourceUrl } });
  if (existing) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'KoalaNews/1.0' },
      signal: controller.signal,
      dispatcher: safeDispatcher,
    } as any);
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !response.body || !contentType.startsWith('image/')) return;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_IMAGE_BYTES) return;
      chunks.push(value);
    }

    const data = Buffer.concat(chunks);
    await prisma.imageCache.upsert({
      where: { sourceUrl },
      create: { sourceUrl, contentType, data },
      update: { contentType, data, fetchedAt: new Date() },
    });
  } finally {
    clearTimeout(timeout);
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
      'content:encoded': item['content:encoded'],
    })),
  };
}

async function upsertSourceFeed(url: string, language: FeedLanguage) {
  return prisma.sourceFeed.upsert({
    where: { url },
    create: { url, language },
    update: { language },
  });
}

export async function saveFeed(userId: string, url: string, languageInput: unknown = 'en') {
  const language = normalizeFeedLanguage(languageInput);
  const normalizedUrl = await normalizeFeedUrl(url);
  const sourceFeed = await upsertSourceFeed(normalizedUrl, language);
  const parsed = await fetchAndParseFeed(normalizedUrl);

  const feed = await prisma.feed.create({
    data: {
      url: normalizedUrl,
      title: parsed.title,
      description: parsed.description,
      language,
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
      language,
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
    await cacheArticleImages(articles);
  }

  return feed;
}

export async function ensureDefaultFeed(languageInput: unknown) {
  const language = normalizeFeedLanguage(languageInput);
  const defaultFeed = DEFAULT_FEEDS[language];
  const normalizedUrl = await normalizeFeedUrl(defaultFeed.url);
  const sourceFeed = await upsertSourceFeed(normalizedUrl, language);

  const articleCount = await prisma.article.count({ where: { sourceFeedId: sourceFeed.id } });
  const recentlyFetched =
    sourceFeed.lastFetchedAt && Date.now() - sourceFeed.lastFetchedAt.getTime() < 15 * 60_000;
  if (articleCount > 0 || recentlyFetched) return;

  const parsed = await fetchAndParseFeed(normalizedUrl);
  await prisma.sourceFeed.update({
    where: { id: sourceFeed.id },
    data: {
      title: parsed.title ?? defaultFeed.title,
      description: parsed.description,
      language,
      lastFetchedAt: new Date(),
    },
  });

  if (parsed.items.length > 0) {
    const articles = buildNewArticles(parsed.items, new Set(), sourceFeed.id);
    await createArticles(articles);
    await cacheArticleImages(articles);
  }
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
    const existingGuids = new Set(existing.map((a) => a.guid).filter(isString));

    const articles = buildNewArticles(parsed.items, existingGuids, sourceFeed.id);

    await createArticles(articles);
    await cacheArticleImages(articles);
  }
}
