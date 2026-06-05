'use client';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import ArticleCard from '@/components/ArticleCard';
import ReaderModeModal from '@/components/ReaderModeModal';
import { DEFAULT_APPEARANCE, type AppearanceSettings } from '@/lib/appearance';

type Feed = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  language: string;
  categoryId: string | null;
  articles: Article[];
};

type Article = {
  id: string;
  title: string | null;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
  pubDate: string | null;
  read?: boolean;
};

type Category = {
  id: string;
  name: string;
};

type SmartFeed = {
  id: string;
  name: string;
  query: string;
  feedId: string | null;
};

export default function DashboardPage() {
  const { status } = useSession();
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();

  // Core Data State
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [smartFeeds, setSmartFeeds] = useState<SmartFeed[]>([]);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  // Filter & UI Selectors
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSmartFeedId, setSelectedSmartFeedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFeedTitle, setFilterFeedTitle] = useState('');

  // Form Input States
  const [feedUrl, setFeedUrl] = useState('');
  const [feedLanguage, setFeedLanguage] = useState(
    locale === 'de' || locale === 'fr' ? locale : 'en',
  );
  const [feedCategoryId, setFeedCategoryId] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSmartFeedName, setNewSmartFeedName] = useState('');

  // Interactive Feature States
  const [selectedArticleIndex, setSelectedArticleIndex] = useState<number | null>(null);
  const [selectedArticleIdsForBulk, setSelectedArticleIdsForBulk] = useState<Set<string>>(new Set());
  const [activeReaderArticle, setActiveReaderArticle] = useState<(Article & { feedTitle: string | null }) | null>(null);
  const [speakingArticleId, setSpeakingArticleId] = useState<string | null>(null);

  // Status & Feedback States
  const [adding, setAdding] = useState(false);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Helper translations fallback
  const getLabel = (key: string, fallback: string) => {
    return t.has(key) ? t(key) : fallback;
  };

  // TTS Setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/categories');
    if (res.ok) {
      setCategories(await res.json());
    }
  }, []);

  const fetchSmartFeeds = useCallback(async () => {
    const res = await fetch('/api/smart-feeds');
    if (res.ok) {
      setSmartFeeds(await res.json());
    }
  }, []);

  const fetchFeeds = useCallback(async (catId: string | null = null) => {
    setLoadingFeeds(true);
    setError('');
    let url = '/api/feeds?take=40';
    if (catId) {
      url += `&categoryId=${encodeURIComponent(catId)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      setError(t('loadError'));
      setLoadingFeeds(false);
      return;
    }
    const data = await res.json();
    setFeeds(data.items ?? []);
    setNextCursor(data.nextCursor ?? null);
    setLoadingFeeds(false);
  }, [t]);

  // Handle redirect if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Initial Load
  useEffect(() => {
    if (status === 'authenticated') {
      fetchFeeds(selectedCategoryId);
      fetchCategories();
      fetchSmartFeeds();

      fetch('/api/preferences')
        .then((res) => (res.ok ? res.json() : DEFAULT_APPEARANCE))
        .then((data) => setAppearance({ ...DEFAULT_APPEARANCE, ...data }))
        .catch(() => setAppearance(DEFAULT_APPEARANCE));
    }
  }, [status, fetchFeeds, fetchCategories, fetchSmartFeeds, selectedCategoryId]);

  async function loadMoreFeeds() {
    if (!nextCursor) return;
    setLoadingFeeds(true);
    let url = `/api/feeds?take=40&cursor=${encodeURIComponent(nextCursor)}`;
    if (selectedCategoryId) {
      url += `&categoryId=${encodeURIComponent(selectedCategoryId)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      setError(t('loadError'));
      setLoadingFeeds(false);
      return;
    }
    const data = await res.json();
    setFeeds((current) => [...current, ...(data.items ?? [])]);
    setNextCursor(data.nextCursor ?? null);
    setLoadingFeeds(false);
  }

  // Add category
  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setError('');
    setMessage('');
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      setNewCategoryName('');
      setMessage(getLabel('categoryAdded', 'Kategorie hinzugefügt.'));
      await fetchCategories();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? getLabel('categoryAddError', 'Fehler beim Erstellen der Kategorie.'));
    }
  }

  // Delete Category
  async function handleDeleteCategory(catId: string) {
    if (!window.confirm(getLabel('confirmDeleteCategory', 'Möchtest du diese Kategorie löschen? Die Feeds bleiben erhalten.'))) return;
    setError('');
    const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
    if (res.ok) {
      if (selectedCategoryId === catId) setSelectedCategoryId(null);
      await fetchCategories();
      await fetchFeeds(null);
    } else {
      setError(getLabel('categoryDeleteError', 'Kategorie konnte nicht gelöscht werden.'));
    }
  }

  // Add Feed
  async function addFeed(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: feedUrl,
        language: feedLanguage,
        categoryId: feedCategoryId || undefined,
      }),
    });

    if (res.ok) {
      setFeedUrl('');
      setFeedCategoryId('');
      setMessage(t('feedAdded'));
      await fetchFeeds(selectedCategoryId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t('fetchError'));
    }

    setAdding(false);
  }

  // Move Feed to Category
  async function moveFeedToCategory(feedId: string, catId: string | null) {
    setError('');
    const res = await fetch(`/api/feeds/${feedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: catId }),
    });
    if (res.ok) {
      await fetchFeeds(selectedCategoryId);
    } else {
      setError(getLabel('feedMoveError', 'Fehler beim Verschieben des Feeds.'));
    }
  }

  async function removeFeed(id: string) {
    if (!window.confirm(t('confirmRemove'))) return;
    setError('');
    setMessage('');
    const res = await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage(t('feedRemoved'));
      await fetchFeeds(selectedCategoryId);
    } else {
      setError(t('removeError'));
    }
  }

  async function refreshFeed(id: string) {
    setRefreshingId(id);
    setError('');
    setMessage('');
    const res = await fetch('/api/feeds/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedId: id }),
    });
    if (res.ok) {
      setMessage(t('refreshDone'));
    } else {
      setError(t('refreshError'));
    }
    setRefreshingId(null);
    await fetchFeeds(selectedCategoryId);
  }

  // Toggle single read status
  async function toggleArticleRead(articleId: string, currentRead: boolean) {
    const res = await fetch(`/api/articles/${articleId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: !currentRead }),
    });

    if (res.ok) {
      setFeeds((current) =>
        current.map((f) => ({
          ...f,
          articles: f.articles.map((a) =>
            a.id === articleId ? { ...a, read: !currentRead } : a,
          ),
        })),
      );
    }
  }

  async function markAllRead() {
    setError('');
    setMessage('');
    const res = await fetch('/api/articles/read-all', { method: 'POST' });
    if (res.ok) {
      setMessage(t('markedRead'));
      fetchFeeds(selectedCategoryId);
    } else {
      setError(t('markReadError'));
    }
  }

  // Bulk Read Action
  async function handleBulkRead(read: boolean) {
    if (selectedArticleIdsForBulk.size === 0) return;
    setError('');
    const idsArray = Array.from(selectedArticleIdsForBulk);
    const res = await fetch('/api/articles/bulk-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleIds: idsArray, read }),
    });

    if (res.ok) {
      setFeeds((current) =>
        current.map((f) => ({
          ...f,
          articles: f.articles.map((a) =>
            idsArray.includes(a.id) ? { ...a, read } : a,
          ),
        })),
      );
      setSelectedArticleIdsForBulk(new Set());
    } else {
      setError(getLabel('bulkError', 'Fehler bei der Massenbearbeitung.'));
    }
  }

  // Add Smart Feed
  async function handleAddSmartFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!newSmartFeedName.trim() || !searchQuery.trim()) return;
    setError('');
    setMessage('');
    const res = await fetch('/api/smart-feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newSmartFeedName.trim(),
        query: searchQuery.trim(),
        feedId: filterFeedTitle || null,
      }),
    });
    if (res.ok) {
      setNewSmartFeedName('');
      setMessage(getLabel('smartFeedAdded', 'Smart Feed gespeichert!'));
      await fetchSmartFeeds();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? getLabel('smartFeedAddError', 'Smart Feed konnte nicht gespeichert werden.'));
    }
  }

  // Delete Smart Feed
  async function handleDeleteSmartFeed(id: string) {
    setError('');
    const res = await fetch(`/api/smart-feeds/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (selectedSmartFeedId === id) setSelectedSmartFeedId(null);
      await fetchSmartFeeds();
    } else {
      setError(getLabel('smartFeedDeleteError', 'Fehler beim Löschen des Smart Feeds.'));
    }
  }

  // Toggle TTS Speaking
  function handleSpeak(article: Article, feedTitle: string | null) {
    if (!synthRef.current) return;

    if (speakingArticleId === article.id) {
      synthRef.current.cancel();
      setSpeakingArticleId(null);
      return;
    }

    synthRef.current.cancel();
    const text = `${article.title}. Quelle: ${feedTitle ?? ''}. ${article.description ? article.description.replace(/<[^>]*>/g, '') : ''}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US';
    
    utterance.onend = () => setSpeakingArticleId(null);
    utterance.onerror = () => setSpeakingArticleId(null);

    setSpeakingArticleId(article.id);
    synthRef.current.speak(utterance);
  }

  // Gather and Filter Articles
  const getFilteredArticles = useCallback(() => {
    let list: (Article & { feedTitle: string | null })[] = [];
    feeds.forEach((feed) => {
      feed.articles.forEach((art) => {
        list.push({ ...art, feedTitle: feed.title || feed.url });
      });
    });

    // Remove duplicates by ID
    const seen = new Set<string>();
    list = list.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    // Apply Smart Feed Filter OR Manual Filters
    if (selectedSmartFeedId) {
      const sf = smartFeeds.find((s) => s.id === selectedSmartFeedId);
      if (sf) {
        list = list.filter((a) => {
          const matchesQuery =
            !sf.query ||
            (a.title?.toLowerCase().includes(sf.query.toLowerCase()) ?? false) ||
            (a.description?.toLowerCase().includes(sf.query.toLowerCase()) ?? false);
          const matchesFeed = !sf.feedId || a.feedTitle?.toLowerCase().includes(sf.feedId.toLowerCase());
          return matchesQuery && matchesFeed;
        });
      }
    } else {
      // Manual query / feed filters
      if (searchQuery.trim()) {
        // Optimised search: multi-word support
        const words = searchQuery.toLowerCase().trim().split(/\s+/);
        list = list.filter((a) => {
          const text = `${a.title ?? ''} ${a.description ?? ''}`.toLowerCase();
          return words.every((word) => text.includes(word));
        });
      }
      if (filterFeedTitle.trim()) {
        list = list.filter((a) =>
          a.feedTitle?.toLowerCase().includes(filterFeedTitle.toLowerCase()),
        );
      }
    }

    // Sort by Date
    return list.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [feeds, selectedSmartFeedId, smartFeeds, searchQuery, filterFeedTitle]);

  const filteredArticles = getFilteredArticles();

  // Keyboard Navigation Effect
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (filteredArticles.length === 0) return;

      if (e.key === 'j') {
        e.preventDefault();
        setSelectedArticleIndex((current) => {
          if (current === null) return 0;
          return Math.min(filteredArticles.length - 1, current + 1);
        });
      } else if (e.key === 'k') {
        e.preventDefault();
        setSelectedArticleIndex((current) => {
          if (current === null) return 0;
          return Math.max(0, current - 1);
        });
      } else if (e.key === 'm') {
        e.preventDefault();
        if (selectedArticleIndex !== null) {
          const article = filteredArticles[selectedArticleIndex];
          toggleArticleRead(article.id, article.read ?? false);
        }
      } else if (e.key === 'o' || e.key === 'Enter') {
        e.preventDefault();
        if (selectedArticleIndex !== null) {
          const article = filteredArticles[selectedArticleIndex];
          if (article.link) window.open(article.link, '_blank');
        }
      } else if (e.key === 'v') {
        e.preventDefault();
        if (selectedArticleIndex !== null) {
          const article = filteredArticles[selectedArticleIndex];
          setActiveReaderArticle(article);
        }
      } else if (e.key === 'r') {
        e.preventDefault();
        fetchFeeds(selectedCategoryId);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredArticles, selectedArticleIndex, selectedCategoryId, fetchFeeds]);

  // Auto Scroll to keyboard selected item
  useEffect(() => {
    if (selectedArticleIndex !== null) {
      const el = document.getElementById(`article-card-${selectedArticleIndex}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedArticleIndex]);

  // Bulk selection toggler
  function toggleBulkSelection(articleId: string) {
    setSelectedArticleIdsForBulk((current) => {
      const next = new Set(current);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  }

  function selectAllArticlesForBulk() {
    const allIds = filteredArticles.map((a) => a.id);
    setSelectedArticleIdsForBulk(new Set(allIds));
  }

  if (status === 'loading') {
    return <p className="text-gray-400 text-center py-12">{t('loading', { ns: 'common' })}</p>;
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {/* Sidebar Controls */}
      <aside className="space-y-6">
        {/* Categories / Folders section */}
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            {getLabel('folders', 'Ordner')}
          </h2>

          <div className="space-y-1">
            <button
              onClick={() => {
                setSelectedCategoryId(null);
                setSelectedSmartFeedId(null);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                !selectedCategoryId && !selectedSmartFeedId
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900'
              }`}
            >
              <span>📁 {getLabel('allFeeds', 'Alle Feeds')}</span>
              <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded">
                {feeds.length}
              </span>
            </button>

            {categories.map((cat) => {
              const count = feeds.filter((f) => f.categoryId === cat.id).length;
              return (
                <div key={cat.id} className="group flex items-center justify-between rounded-xl hover:bg-gray-50 dark:hover:bg-slate-900">
                  <button
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedSmartFeedId(null);
                    }}
                    className={`flex-1 text-left rounded-xl px-3 py-2 text-sm font-medium transition ${
                      selectedCategoryId === cat.id
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    📂 {cat.name}
                  </button>
                  <span className="text-xs text-gray-400 px-2 group-hover:hidden">{count}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="hidden text-xs text-red-500 hover:text-red-700 px-2 group-hover:block transition"
                    title="Löschen"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddCategory} className="mt-4 flex gap-1">
            <input
              type="text"
              placeholder={getLabel('newFolder', 'Neuer Ordner...')}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              +
            </button>
          </form>
        </section>

        {/* Smart Feeds section */}
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            🔍 {getLabel('smartFeeds', 'Smart Feeds')}
          </h2>

          {smartFeeds.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Noch keine gespeicherten Suchen.</p>
          ) : (
            <div className="space-y-1">
              {smartFeeds.map((sf) => (
                <div key={sf.id} className="group flex items-center justify-between rounded-xl hover:bg-gray-50 dark:hover:bg-slate-900">
                  <button
                    onClick={() => {
                      setSelectedSmartFeedId(sf.id);
                      setSelectedCategoryId(null);
                      setSearchQuery(sf.query);
                      setFilterFeedTitle(sf.feedId ?? '');
                    }}
                    className={`flex-1 text-left rounded-xl px-3 py-2 text-sm font-medium transition ${
                      selectedSmartFeedId === sf.id
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    ✨ {sf.name}
                  </button>
                  <button
                    onClick={() => handleDeleteSmartFeed(sf.id)}
                    className="hidden text-xs text-red-500 hover:text-red-700 px-2 group-hover:block transition"
                    title="Löschen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Help box */}
        <section className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-slate-900/40">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">⌨️ Shortcuts</h3>
          <p className="text-xs leading-relaxed text-gray-400">
            {getLabel('keyboardHelp', 'J/K: Navigieren • M: Gelesen toggeln • O: Im Tab öffnen • V: Lese-Modus • R: Update')}
          </p>
        </section>
      </aside>

      {/* Main Workspace */}
      <main className="space-y-6">
        {message && (
          <p className="text-green-600 text-sm mb-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 dark:bg-green-950/30 dark:border-green-800">
            {message}
          </p>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 dark:bg-red-950/30 dark:border-red-800">
            {error}
          </p>
        )}

        {/* Feed creation Section */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-950">
          <span className="absolute -top-2.5 left-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white dark:bg-slate-950">
            {t('addFeed')}
          </span>

          <form onSubmit={addFeed} className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] mt-2">
            <input
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              required
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
            />
            <select
              value={feedLanguage}
              onChange={(e) => setFeedLanguage(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
              aria-label={t('feedLanguage')}
            >
              <option value="de">🇩🇪 Deutsch</option>
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Francais</option>
            </select>
            <select
              value={feedCategoryId}
              onChange={(e) => setFeedCategoryId(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
              aria-label="Kategorie auswählen"
            >
              <option value="">-- {getLabel('noCategory', 'Kein Ordner')} --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  📂 {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={adding}
              className="rounded-xl bg-blue-600 px-4 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {adding ? t('refreshing') : t('addButton')}
            </button>
          </form>
        </div>

        {/* Dynamic Toolbar for Search, Filters, and Bulk Actions */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-950">
          <span className="absolute -top-2.5 left-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white dark:bg-slate-950">
            {selectedSmartFeedId
              ? `✨ ${smartFeeds.find((sf) => sf.id === selectedSmartFeedId)?.name || t('title')}`
              : selectedCategoryId
                ? `📂 ${categories.find((c) => c.id === selectedCategoryId)?.name || t('title')}`
                : `📰 ${t('title')}`}
          </span>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-2">
            {/* Search inputs */}
            <div className="flex flex-row items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Artikel durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedSmartFeedId(null);
                  }}
                  className="w-[180px] rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-2.5 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
                />
                <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">🔍</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Quelle filtern..."
                  value={filterFeedTitle}
                  onChange={(e) => {
                    setFilterFeedTitle(e.target.value);
                    setSelectedSmartFeedId(null);
                  }}
                  list="dashboard-feed-sources"
                  className="w-[150px] rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-2.5 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
                />
                <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">📰</span>
                <datalist id="dashboard-feed-sources">
                  {Array.from(new Set(feeds.map((f) => f.title || f.url).filter(Boolean))).map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
              </div>

              {searchQuery && !selectedSmartFeedId && (
                <form onSubmit={handleAddSmartFeed} className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Name..."
                    value={newSmartFeedName}
                    onChange={(e) => setNewSmartFeedName(e.target.value)}
                    required
                    className="w-[100px] rounded-xl border border-gray-200 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-slate-900 dark:text-[var(--page-fg)]"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition"
                  >
                    Sichern
                  </button>
                </form>
              )}
            </div>

            {/* Sync and global read triggers */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={markAllRead}
                className="rounded-xl border border-gray-200 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-slate-800 transition"
              >
                ✓ Gelesen
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/feeds/opml"
                className="rounded-xl border border-gray-200 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-slate-800 transition"
              >
                📤 OPML
              </a>
            </div>
          </div>

          {/* Bulk Action Panel (appears when articles are selected) */}
          {selectedArticleIdsForBulk.size > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50/70 p-2 text-xs dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
              <div className="font-semibold text-blue-800 dark:text-blue-300">
                {selectedArticleIdsForBulk.size} ausgewählt
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkRead(true)}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Als gelesen markieren
                </button>
                <button
                  onClick={() => handleBulkRead(false)}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300"
                >
                  Als ungelesen markieren
                </button>
                <button
                  onClick={() => setSelectedArticleIdsForBulk(new Set())}
                  className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subscribed feeds list */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-950">
          <span className="absolute -top-2.5 left-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white dark:bg-slate-950">
            {t('myFeeds')}
          </span>

          {loadingFeeds && feeds.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 bg-gray-100 rounded-2xl animate-pulse dark:bg-slate-900" />
              ))}
            </div>
          ) : feeds.length === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('noFeeds')}</p>
          ) : (
            <div className="space-y-3">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-100 bg-gray-50/30 p-4 rounded-2xl dark:border-gray-800 dark:bg-slate-900/30 hover:border-gray-200 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate text-gray-900 dark:text-white">
                        {feed.title || feed.url}
                      </p>
                      <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {feed.language === 'de' ? '🇩🇪 DE' : feed.language === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{feed.url}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Category assign dropdown */}
                    <select
                      value={feed.categoryId || ''}
                      onChange={(e) => moveFeedToCategory(feed.id, e.target.value || null)}
                      className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-xs outline-none dark:border-gray-800 dark:bg-slate-900"
                    >
                      <option value="">Kein Ordner</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => refreshFeed(feed.id)}
                      disabled={refreshingId === feed.id}
                      className="rounded-xl bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/20 dark:text-blue-400"
                    >
                      {refreshingId === feed.id ? t('refreshing') : t('refresh')}
                    </button>
                    <button
                      onClick={() => removeFeed(feed.id)}
                      className="rounded-xl bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400"
                    >
                      {t('remove')}
                    </button>
                  </div>
                </div>
              ))}
              {nextCursor && (
                <button
                  onClick={loadMoreFeeds}
                  disabled={loadingFeeds}
                  className="w-full border border-gray-200 dark:border-gray-800 rounded-2xl px-3 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition"
                >
                  {loadingFeeds ? t('loadingMore') : t('loadMore')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Articles List section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{t('myArticles')}</h2>
            <button
              onClick={selectAllArticlesForBulk}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Alle für Massenaktion auswählen
            </button>
          </div>

          {filteredArticles.length === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('noArticles')}</p>
          ) : (
            <div className="space-y-3">
              {filteredArticles.map((article, idx) => (
                <div key={article.id} id={`article-card-${idx}`}>
                  <ArticleCard
                    id={article.id}
                    title={article.title}
                    description={article.description}
                    link={article.link}
                    imageUrl={article.imageUrl}
                    feedTitle={article.feedTitle}
                    pubDate={article.pubDate ? new Date(article.pubDate) : null}
                    locale={locale}
                    readMoreLabel="Read more"
                    fromFeedLabel="Source"
                    publishedAtLabel="Published"
                    appearance={appearance}
                    read={article.read}
                    onToggleRead={() => toggleArticleRead(article.id, article.read ?? false)}
                    onOpenReaderMode={() => setActiveReaderArticle(article)}
                    isSelected={selectedArticleIndex === idx}
                    showBulkCheckbox={true}
                    selectedForBulk={selectedArticleIdsForBulk.has(article.id)}
                    onToggleBulk={() => toggleBulkSelection(article.id)}
                    isSpeaking={speakingArticleId === article.id}
                    onSpeak={() => handleSpeak(article, article.feedTitle)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Reader Mode Overlay modal */}
      {activeReaderArticle && (
        <ReaderModeModal
          isOpen={true}
          onClose={() => setActiveReaderArticle(null)}
          title={activeReaderArticle.title}
          description={activeReaderArticle.description}
          content={activeReaderArticle.description}
          feedTitle={activeReaderArticle.feedTitle}
          pubDate={activeReaderArticle.pubDate ? new Date(activeReaderArticle.pubDate) : null}
          locale={locale}
          link={activeReaderArticle.link}
        />
      )}
    </div>
  );
}
