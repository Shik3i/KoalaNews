export type Article = {
  id: string;
  title: string | null;
  link: string | null;
  description: string | null;
  content: string | null;
  image_url: string | null;
  pub_date: string | null;
  guid: string | null;
  source_feed_id: string | null;
  created_at: string;
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export type Feed = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  language: string;
  created_at: string;
};

export function listArticles(
  opts: { lang?: string; scope?: 'public'; limit?: number; offset?: number } = {},
): Promise<Article[]> {
  const q = new URLSearchParams();
  if (opts.lang) q.set('lang', opts.lang);
  if (opts.scope) q.set('scope', opts.scope);
  q.set('limit', String(opts.limit ?? 30));
  q.set('offset', String(opts.offset ?? 0));
  return getJSON<Article[]>(`/api/articles?${q}`);
}

export function listFeeds(): Promise<Feed[]> {
  return getJSON<Feed[]>('/api/feeds');
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${method} ${path} → ${res.status}`);
  return data as T;
}

export function addFeed(url: string, language: string): Promise<Feed> {
  return send<Feed>('POST', '/api/feeds', { url, language });
}

export function deleteFeed(id: string): Promise<{ status: string }> {
  return send('DELETE', `/api/feeds/${id}`);
}
