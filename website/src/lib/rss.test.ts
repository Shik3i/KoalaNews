import { fetchAndParseFeed, saveFeed, refreshFeed } from './rss';
import type { Mock } from 'vitest';

vi.mock('rss-parser');

const mockPrisma = vi.hoisted(() => ({
  feed: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  article: { createMany: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

type ParserMock = { parseURL: Mock };

beforeEach(() => {
  vi.clearAllMocks();
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
    (new Parser() as unknown as ParserMock).parseURL.mockResolvedValueOnce({
      title: 'Feed',
      items: [{ title: 'No GUID', link: 'https://example.com/no-guid' }],
    });
    const result = await fetchAndParseFeed('https://example.com/feed2.xml');
    expect(result.items[0].guid).toBe('https://example.com/no-guid');
  });

  it('handles empty item lists', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseURL.mockResolvedValueOnce({
      title: 'Empty Feed', items: [],
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
      id: 'feed-1', url: feedUrl, title: 'Test Feed',
      description: 'A test RSS feed', userId,
    });
    mockPrisma.article.findMany.mockResolvedValue([]);
    mockPrisma.article.createMany.mockResolvedValue({ count: 2 });
  });

  it('creates a feed record', async () => {
    await saveFeed(userId, feedUrl);
    expect(mockPrisma.feed.create).toHaveBeenCalledWith({
      data: { url: feedUrl, title: 'Test Feed', description: 'A test RSS feed', userId },
    });
  });

  it('creates article records for each item', async () => {
    await saveFeed(userId, feedUrl);
    expect(mockPrisma.article.createMany).toHaveBeenCalled();
    const args = mockPrisma.article.createMany.mock.calls[0][0];
    expect(args.data).toHaveLength(2);
    expect(args.data[0].title).toBe('Article 1');
  });

  it('skips items without guid and without link', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseURL.mockResolvedValueOnce({
      title: 'Feed',
      items: [
        { title: 'Has guid', guid: 'g1', link: 'https://example.com/1' },
        { title: 'No guid or link' },
        { title: 'Only link', link: 'https://example.com/3' },
      ],
    });
    await saveFeed(userId, feedUrl);
    const args = mockPrisma.article.createMany.mock.calls[0][0];
    expect(args.data).toHaveLength(2);
  });
});

describe('refreshFeed', () => {
  const feedId = 'feed-1';

  beforeEach(() => {
    mockPrisma.feed.findUnique.mockResolvedValue({
      id: feedId, url: 'https://example.com/feed.xml', title: 'Test Feed',
    });
    mockPrisma.article.findMany.mockResolvedValue([]);
    mockPrisma.article.createMany.mockResolvedValue({ count: 1 });
  });

  it('updates feed metadata', async () => {
    const { default: Parser } = await import('rss-parser');
    (new Parser() as unknown as ParserMock).parseURL.mockResolvedValueOnce({
      title: 'Updated Title', description: 'Updated Description', items: [],
    });
    await refreshFeed(feedId);
    expect(mockPrisma.feed.update).toHaveBeenCalledWith({
      where: { id: feedId },
      data: { title: 'Updated Title', description: 'Updated Description' },
    });
  });

  it('creates new articles', async () => {
    await refreshFeed(feedId);
    expect(mockPrisma.article.createMany).toHaveBeenCalled();
  });

  it('throws if feed not found', async () => {
    mockPrisma.feed.findUnique.mockResolvedValue(null);
    await expect(refreshFeed('nonexistent')).rejects.toThrow('Feed not found');
  });
});
