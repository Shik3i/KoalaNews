'use client';

import { useEffect, useState } from 'react';
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
  type AppearanceSettings,
} from '@/lib/appearance';
import { useRouter } from '@/i18n/navigation';

export default function AppearancePage() {
  const { status } = useSession();
  const t = useTranslations('appearance');
  const locale = useLocale();
  const router = useRouter();
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/preferences')
      .then((res) => (res.ok ? res.json() : DEFAULT_APPEARANCE))
      .then((data) => setSettings({ ...DEFAULT_APPEARANCE, ...data }))
      .catch(() => setError(t('loadError')));
  }, [status, t]);

  function update<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      setSettings({ ...DEFAULT_APPEARANCE, ...(await res.json()) });
      setMessage(t('saved'));
    } else {
      setError(t('saveError'));
    }
    setSaving(false);
  }

  if (status === 'loading') {
    return <p className="text-gray-400 text-center py-12">{t('loading')}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {message && (
        <p className="text-green-600 text-sm mb-4 bg-green-50 border border-green-200 rounded px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <form onSubmit={saveSettings} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">{t('visualDesign')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label={t('theme')} value={settings.theme} options={THEME_OPTIONS} onChange={(value) => update('theme', value)} />
              <SelectField label={t('design')} value={settings.design} options={DESIGN_OPTIONS} onChange={(value) => update('design', value)} />
              <SelectField label={t('density')} value={settings.density} options={DENSITY_OPTIONS} onChange={(value) => update('density', value)} />
              <SelectField label={t('fontScale')} value={settings.fontScale} options={FONT_SCALE_OPTIONS} onChange={(value) => update('fontScale', value)} />
              <SelectField label={t('accentColor')} value={settings.accentColor} options={ACCENT_OPTIONS} onChange={(value) => update('accentColor', value)} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">{t('cardDesign')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label={t('cardStyle')} value={settings.cardStyle} options={CARD_STYLE_OPTIONS} onChange={(value) => update('cardStyle', value)} />
              <label className="block text-sm">
                <span className="font-medium text-gray-700">{t('descriptionLines')}</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={settings.descriptionLines}
                  onChange={(e) => update('descriptionLines', Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">{t('visibleFields')}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label={t('showImages')} checked={settings.showImages} onChange={(value) => update('showImages', value)} />
              <Toggle label={t('showSource')} checked={settings.showSource} onChange={(value) => update('showSource', value)} />
              <Toggle label={t('showDate')} checked={settings.showDate} onChange={(value) => update('showDate', value)} />
              <Toggle label={t('showDescription')} checked={settings.showDescription} onChange={(value) => update('showDescription', value)} />
              <Toggle label={t('showReadMore')} checked={settings.showReadMore} onChange={(value) => update('showReadMore', value)} />
            </div>
          </section>

          <button
            disabled={saving}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>

        <aside>
          <h2 className="text-lg font-semibold mb-3">{t('preview')}</h2>
          <ArticleCard
            title={t('previewTitle')}
            description={t('previewDescription')}
            link="https://example.com/article"
            imageUrl="https://example.com/image.jpg"
            feedTitle="Koala Daily"
            pubDate={new Date('2026-06-05T12:00:00Z')}
            locale={locale}
            readMoreLabel={t('readMore')}
            fromFeedLabel={t('fromFeed')}
            publishedAtLabel={t('publishedAt')}
            appearance={settings}
          />
        </aside>
      </form>
    </div>
  );
}

function SelectField<T extends readonly string[]>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T[number];
  options: T;
  onChange: (_value: T[number]) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T[number])}
        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (_value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 border border-gray-200 rounded px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}
