'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type Account = {
  name: string | null;
  email: string;
  image: string | null;
  hasPassword: boolean;
};

export default function SettingsPage() {
  const { status } = useSession();
  const t = useTranslations('settings');
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/account')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setError(t('loadError'));
          return;
        }
        setAccount(data);
        setName(data.name ?? '');
        setImage(data.image ?? '');
      })
      .catch(() => setError(t('loadError')));
  }, [status, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        image,
        currentPassword,
        newPassword,
      }),
    });

    if (res.ok) {
      setMessage(t('saved'));
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setError(t('saveError'));
    }
    setSaving(false);
  }

  if (status === 'loading' || !account) {
    return (
      <div className="max-w-xl mx-auto space-y-3">
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
          <input
            value={account.email}
            disabled
            className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profileImage')}</label>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="/uploads/avatar.png"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {account.hasPassword && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('currentPassword')}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('newPassword')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          disabled={saving}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </form>
    </div>
  );
}
