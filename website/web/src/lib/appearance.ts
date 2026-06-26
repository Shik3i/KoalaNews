import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const THEMES = ['system', 'light', 'dark', 'sepia', 'midnight'] as const;
export const CARD_STYLES = ['magazine', 'compact', 'headline'] as const;
export const DENSITIES = ['comfortable', 'compact', 'dense'] as const;
export const FONT_SCALES = ['small', 'medium', 'large'] as const;

export type Appearance = {
  theme: (typeof THEMES)[number];
  cardStyle: (typeof CARD_STYLES)[number];
  density: (typeof DENSITIES)[number];
  fontScale: (typeof FONT_SCALES)[number];
  accent: string; // free-form CSS color chosen by the user
  showImages: boolean;
  showSource: boolean;
  showDate: boolean;
  showDescription: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  cardStyle: 'magazine',
  density: 'comfortable',
  fontScale: 'medium',
  accent: '#2563eb',
  showImages: true,
  showSource: true,
  showDate: true,
  showDescription: true,
};

const STORAGE_KEY = 'koalanews:appearance';

function load(): Appearance {
  if (!browser) return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Reflect appearance onto <html> data-attributes + CSS variables. */
export function apply(a: Appearance) {
  if (!browser) return;
  const el = document.documentElement;
  el.dataset.theme = a.theme;
  el.dataset.cardStyle = a.cardStyle;
  el.dataset.density = a.density;
  el.dataset.fontScale = a.fontScale;
  el.style.setProperty('--user-accent', a.accent);
}

function createStore() {
  const initial = load();
  const { subscribe, set, update } = writable<Appearance>(initial);

  if (browser) apply(initial);

  return {
    subscribe,
    set(value: Appearance) {
      if (browser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        apply(value);
      }
      set(value);
    },
    patch(partial: Partial<Appearance>) {
      update((current) => {
        const next = { ...current, ...partial };
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          apply(next);
        }
        return next;
      });
    },
    reset() {
      this.set({ ...DEFAULT_APPEARANCE });
    },
  };
}

export const appearance = createStore();
