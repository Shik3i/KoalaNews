'use client';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import ArticleCard from '@/components/ArticleCard';

type Feed = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  articles: Article[];
};

type Article = {
  id: string;
  title: string | null;
  description: string | null;
  link: string | null;
  pubDate: string | null;
};

export default function DashboardPage() {
  const { status } = useSession();
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchFeeds();
    }
  }, [status]);

  async function fetchFeeds() {
    const res = await fetch('/api/feeds');
    if (res.ok) {
      const data = await res.json();
      setFeeds(data);
    }
  }

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');

    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: feedUrl }),
    });

    if (res.ok) {
      setFeedUrl('');
      await fetchFeeds();
    } else {
      const data = await res.json();
      setError(data.error ?? t('fetchError'));
    }

    setAdding(false);
  }

  async function removeFeed(id: string) {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    await fetchFeeds();
  }

  async function refreshFeed(id: string) {
    setRefreshingId(id);
    await fetch('/api/feeds/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedId: id }),
    });
    setRefreshingId(null);
    await fetchFeeds();
  }

  if (status === 'loading') {
    return <p className="text-gray-400 text-center py-12">{t('loading', { ns: 'common' })}</p>;
  }

  if (status === 'unauthenticated') return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">{t('myFeeds')}</h2>

        <form onSubmit={addFeed} className="flex gap-2 mb-4">
          <input
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            required
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {adding ? t('refreshing') : t('addButton')}
          </button>
        </form>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        {feeds.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noFeeds')}</p>
        ) : (
          <div className="space-y-2">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="bg-white border border-gray-200 rounded p-4 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {feed.title || feed.url}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{feed.url}</p>
                  <p className="text-xs text-gray-400">
                    {feed.articles.length} articles
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => refreshFeed(feed.id)}
                    disabled={refreshingId === feed.id}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    {refreshingId === feed.id ? t('refreshing') : t('refresh')}
                  </button>
                  <button
                    onClick={() => removeFeed(feed.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    {t('remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t('myArticles')}</h2>

        {feeds.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noArticles')}</p>
        ) : (
          <div className="space-y-3">
            {feeds.flatMap((feed) =>
              feed.articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  title={article.title}
                  description={article.description}
                  link={article.link}
                  feedTitle={feed.title}
                  pubDate={article.pubDate ? new Date(article.pubDate) : null}
                  locale={locale}
                  readMoreLabel="Read more"
                  fromFeedLabel="Source"
                  publishedAtLabel="Published"
                />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
