'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';

export default function NavBar() {
  const { data: session } = useSession();
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const nextTheme = resolveTheme();
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }, []);

  function switchLocale(nextLocale: Locale) {
    router.replace(pathname, { locale: nextLocale });
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  const navLinks = [
    { href: '/', label: t('home'), visible: true },
    { href: '/dashboard', label: t('dashboard'), visible: Boolean(session) },
    { href: '/settings', label: t('settings'), visible: Boolean(session) },
    { href: '/appearance', label: t('appearance'), visible: true },
    { href: '/statistics', label: t('statistics'), visible: true },
    {
      href: '/admin',
      label: t('admin'),
      visible: session?.user?.role === 'ADMIN',
      tone: 'danger' as const,
    },
  ].filter((item) => item.visible);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/40 bg-[color:var(--surface-glass)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-sm font-semibold text-white shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
              KN
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold tracking-tight text-[var(--page-fg)]">
                KoalaNews
              </span>
              <span className="block text-xs text-[var(--muted-fg)]">{t('tagline')}</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <label className="sr-only" htmlFor="locale-select">
              {t('language')}
            </label>
            <select
              id="locale-select"
              value={locale}
              onChange={(event) => switchLocale(event.target.value as Locale)}
              aria-label={t('language')}
              className="flag-emoji h-10 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-sm font-medium text-[var(--page-fg)] shadow-sm outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            >
              {locales.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                </option>
              ))}
            </select>

            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--page-fg)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {session ? (
              <button
                onClick={() => signOut()}
                className="inline-flex h-10 items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-sm font-medium text-[var(--page-fg)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)]"
              >
                {t('logout')}
              </button>
            ) : pathname === '/login' ? (
              <Link
                href="/register"
                className="inline-flex h-10 items-center rounded-full bg-[var(--accent-strong)] px-4 text-sm font-medium text-white shadow-[0_12px_32px_rgba(14,116,144,0.28)] transition hover:-translate-y-0.5"
              >
                {t('register')}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full bg-[var(--accent-strong)] px-4 text-sm font-medium text-white shadow-[0_12px_32px_rgba(14,116,144,0.28)] transition hover:-translate-y-0.5"
              >
                {t('login')}
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {navLinks.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition',
                  active
                    ? 'bg-[var(--page-fg)] text-[var(--page-bg)] shadow-[0_10px_30px_rgba(15,23,42,0.16)]'
                    : 'bg-[var(--surface-elevated)] text-[var(--muted-fg)] hover:-translate-y-0.5 hover:text-[var(--page-fg)]',
                  item.tone === 'danger' && !active ? 'text-rose-600' : '',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function resolveTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(nextTheme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('theme', nextTheme);
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2.5M12 18.75v2.5M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2.75 12h2.5M18.75 12h2.5M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3c-.06.32-.09.65-.09 1a9 9 0 0 0 9 9c.35 0 .68-.03 1-.21Z" />
    </svg>
  );
}
