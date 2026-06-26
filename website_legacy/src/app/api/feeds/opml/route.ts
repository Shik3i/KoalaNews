import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET = requireAuth(async (_request, userId) => {
  const feeds = await prisma.feed.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const outlines = feeds
    .map((feed) => {
      const text = escapeXml(feed.title ?? feed.url);
      const url = escapeXml(feed.url);
      return `    <outline text="${text}" title="${text}" type="rss" xmlUrl="${url}" />`;
    })
    .join('\n');

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>KoalaNews Feeds</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`;

  return new Response(opml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="koalanews-feeds.opml"',
    },
  });
});
