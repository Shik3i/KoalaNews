const mockParseURL = vi.fn();
const defaultFeed = {
  title: 'Test Feed',
  description: 'A test RSS feed',
  items: [
    {
      title: 'Article 1',
      link: 'https://example.com/1',
      guid: 'guid-1',
      content: 'Full content 1',
      contentSnippet: 'Content snippet 1',
      pubDate: 'Mon, 15 Jan 2024 12:00:00 GMT',
      isoDate: '2024-01-15T12:00:00.000Z',
    },
    {
      title: 'Article 2',
      link: 'https://example.com/2',
      guid: 'guid-2',
      contentSnippet: 'Content snippet 2',
      pubDate: 'Tue, 16 Jan 2024 12:00:00 GMT',
      isoDate: '2024-01-16T12:00:00.000Z',
    },
  ],
};
mockParseURL.mockResolvedValue(defaultFeed);
const mockParseString = vi.fn();
mockParseString.mockResolvedValue(defaultFeed);

const mockInstance = { parseURL: mockParseURL, parseString: mockParseString };
const parserMock = vi.fn(function () {
  return mockInstance;
});

export default parserMock;
