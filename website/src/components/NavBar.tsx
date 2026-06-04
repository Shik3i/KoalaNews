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
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const enabled = localStorage.getItem('theme') === 'dark';
    setDarkMode(enabled);
    document.documentElement.classList.toggle('dark', enabled);
  }, []);

  function switchLocale(nextLocale: Locale) {
    router.replace(pathname, { locale: nextLocale });
  }

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  }

  return (
    <nav className="bg-white border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-4 min-h-14 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Link href="/" className="font-bold text-lg text-blue-600">
            KoalaNews
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            {t('home')}
          </Link>
          {session && (
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              {t('dashboard')}
            </Link>
          )}
          {session && (
            <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
              {t('settings')}
            </Link>
          )}
          {session && (
            <Link href="/appearance" className="text-sm text-gray-600 hover:text-gray-900">
              {t('appearance')}
            </Link>
          )}
          {session?.user?.role === 'ADMIN' && (
            <>
              <Link href="/statistics" className="text-sm text-gray-600 hover:text-gray-900">
                {t('statistics')}
              </Link>
              <Link href="/admin" className="text-sm text-red-600 hover:text-red-800 font-medium">
                {t('admin')}
              </Link>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1 text-sm">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLocale(loc)}
                aria-label={`Switch language to ${loc.toUpperCase()}`}
                aria-pressed={locale === loc}
                className={`px-2 py-1 rounded ${locale === loc ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={toggleDarkMode}
            aria-label={darkMode ? t('lightMode') : t('darkMode')}
            aria-pressed={darkMode}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {darkMode ? t('lightModeShort') : t('darkModeShort')}
          </button>

          {session ? (
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {t('logout')}
            </button>
          ) : (
            <div className="flex gap-3">
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                {t('register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
