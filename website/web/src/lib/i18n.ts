import { derived, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { LOCALES, messages, type Locale } from './messages';

const STORAGE_KEY = 'koalanews:locale';

function detect(): Locale {
  if (!browser) return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  const nav = navigator.language.slice(0, 2);
  return (LOCALES as readonly string[]).includes(nav) ? (nav as Locale) : 'en';
}

export const locale = writable<Locale>(detect());

locale.subscribe((l) => {
  if (browser) localStorage.setItem(STORAGE_KEY, l);
});

export const t = derived(locale, (l) => (key: string): string => messages[l][key] ?? key);
