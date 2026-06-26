import { fetchAndParseFeed, saveFeed, refreshFeed } from './rss';
import type { Mock } from 'vitest';

vi.mock('rss-parser');
vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]) },
  lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
}));

const mockPrisma = vi.hoisted(() => ({
  feed: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  sourceFeed: { upsert: vi.fn(), update: vi.fn() },
  article: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  imageCache: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

type ParserMock = { parseString: Mock };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<rss />')));
});

describe('fetchAndParseFeed', () => {
  it('parses an RSS feed URL and returns feed data', async () => {
    const result = await fetchAndParseFeed('https://example.com/feed.xml');
    expect(result.title).toBe('Test Feed');
    expect(result.description).toBe('A test RSS feed');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('Article 1');
    expect(result.items[0].guid).toBe('guid-1');
  });

  it('uses link as fallback when guid is missing', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseString.mockResolvedValueOnce({
      title: 'Feed',
      items: [{ title: 'No GUID', link: 'https://example.com/no-guid' }],
    });
    const result = await fetchAndParseFeed('https://example.com/feed2.xml');
    expect(result.items[0].guid).toBe('https://example.com/no-guid');
  });

  it('handles empty item lists', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseString.mockResolvedValueOnce({
      title: 'Empty Feed',
      items: [],
    });
    const result = await fetchAndParseFeed('https://example.com/empty.xml');
    expect(result.items).toHaveLength(0);
  });
});

describe('saveFeed', () => {
  const userId = 'user-1';
  const feedUrl = 'https://example.com/feed.xml';

  beforeEach(() => {
    mockPrisma.feed.create.mockResolvedValue({
      id: 'feed-1',
      url: feedUrl,
      title: 'Test Feed',
      description: 'A test RSS feed',
      userId,
      sourceFeedId: 'source-1',
    });
    mockPrisma.sourceFeed.upsert.mockResolvedValue({
      id: 'source-1',
      url: feedUrl,
      title: 'Test Feed',
    });
    mockPrisma.sourceFeed.update.mockResolvedValue({
      id: 'source-1',
      url: feedUrl,
      title: 'Test Feed',
    });
    mockPrisma.article.findMany.mockResolvedValue([]);
    mockPrisma.article.create.mockResolvedValue({});
    mockPrisma.article.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.imageCache.findUnique.mockResolvedValue({ sourceUrl: 'cached' });
  });

  it('creates a feed record', async () => {
    await saveFeed(userId, feedUrl);
    expect(mockPrisma.feed.create).toHaveBeenCalledWith({
      data: {
        url: feedUrl,
        title: 'Test Feed',
        description: 'A test RSS feed',
        language: 'en',
        userId,
        sourceFeedId: 'source-1',
        lastFetchedAt: expect.any(Date),
      },
    });
  });

  it('creates article records for each item', async () => {
    await saveFeed(userId, feedUrl);
    expect(mockPrisma.article.create).toHaveBeenCalledTimes(2);
    const args = mockPrisma.article.create.mock.calls[0][0];
    expect(args.data.title).toBe('Article 1');
  });

  it('skips items without guid and without link', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseString.mockResolvedValueOnce({
      title: 'Feed',
      items: [
        { title: 'Has guid', guid: 'g1', link: 'https://example.com/1' },
        { title: 'No guid or link' },
        { title: 'Only link', link: 'https://example.com/3' },
      ],
    });
    await saveFeed(userId, feedUrl);
    expect(mockPrisma.article.create).toHaveBeenCalledTimes(2);
  });
});

describe('refreshFeed', () => {
  const feedId = 'feed-1';

  beforeEach(() => {
    mockPrisma.feed.findUnique.mockResolvedValue({
      id: feedId,
      url: 'https://example.com/feed.xml',
      title: 'Test Feed',
      lastFetchedAt: null,
      sourceFeed: {
        id: 'source-1',
        url: 'https://example.com/feed.xml',
        title: 'Test Feed',
        lastFetchedAt: null,
      },
    });
    mockPrisma.sourceFeed.update.mockResolvedValue({
      id: 'source-1',
      url: 'https://example.com/feed.xml',
    });
    mockPrisma.feed.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.article.findMany.mockResolvedValue([]);
    mockPrisma.article.create.mockResolvedValue({});
    mockPrisma.article.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.imageCache.findUnique.mockResolvedValue({ sourceUrl: 'cached' });
  });

  it('updates feed metadata', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseString.mockResolvedValueOnce({
      title: 'Updated Title',
      description: 'Updated Description',
      items: [],
    });
    await refreshFeed(feedId);
    expect(mockPrisma.sourceFeed.update).toHaveBeenCalledWith({
      where: { id: 'source-1' },
      data: {
        title: 'Updated Title',
        description: 'Updated Description',
        language: 'en',
        lastFetchedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.feed.updateMany).toHaveBeenCalledWith({
      where: { sourceFeedId: 'source-1' },
      data: {
        title: 'Updated Title',
        description: 'Updated Description',
        language: 'en',
        lastFetchedAt: expect.any(Date),
      },
    });
  });

  it('creates new articles', async () => {
    await refreshFeed(feedId);
    expect(mockPrisma.article.create).toHaveBeenCalled();
  });

  it('throws if feed not found', async () => {
    mockPrisma.feed.findUnique.mockResolvedValue(null);
    await expect(refreshFeed('nonexistent')).rejects.toThrow('Feed not found');
  });
});
