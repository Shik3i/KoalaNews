'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import ArticleCard from '@/components/ArticleCard';
import {
  ACCENT_OPTIONS,
  CARD_STYLE_OPTIONS,
  DEFAULT_APPEARANCE,
  DENSITY_OPTIONS,
  DESIGN_OPTIONS,
  FONT_SCALE_OPTIONS,
  THEME_OPTIONS,
  normalizeAppearance,
  type AppearanceSettings,
} from '@/lib/appearance';

const LOCAL_APPEARANCE_KEY = 'koalanews:appearance';
const PREVIEW_IMAGE = '/preview-card.svg';

type OptionValue = AppearanceSettings[keyof AppearanceSettings] & string;

function applyActiveTheme(themeOption: string) {
  if (typeof window === 'undefined') return;
  let resolvedTheme = themeOption;
  if (themeOption === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    resolvedTheme = prefersDark ? 'dark' : 'light';
  }

  const darkThemes = ['dark', 'nord', 'forest', 'cyberpunk', 'dracula'];
  const isDark = darkThemes.includes(resolvedTheme);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = resolvedTheme;
  localStorage.setItem('theme', themeOption);
}

export default function AppearancePage() {
  const { status } = useSession();
  const t = useTranslations('appearance');
  const locale = useLocale();
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [loadedSettings, setLoadedSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionFallback, setSessionFallback] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings],
  );
  const effectiveStatus = status === 'loading' && sessionFallback ? 'unauthenticated' : status;

  useEffect(() => {
    if (status !== 'loading') {
      setSessionFallback(false);
      return;
    }
    const timer = window.setTimeout(() => setSessionFallback(true), 1200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (effectiveStatus === 'loading') return;
    if (effectiveStatus === 'unauthenticated') {
      try {
        const stored = localStorage.getItem(LOCAL_APPEARANCE_KEY);
        const nextSettings = stored ? normalizeAppearance(JSON.parse(stored)) : DEFAULT_APPEARANCE;
        setSettings(nextSettings);
        setLoadedSettings(nextSettings);
        applyActiveTheme(nextSettings.theme);
      } catch {
        setSettings(DEFAULT_APPEARANCE);
        setLoadedSettings(DEFAULT_APPEARANCE);
        applyActiveTheme(DEFAULT_APPEARANCE.theme);
      }
      return;
    }

    fetch('/api/preferences')
      .then((res) => (res.ok ? res.json() : DEFAULT_APPEARANCE))
      .then((data) => {
        const nextSettings = { ...DEFAULT_APPEARANCE, ...data };
        setSettings(nextSettings);
        setLoadedSettings(nextSettings);
        applyActiveTheme(nextSettings.theme);
      })
      .catch(() => setError(t('loadError')));
  }, [effectiveStatus, t]);

  function update<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === 'theme' && typeof value === 'string') {
      applyActiveTheme(value);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    applyActiveTheme(settings.theme);

    if (effectiveStatus !== 'authenticated') {
      localStorage.setItem(LOCAL_APPEARANCE_KEY, JSON.stringify(settings));
      setLoadedSettings(settings);
      setMessage(t('savedLocal'));
      setSaving(false);
      window.dispatchEvent(
        new CustomEvent('koalanews:appearance_updated', { detail: settings })
      );
      return;
    }

    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      const nextSettings = { ...DEFAULT_APPEARANCE, ...(await res.json()) };
      setSettings(nextSettings);
      setLoadedSettings(nextSettings);
      setMessage(t('saved'));
      window.dispatchEvent(
        new CustomEvent('koalanews:appearance_updated', { detail: nextSettings })
      );
    } else {
      setError(t('saveError'));
    }
    setSaving(false);
  }

  function resetSettings() {
    setSettings(DEFAULT_APPEARANCE);
    applyActiveTheme(DEFAULT_APPEARANCE.theme);
    setMessage('');
    setError('');
  }

  if (effectiveStatus === 'loading') {
    return <p className="text-center text-sm text-[var(--muted-fg)] py-12">{t('loading')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-fg)]">
            KoalaNews
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--page-fg)]">
            {t('title')}
          </h1>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--muted-fg)]">
          {effectiveStatus === 'authenticated' ? t('accountStorage') : t('guestStorage')}
        </p>
      </header>

      {message && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <form onSubmit={saveSettings} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Panel title={t('visualDesign')}>
            <OptionField
              label={t('theme')}
              value={settings.theme}
              options={THEME_OPTIONS}
              locale={locale}
              onChange={(value) => update('theme', value)}
            />
            <OptionField
              label={t('design')}
              value={settings.design}
              options={DESIGN_OPTIONS}
              locale={locale}
              onChange={(value) => update('design', value)}
            />
            <OptionField
              label={t('density')}
              value={settings.density}
              options={DENSITY_OPTIONS}
              locale={locale}
              onChange={(value) => update('density', value)}
            />
            <OptionField
              label={t('fontScale')}
              value={settings.fontScale}
              options={FONT_SCALE_OPTIONS}
              locale={locale}
              onChange={(value) => update('fontScale', value)}
            />
            <OptionField
              label={t('accentColor')}
              value={settings.accentColor}
              options={ACCENT_OPTIONS}
              locale={locale}
              onChange={(value) => update('accentColor', value)}
            />
          </Panel>

          <Panel title={t('cardDesign')}>
            <OptionField
              label={t('cardStyle')}
              value={settings.cardStyle}
              options={CARD_STYLE_OPTIONS}
              locale={locale}
              onChange={(value) => update('cardStyle', value)}
            />

            <label className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--page-fg)]">
                {t('descriptionLines')}
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent-strong)]">
                  {settings.descriptionLines}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={5}
                value={settings.descriptionLines}
                onChange={(e) => update('descriptionLines', Number(e.target.value))}
                className="mt-4 w-full accent-[var(--accent-strong)]"
              />
            </label>
          </Panel>

          <Panel title={t('visibleFields')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleCard
                label={t('showImages')}
                checked={settings.showImages}
                onChange={(value) => update('showImages', value)}
              />
              <ToggleCard
                label={t('showSource')}
                checked={settings.showSource}
                onChange={(value) => update('showSource', value)}
              />
              <ToggleCard
                label={t('showDate')}
                checked={settings.showDate}
                onChange={(value) => update('showDate', value)}
              />
              <ToggleCard
                label={t('showDescription')}
                checked={settings.showDescription}
                onChange={(value) => update('showDescription', value)}
              />
              <ToggleCard
                label={t('showReadMore')}
                checked={settings.showReadMore}
                onChange={(value) => update('showReadMore', value)}
              />
            </div>
          </Panel>

          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[color:var(--surface-glass)] p-3 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-fg)]">
              {isDirty ? t('unsavedChanges') : t('allSaved')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSettings}
                className="inline-flex h-10 items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-sm font-semibold text-[var(--page-fg)] transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)]"
              >
                {t('reset')}
              </button>
              <button
                disabled={saving || !isDirty}
                className="inline-flex h-10 items-center rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(14,116,144,0.28)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-fg)]">
                  Live
                </p>
                <h2 className="text-lg font-semibold text-[var(--page-fg)]">{t('preview')}</h2>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                {formatOption(settings.design, locale)}
              </span>
            </div>
            <ArticleCard
              title={t('previewTitle')}
              description={t('previewDescription')}
              link="https://example.com/article"
              imageUrl={PREVIEW_IMAGE}
              feedTitle="Koala Daily"
              pubDate={new Date('2026-06-05T12:00:00Z')}
              locale={locale}
              readMoreLabel={t('readMore')}
              fromFeedLabel={t('fromFeed')}
              publishedAtLabel={t('publishedAt')}
              appearance={settings}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--muted-fg)]">
              <PreviewPill label={t('density')} value={formatOption(settings.density, locale)} />
              <PreviewPill
                label={t('cardStyle')}
                value={formatOption(settings.cardStyle, locale)}
              />
              <PreviewPill
                label={t('fontScale')}
                value={formatOption(settings.fontScale, locale)}
              />
              <PreviewPill
                label={t('accentColor')}
                value={formatOption(settings.accentColor, locale)}
              />
            </div>
          </section>
        </aside>
      </form>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)]">
      <h2 className="mb-4 text-base font-semibold text-[var(--page-fg)]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function OptionField<T extends readonly OptionValue[]>({
  label,
  value,
  options,
  locale,
  onChange,
}: {
  label: string;
  value: T[number];
  options: T;
  locale: string;
  onChange: (_value: T[number]) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[color:var(--page-bg)]/35 p-3">
      <p className="text-sm font-semibold text-[var(--page-fg)]">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={[
                'min-h-9 rounded-full border px-3 text-sm font-medium transition',
                active
                  ? 'border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white shadow-sm'
                  : 'border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--muted-fg)] hover:border-[var(--accent-strong)] hover:text-[var(--page-fg)]',
              ].join(' ')}
            >
              {formatOption(option, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (_value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-medium transition',
        checked
          ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--page-fg)]'
          : 'border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--muted-fg)]',
      ].join(' ')}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-elevated)] text-xs">
        {checked ? '✓' : '–'}
      </span>
    </button>
  );
}

function PreviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[color:var(--page-bg)]/35 px-3 py-2">
      <p className="font-medium text-[var(--page-fg)]">{value}</p>
      <p>{label}</p>
    </div>
  );
}

function formatOption(option: string, locale: string) {
  const labels: Record<string, Record<string, string>> = {
    de: {
      clean: 'Klar',
      newspaper: 'Zeitung',
      terminal: 'Terminal',
      soft: 'Weich',
      'high-contrast': 'Kontrast',
      magazine: 'Magazin',
      minimal: 'Minimal',
      compact: 'Kompakt',
      headline: 'Schlagzeile',
      dense: 'Dicht',
      comfortable: 'Luftig',
      small: 'Klein',
      medium: 'Mittel',
      large: 'Gross',
      blue: 'Blau',
      green: 'Gruen',
      red: 'Rot',
      neutral: 'Neutral',
      system: 'System',
      light: 'Hell',
      dark: 'Dunkel',
      sepia: 'Sepia',
      nord: 'Nordisch',
      forest: 'Wald',
      cyberpunk: 'Cyberpunk',
      dracula: 'Dracula',
      glassmorphism: 'Glasschmelze',
      retrowave: 'Retrowelle',
      purple: 'Lila',
      orange: 'Orange',
      cyan: 'Cyan',
    },
    en: {
      clean: 'Clean',
      newspaper: 'Newspaper',
      terminal: 'Terminal',
      soft: 'Soft',
      'high-contrast': 'Contrast',
      magazine: 'Magazine',
      minimal: 'Minimal',
      compact: 'Compact',
      headline: 'Headline',
      dense: 'Dense',
      comfortable: 'Comfortable',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      blue: 'Blue',
      green: 'Green',
      red: 'Red',
      neutral: 'Neutral',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
      sepia: 'Sepia',
      nord: 'Nord',
      forest: 'Forest',
      cyberpunk: 'Cyberpunk',
      dracula: 'Dracula',
      glassmorphism: 'Glassmorphism',
      retrowave: 'Retrowave',
      purple: 'Purple',
      orange: 'Orange',
      cyan: 'Cyan',
    },
    fr: {
      clean: 'Clair',
      newspaper: 'Journal',
      terminal: 'Terminal',
      soft: 'Doux',
      'high-contrast': 'Contraste',
      magazine: 'Magazine',
      minimal: 'Minimal',
      compact: 'Compact',
      headline: 'Titre',
      dense: 'Dense',
      comfortable: 'Aeree',
      small: 'Petite',
      medium: 'Moyenne',
      large: 'Grande',
      blue: 'Bleu',
      green: 'Vert',
      red: 'Rouge',
      neutral: 'Neutre',
      system: 'Systeme',
      light: 'Clair',
      dark: 'Sombre',
      sepia: 'Sépia',
      nord: 'Nordique',
      forest: 'Forêt',
      cyberpunk: 'Cyberpunk',
      dracula: 'Dracula',
      glassmorphism: 'Glassmorphisme',
      retrowave: 'Retrowave',
      purple: 'Violet',
      orange: 'Orange',
      cyan: 'Cyan',
    },
  };

  return labels[locale]?.[option] ?? option.replace(/-/g, ' ');
}
