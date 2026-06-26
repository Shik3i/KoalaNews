'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    const res = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setMessage(t('resetRequested'));
    } else {
      setError(t('errorInvalid'));
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold mb-6">{t('forgotPasswordTitle')}</h1>

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
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? t('submitting') : t('requestReset')}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-4 text-center">
        <Link href="/login" className="text-blue-600 hover:underline">
          {t('loginHere')}
        </Link>
      </p>
    </div>
  );
}
