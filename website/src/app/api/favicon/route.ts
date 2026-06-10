import { safeDispatcher } from '@/lib/rss';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response('Invalid protocol', { status: 400 });
    }

    const faviconUrl = `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(faviconUrl, {
        headers: { 'User-Agent': 'KoalaNews/1.0' },
        signal: controller.signal,
        dispatcher: safeDispatcher,
      } as any);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/x-icon';
        const buffer = await response.arrayBuffer();

        return new Response(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          },
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Ignore error and fall back to transparent icon
  }

  // Fallback 1x1 transparent PNG icon
  const fallbackIcon = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );

  return new Response(fallbackIcon, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
