'use client';

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';

type ReaderModeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string | null;
  description: string | null;
  content: string | null;
  feedTitle: string | null;
  pubDate: Date | null;
  locale: string;
  link?: string | null;
};

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  const decoded = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(decoded, 'text/html');
      return doc.documentElement.textContent || decoded;
    } catch {
      // ignore
    }
  }
  return decoded;
}

export default function ReaderModeModal({
  isOpen,
  onClose,
  title,
  description,
  content,
  feedTitle,
  pubDate,
  locale,
  link,
}: ReaderModeModalProps) {
  const [fontSize, setFontSize] = useState(16); // in pixels
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      stopSpeech();
    };
  }, []);

  // Handle escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanDescription = description
    ? decodeHtmlEntities(description.replace(/<[^>]*>/g, ''))
    : '';
  const cleanContent = content ? decodeHtmlEntities(content.replace(/<[^>]*>/g, '')) : '';

  const textToRead = [
    title ? decodeHtmlEntities(title) : '',
    feedTitle ? `Quelle: ${decodeHtmlEntities(feedTitle)}` : '',
    cleanDescription,
    cleanContent,
  ]
    .filter(Boolean)
    .join('. ');

  function startSpeech() {
    if (!synthRef.current) return;
    synthRef.current.cancel(); // cancel any active speech

    const utterance = new SpeechSynthesisUtterance(textToRead);
    // detect language or fallback
    utterance.lang = locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US';

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    setIsPaused(false);
    synthRef.current.speak(utterance);
  }

  function pauseSpeech() {
    if (!synthRef.current) return;
    synthRef.current.pause();
    setIsPaused(true);
  }

  function resumeSpeech() {
    if (!synthRef.current) return;
    synthRef.current.resume();
    setIsPaused(false);
  }

  function stopSpeech() {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-slate-950/80">
      <div
        className="flex h-full max-h-[85vh] w-full max-w-3xl flex-col rounded-[2rem] border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-slate-950"
        role="dialog"
        aria-modal="true"
      >
        {/* Controls Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-4">
            {/* Font Size controls */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl dark:bg-slate-900 border border-gray-100 dark:border-gray-800/50">
              <button
                onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                className="grid h-8 w-8 place-items-center rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-slate-800 transition"
                title="Schrift verkleinern"
              >
                A-
              </button>
              <span className="text-xs px-2 font-mono text-gray-500">{fontSize}px</span>
              <button
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                className="grid h-8 w-8 place-items-center rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-slate-800 transition"
                title="Schrift vergrößern"
              >
                A+
              </button>
            </div>

            {/* TTS controls */}
            <div className="flex items-center gap-1.5">
              {!isSpeaking ? (
                <button
                  onClick={startSpeech}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 transition"
                >
                  🔊 Vorlesen
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl dark:bg-slate-900 border border-gray-100 dark:border-gray-800/50">
                  {isPaused ? (
                    <button
                      onClick={resumeSpeech}
                      className="px-2 py-1 text-xs font-medium hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      Fortsetzen
                    </button>
                  ) : (
                    <button
                      onClick={pauseSpeech}
                      className="px-2 py-1 text-xs font-medium hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      Pause
                    </button>
                  )}
                  <button
                    onClick={stopSpeech}
                    className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
                  >
                    Stopp
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-gray-500 transition"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
          <article className="mx-auto max-w-2xl leading-relaxed">
            <header className="mb-6">
              {feedTitle && (
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                  {feedTitle}
                </p>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
                {title ?? 'Untitled'}
              </h1>
              {pubDate && (
                <time className="mt-2 block text-xs text-gray-400">
                  {pubDate.toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              )}
            </header>

            <div
              className="prose prose-slate dark:prose-invert max-w-none text-gray-700 dark:text-gray-200"
              style={{ fontSize: `${fontSize}px` }}
            >
              {description && !content && (
                <div
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
                  className="space-y-4"
                />
              )}
              {content && (
                <div
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
                  className="space-y-4"
                />
              )}
              {!description && !content && (
                <p className="italic text-gray-400">Kein Inhalt verfügbar.</p>
              )}
            </div>

            {link && (
              <div className="mt-10 border-t border-gray-100 pt-6 dark:border-gray-800/50">
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Originalartikel lesen ↗
                </a>
              </div>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
