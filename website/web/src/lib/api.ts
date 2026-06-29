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
  read: boolean;
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
  custom_title: string | null;
  description: string | null;
  language: string;
  category_id: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type SmartFeed = {
  id: string;
  name: string;
  query: string;
  feed_ids: string[];
  created_at: string;
};

export function listArticles(
  opts: {
    lang?: string;
    scope?: 'public';
    category?: string;
    smartFeed?: string;
    feedId?: string;
    feeds?: string[];
    q?: string;
    unread?: boolean;
    sort?: 'newest' | 'oldest' | 'title' | 'source';
    limit?: number;
    offset?: number;
  } = {},
): Promise<Article[]> {
  const q = new URLSearchParams();
  if (opts.lang) q.set('lang', opts.lang);
  if (opts.scope) q.set('scope', opts.scope);
  if (opts.category) q.set('category', opts.category);
  if (opts.smartFeed) q.set('smartFeed', opts.smartFeed);
  if (opts.feedId) q.set('feed', opts.feedId);
  if (opts.feeds?.length) q.set('feeds', opts.feeds.join(','));
  if (opts.q) q.set('q', opts.q);
  if (opts.unread) q.set('unread', '1');
  if (opts.sort) q.set('sort', opts.sort);
  q.set('limit', String(opts.limit ?? 30));
  q.set('offset', String(opts.offset ?? 0));
  return getJSON<Article[]>(`/api/articles?${q}`);
}

export function listFeeds(): Promise<Feed[]> {
  return getJSON<Feed[]>('/api/feeds');
}

export function markRead(id: string): Promise<{ status: string }> {
  return send('POST', `/api/articles/${id}/read`);
}

export function markUnread(id: string): Promise<{ status: string }> {
  return send('DELETE', `/api/articles/${id}/read`);
}

export function markAllRead(): Promise<{ status: string }> {
  return send('POST', '/api/articles/read-all');
}

export function listCategories(): Promise<Category[]> {
  return getJSON<Category[]>('/api/categories');
}

export function createCategory(name: string): Promise<Category> {
  return send<Category>('POST', '/api/categories', { name });
}

export function renameCategory(id: string, name: string): Promise<{ status: string }> {
  return send('PATCH', `/api/categories/${id}`, { name });
}

export function deleteCategory(id: string): Promise<{ status: string }> {
  return send('DELETE', `/api/categories/${id}`);
}

export function setFeedCategory(
  feedId: string,
  categoryId: string | null,
): Promise<{ status: string }> {
  return send('PATCH', `/api/feeds/${feedId}/category`, { category_id: categoryId });
}

export function renameFeed(id: string, title: string): Promise<{ status: string }> {
  return send('PATCH', `/api/feeds/${id}/title`, { title });
}

export type Statistics = {
  users: number;
  feeds: number;
  articles: number;
  topFeeds: {
    title: string | null;
    custom_title?: string | null;
    url: string;
    language: string;
    articleCount: number;
  }[];
};

export function getStatistics(): Promise<Statistics> {
  return getJSON<Statistics>('/api/statistics');
}

export function listSmartFeeds(): Promise<SmartFeed[]> {
  return getJSON<SmartFeed[]>('/api/smart-feeds');
}

export function createSmartFeed(
  name: string,
  query: string,
  feedIds: string[],
): Promise<SmartFeed> {
  return send<SmartFeed>('POST', '/api/smart-feeds', { name, query, feed_ids: feedIds });
}

export function deleteSmartFeed(id: string): Promise<{ status: string }> {
  return send('DELETE', `/api/smart-feeds/${id}`);
}

export type OPMLImportResult = { added: number; skipped: number; failed: number; total: number };

export async function importOPML(content: string, language?: string): Promise<OPMLImportResult> {
  const path = language
    ? `/api/feeds/opml/import?${new URLSearchParams({ lang: language })}`
    : '/api/feeds/opml/import';
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'text/x-opml' },
    body: content,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Import failed (${res.status})`);
  return data as OPMLImportResult;
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

export type FeedCandidate = {
  url: string;
  title: string;
  description: string;
};

export async function discoverFeeds(url: string): Promise<FeedCandidate[]> {
  const r = await send<{ candidates: FeedCandidate[] }>('POST', '/api/feeds/discover', { url });
  return r.candidates;
}

export async function refreshFeed(id: string): Promise<{ status: string; added: number; feed: Feed }> {
  return send('POST', `/api/feeds/${id}/refresh`);
}

export function deleteFeed(id: string): Promise<{ status: string }> {
  return send('DELETE', `/api/feeds/${id}`);
}

export type Account = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  hasPassword: boolean;
};

export function getAccount(): Promise<Account> {
  return getJSON<Account>('/api/account');
}

export function updateAccount(patch: { name: string; email: string }): Promise<Account> {
  return send<Account>('PATCH', '/api/account', patch);
}

export function updatePassword(patch: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ status: string }> {
  return send('PATCH', '/api/account/password', patch);
}

export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  banned: boolean;
  bannedReason: string | null;
  createdAt: string;
};

export type AdminStats = {
  users: number;
  feeds: number;
  sourceFeeds: number;
  articles: number;
  dbBytes: number;
};

export function adminStats(): Promise<AdminStats> {
  return getJSON<AdminStats>('/api/admin/stats');
}

export type Backup = {
  name: string;
  kind: 'daily' | 'weekly' | 'monthly';
  sizeBytes: number;
  createdAt: string;
};

export async function listBackups(): Promise<Backup[]> {
  const r = await getJSON<{ backups: Backup[] }>('/api/admin/backups');
  return r.backups;
}

export async function createBackup(): Promise<Backup[]> {
  const r = await send<{ backups: Backup[] }>('POST', '/api/admin/backups');
  return r.backups;
}

export function adminListUsers(): Promise<AdminUser[]> {
  return getJSON<AdminUser[]>('/api/admin/users');
}

export function adminUpdateUser(
  id: string,
  patch: { role?: string; banned?: boolean; bannedReason?: string },
): Promise<{ status: string }> {
  return send('PATCH', `/api/admin/users/${id}`, patch);
}
