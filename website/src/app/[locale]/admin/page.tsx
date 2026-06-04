'use client';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  banned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  _count: { feeds: number };
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const t = useTranslations('admin');
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchUsers();
      fetchSettings();
    }
  }, [status, session]);

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  }

  async function fetchSettings() {
    const res = await fetch('/api/admin/settings');
    if (res.ok) setSettings(await res.json());
  }

  async function toggleBan(user: AdminUser) {
    setMessage('');
    setError('');
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !user.banned }),
    });
    if (res.ok) {
      setMessage(user.banned ? 'Unbanned' : 'Banned');
      await fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Error');
    }
  }

  async function toggleRole(user: AdminUser) {
    setMessage('');
    setError('');
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setMessage(user.role === 'ADMIN' ? t('removeAdmin') : t('makeAdmin'));
      await fetchUsers();
    } else {
      const err = await res.json();
      setError(err.error === 'Cannot remove last admin' ? t('cannotRemoveLastAdmin') : 'Error');
    }
  }

  async function toggleRegistration() {
    setMessage('');
    setError('');
    const newValue = settings.allow_registration === 'true' ? 'false' : 'true';
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_registration: newValue }),
    });
    if (res.ok) {
      setSettings((s) => ({ ...s, allow_registration: newValue }));
      setMessage(t('saved'));
    }
  }

  if (status === 'loading') return <p className="text-gray-400 text-center py-12">Loading...</p>;
  if (status === 'unauthenticated' || session?.user?.role !== 'ADMIN') return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-8">{t('subtitle')}</p>

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

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">{t('settings')}</h2>
        <div className="bg-white border border-gray-200 rounded p-4 flex items-center justify-between">
          <span className="text-sm">{t('allowRegistration')}</span>
          <button
            onClick={toggleRegistration}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.allow_registration === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.allow_registration === 'true' ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t('userManagement')}</h2>

        {users.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noUsers')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('id')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('name')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('email')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('role')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('feeds')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('banned')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('created')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-mono text-gray-400">{user.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{user.name || '-'}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">{user._count.feeds}</td>
                    <td className="px-3 py-2">
                      {user.banned ? (
                        <span className="text-red-600 text-xs">Yes</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleBan(user)}
                          className={`text-xs ${user.banned ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                        >
                          {user.banned ? t('unban') : t('ban')}
                        </button>
                        {user.id !== session?.user?.id && (
                          <button
                            onClick={() => toggleRole(user)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {user.role === 'ADMIN' ? t('removeAdmin') : t('makeAdmin')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
