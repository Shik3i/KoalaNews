import { jsonError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { normalizeExternalAssetUrl } from '@/lib/rss';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('src');
  if (!source) return jsonError('missing_source', 400);

  let sourceUrl: string;
  try {
    sourceUrl = await normalizeExternalAssetUrl(source);
  } catch {
    return jsonError('invalid_source', 400);
  }

  const cached = await prisma.imageCache.findUnique({ where: { sourceUrl } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return imageResponse(cached.data, cached.contentType);
  }

  const knownArticleImage = await prisma.article.findFirst({
    where: { imageUrl: sourceUrl },
    select: { id: true },
  });
  if (!knownArticleImage) return jsonError('not_found', 404);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'KoalaNews/1.0' },
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !response.body || !contentType.startsWith('image/')) {
      return jsonError('invalid_image', 422);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_IMAGE_BYTES) return jsonError('image_too_large', 422);
      chunks.push(value);
    }

    const data = Buffer.concat(chunks);
    await prisma.imageCache.upsert({
      where: { sourceUrl },
      create: { sourceUrl, contentType, data },
      update: { contentType, data, fetchedAt: new Date() },
    });
    return imageResponse(data, contentType);
  } catch {
    return jsonError('image_fetch_failed', 422);
  } finally {
    clearTimeout(timeout);
  }
}

function imageResponse(data: Uint8Array, contentType: string) {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
