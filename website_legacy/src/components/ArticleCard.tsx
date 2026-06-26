'use client';

import { useState, useRef } from 'react';
import { DEFAULT_APPEARANCE, type AppearanceSettings } from '@/lib/appearance';
import { useAppearance } from './AppearanceProvider';

type ArticleCardProps = {
  id?: string;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  feedTitle?: string | null;
  feedUrl?: string | null;
  pubDate?: Date | null;
  locale: string;
  readMoreLabel: string;
  fromFeedLabel: string;
  publishedAtLabel: string;
  appearance?: Partial<AppearanceSettings>;
  read?: boolean;
  onToggleRead?: () => void;
  onOpenReaderMode?: () => void;
  isSelected?: boolean;
  selectedForBulk?: boolean;
  onToggleBulk?: () => void;
  showBulkCheckbox?: boolean;
  isSpeaking?: boolean;
  onSpeak?: () => void;
};

export default function ArticleCard({
  id: _id,
  title,
  description,
  link,
  imageUrl,
  feedTitle,
  feedUrl,
  pubDate,
  locale,
  readMoreLabel,
  fromFeedLabel,
  publishedAtLabel,
  appearance,
  read = false,
  onToggleRead,
  onOpenReaderMode,
  isSelected = false,
  selectedForBulk = false,
  onToggleBulk,
  showBulkCheckbox = false,
  isSpeaking = false,
  onSpeak,
}: ArticleCardProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 10) {
        if (e.cancelable) {
          e.preventDefault();
        }
        let offset = diffX * 0.8;
        if (offset > 120) offset = 120 + (offset - 120) * 0.2;
        if (offset < -120) offset = -120 + (offset + 120) * 0.2;
        setSwipeOffset(offset);
      }
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 80 && onOpenReaderMode) {
      onOpenReaderMode();
    } else if (swipeOffset < -80 && onToggleRead) {
      onToggleRead();
    }
    setSwipeOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
  };
  const contextAppearance = useAppearance();
  const settings = { ...DEFAULT_APPEARANCE, ...contextAppearance, ...appearance };
  const safeLocale = ['en', 'de', 'fr'].includes(locale) ? locale : 'en';
  const safeLink = getSafeExternalLink(link);
  const proxiedImage = settings.showImages ? getProxiedImageUrl(imageUrl) : null;
  const imageLoading =
    imageUrl?.startsWith('/') || imageUrl?.startsWith('data:image/') ? 'eager' : 'lazy';
  const isHeadline = settings.cardStyle === 'headline';
  const isCompact = settings.cardStyle === 'compact' || settings.cardStyle === 'dense';
  const showDescription =
    settings.showDescription && !isHeadline && description && settings.descriptionLines > 0;

  const articleClass = [
    'article-card border border-gray-200 dark:border-gray-800 relative overflow-hidden bg-gray-50 dark:bg-gray-900',
    settings.cardStyle === 'minimal' ? 'rounded' : 'rounded-lg hover:shadow-sm',
    settings.design === 'terminal' ? 'font-mono' : '',
    isSelected ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.01]' : '',
    read ? 'opacity-60' : '',
  ].join(' ');

  const innerClass = [
    'w-full relative z-10 transition-transform duration-200 select-none',
    settings.design === 'glassmorphism'
      ? 'bg-white/10 dark:bg-slate-900/20 backdrop-blur-md'
      : settings.design === 'retrowave'
        ? 'bg-transparent'
        : settings.design === 'terminal'
          ? 'bg-[#020617] text-[#bbf7d0]'
          : settings.design === 'newspaper' || settings.design === 'high-contrast'
            ? 'bg-white text-black'
            : 'bg-white dark:bg-gray-950',
    settings.cardStyle === 'minimal'
      ? 'p-4'
      : settings.cardStyle === 'dense' || settings.density === 'dense'
        ? 'p-3'
        : 'p-5',
  ].join(' ');

  const titleClass = isHeadline || isCompact ? 'text-base font-semibold' : 'text-lg font-semibold';

  return (
    <article
      className={articleClass}
      data-card-style={settings.cardStyle}
      data-design={settings.design}
      data-accent={settings.accentColor}
      data-font-scale={settings.fontScale}
      data-density={settings.density}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background action overlays */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-0">
        {/* Swipe Right: Lese-Modus (Green) */}
        <div
          className="absolute inset-y-0 left-0 flex items-center px-4 bg-emerald-600 text-white rounded-l-lg transition-opacity duration-150"
          style={{
            width: `${Math.max(0, swipeOffset)}px`,
            opacity: swipeOffset > 20 ? 1 : 0,
          }}
        >
          <span className="text-xs font-bold whitespace-nowrap">📖 Lese-Modus</span>
        </div>

        {/* Swipe Left: Mark Read/Unread (Blue) */}
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-blue-600 text-white rounded-r-lg transition-opacity duration-150"
          style={{
            width: `${Math.max(0, -swipeOffset)}px`,
            opacity: swipeOffset < -20 ? 1 : 0,
          }}
        >
          <span className="text-xs font-bold whitespace-nowrap">
            ✓ {read ? 'Ungelesen' : 'Gelesen'}
          </span>
        </div>
      </div>

      {/* Main card body that translates */}
      <div
        className={innerClass}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        <div className="flex gap-3 items-start">
          {showBulkCheckbox && (
            <input
              type="checkbox"
              checked={selectedForBulk}
              onChange={onToggleBulk}
              className="mt-1.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
              aria-label="Bulk auswählen"
            />
          )}
          <div className="flex-1 min-w-0">
            <div
              className={proxiedImage && !isCompact ? 'grid gap-4 sm:grid-cols-[160px_1fr]' : ''}
            >
              {proxiedImage && !isHeadline && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxiedImage}
                  alt=""
                  loading={imageLoading}
                  referrerPolicy="no-referrer"
                  className={
                    isCompact
                      ? 'mb-3 h-28 w-full rounded object-cover'
                      : 'h-36 w-full rounded object-cover sm:h-full'
                  }
                />
              )}

              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className={`${titleClass} mb-1 flex-1`}>
                    {safeLink ? (
                      <a
                        href={safeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
                        onClick={() => onToggleRead?.()}
                      >
                        {title ?? 'Untitled'}
                      </a>
                    ) : (
                      (title ?? 'Untitled')
                    )}
                  </h2>

                  <div className="flex gap-1.5 shrink-0">
                    {onSpeak && (
                      <button
                        onClick={onSpeak}
                        className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400 transition ${isSpeaking ? 'text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950/30' : ''}`}
                        title={isSpeaking ? 'Vorlesen stoppen' : 'Vorlesen'}
                        aria-label="Vorlesen"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
                          />
                        </svg>
                      </button>
                    )}
                    {onOpenReaderMode && (
                      <button
                        onClick={onOpenReaderMode}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400 transition"
                        title="Lese-Modus"
                        aria-label="Lese-Modus"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                          />
                        </svg>
                      </button>
                    )}
                    {onToggleRead && (
                      <button
                        onClick={onToggleRead}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400 transition"
                        title={read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                        aria-label={read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                      >
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${read ? 'bg-gray-300 dark:bg-gray-700' : 'bg-blue-600'}`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {showDescription && (
                  <p
                    className="text-gray-600 text-sm mt-1 dark:text-gray-300"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: settings.descriptionLines,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {description}
                  </p>
                )}

                {(settings.showSource || settings.showDate) && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
                    {settings.showSource && feedTitle && (
                      <span className="flex items-center gap-1.5">
                        {feedUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/favicon?url=${encodeURIComponent(feedUrl)}`}
                            alt=""
                            className="w-3.5 h-3.5 object-contain rounded-sm"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span>
                          {fromFeedLabel}: {feedTitle}
                        </span>
                      </span>
                    )}
                    {settings.showDate && pubDate && (
                      <span>
                        {publishedAtLabel}:{' '}
                        {pubDate.toLocaleString(safeLocale, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                )}

                {settings.showReadMore && safeLink && settings.cardStyle !== 'headline' && (
                  <a
                    href={safeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300"
                    onClick={() => onToggleRead?.()}
                  >
                    {readMoreLabel} &rarr;
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function getSafeExternalLink(link?: string | null) {
  if (!link) return null;
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function getProxiedImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/') || imageUrl.startsWith('data:image/')) return imageUrl;
  try {
    const url = new URL(imageUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return `/api/image?src=${encodeURIComponent(url.href)}`;
  } catch {
    return null;
  }
}
