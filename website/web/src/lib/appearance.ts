import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const THEMES = [
  'system',
  'light',
  'dark',
  'sepia',
  'midnight',
  'forest',
  'rose',
  'nord',
  'contrast',
] as const;
export const DESIGNS = [
  'clean',
  'newspaper',
  'terminal',
  'soft',
  'glass',
  'retrowave',
  'high-contrast',
] as const;
export const CARD_STYLES = ['magazine', 'compact', 'headline'] as const;
export const DENSITIES = ['comfortable', 'compact', 'dense'] as const;
export const FONT_SCALES = ['small', 'medium', 'large'] as const;
export const BACKGROUNDS = ['flat', 'soft-glow', 'gradient', 'dotted'] as const;
export const FONT_FAMILIES = ['system', 'serif', 'mono'] as const;

export type Appearance = {
  theme: (typeof THEMES)[number];
  design: (typeof DESIGNS)[number];
  cardStyle: (typeof CARD_STYLES)[number];
  density: (typeof DENSITIES)[number];
  fontScale: (typeof FONT_SCALES)[number];
  background: (typeof BACKGROUNDS)[number];
  fontFamily: (typeof FONT_FAMILIES)[number];
  accent: string; // free-form CSS color chosen by the user
  descriptionLines: number; // 0–5; 0 hides the description
  showImages: boolean;
  showSource: boolean;
  showDate: boolean;
  showDescription: boolean;
  showReadMore: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  design: 'clean',
  cardStyle: 'magazine',
  density: 'comfortable',
  fontScale: 'medium',
  background: 'flat',
  fontFamily: 'system',
  accent: '#2563eb',
  descriptionLines: 3,
  showImages: true,
  showSource: true,
  showDate: true,
  showDescription: true,
  showReadMore: true,
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
  el.dataset.design = a.design;
  el.dataset.cardStyle = a.cardStyle;
  el.dataset.density = a.density;
  el.dataset.fontScale = a.fontScale;
  el.dataset.background = a.background;
  el.dataset.fontFamily = a.fontFamily;
  el.style.setProperty('--user-accent', a.accent);
}

// When true, changes are also persisted to the server (logged-in users).
let serverBacked = false;

function saveToServer(value: Appearance) {
  if (!browser || !serverBacked) return;
  // Fire-and-forget; localStorage remains the offline source of truth.
  void fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }).catch(() => {});
}

function createStore() {
  const initial = load();
  const { subscribe, set, update } = writable<Appearance>(initial);

  if (browser) apply(initial);

  function persist(value: Appearance, toServer: boolean) {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      apply(value);
    }
    if (toServer) saveToServer(value);
    set(value);
  }

  return {
    subscribe,
    set(value: Appearance) {
      persist(value, true);
    },
    patch(partial: Partial<Appearance>) {
      update((current) => {
        const next = { ...current, ...partial };
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          apply(next);
        }
        saveToServer(next);
        return next;
      });
    },
    reset() {
      this.set({ ...DEFAULT_APPEARANCE });
    },
    /** Replace local state from the server without echoing back a save. */
    adoptFromServer(value: Appearance) {
      persist(value, false);
    },
  };
}

export const appearance = createStore();

/** Toggle server persistence (called on login/logout). */
export function setServerBacked(enabled: boolean) {
  serverBacked = enabled;
}

/** Load the signed-in user's saved appearance and apply it locally. */
export async function loadServerAppearance() {
  if (!browser) return;
  try {
    const res = await fetch('/api/preferences');
    if (!res.ok) return;
    const remote = (await res.json()) as Partial<Appearance>;
    appearance.adoptFromServer({ ...DEFAULT_APPEARANCE, ...remote });
  } catch {
    // keep local state on failure
  }
}
