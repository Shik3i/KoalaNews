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

type BackupInfo = {
  name: string;
  kind: 'daily' | 'weekly' | 'monthly';
  sizeLabel: string;
  createdAt: string;
  downloadUrl: string;
  restoreCommands: string;
};

type DatabaseInfo = {
  sizeLabel: string;
  backupDir: string;
  backups: BackupInfo[];
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const t = useTranslations('admin');
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [database, setDatabase] = useState<DatabaseInfo | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      fetchDatabase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  async function fetchUsers() {
    setLoading(true);
    const params = new URLSearchParams({ take: '25' });
    if (query.trim()) params.set('q', query.trim());
    if (roleFilter) params.set('role', roleFilter);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.items ?? []);
      setNextCursor(data.nextCursor ?? null);
    } else {
      setError(t('loadError'));
    }
    setLoading(false);
  }

  async function loadMoreUsers() {
    if (!nextCursor) return;
    setLoading(true);
    const params = new URLSearchParams({ take: '25', cursor: nextCursor });
    if (query.trim()) params.set('q', query.trim());
    if (roleFilter) params.set('role', roleFilter);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers((current) => [...current, ...(data.items ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } else {
      setError(t('loadError'));
    }
    setLoading(false);
  }

  async function fetchSettings() {
    const res = await fetch('/api/admin/settings');
    if (res.ok) setSettings(await res.json());
    else setError(t('loadError'));
  }

  async function fetchDatabase() {
    const res = await fetch('/api/admin/database');
    if (res.ok) setDatabase(await res.json());
    else setError(t('loadError'));
  }

  async function toggleBan(user: AdminUser) {
    if (user.id === session?.user?.id) {
      setError(t('cannotChangeSelf'));
      return;
    }
    if (!window.confirm(user.banned ? t('confirmUnban') : t('confirmBan'))) return;
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
      const data = await safeJson(res);
      setError(data.error ?? 'Error');
    }
  }

  async function toggleRole(user: AdminUser) {
    if (!window.confirm(user.role === 'ADMIN' ? t('confirmRemoveAdmin') : t('confirmMakeAdmin'))) {
      return;
    }
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
      const err = await safeJson(res);
      setError(
        err.error === 'cannot_remove_last_admin' ? t('cannotRemoveLastAdmin') : t('actionError'),
      );
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
    } else {
      setError(t('actionError'));
    }
  }

  async function createBackup() {
    setCreatingBackup(true);
    setMessage('');
    setError('');
    const res = await fetch('/api/admin/backups', { method: 'POST' });
    if (res.ok) {
      const nextDatabase = await res.json();
      setDatabase(nextDatabase);
      setSelectedBackup(nextDatabase.backups?.[0] ?? null);
      setMessage(t('backupCreated'));
    } else {
      setError(t('backupError'));
    }
    setCreatingBackup(false);
  }

  async function safeJson(res: Response) {
    try {
      return await res.json();
    } catch {
      return {};
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
        <div className="bg-white border border-gray-200 dark:bg-gray-950 dark:border-gray-800 rounded p-4 flex items-center justify-between">
          <span className="text-sm">{t('allowRegistration')}</span>
          <button
            onClick={toggleRegistration}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.allow_registration === 'true' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-gray-300 rounded-full shadow transition-transform ${settings.allow_registration === 'true' ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('database')}</h2>
            <p className="text-sm text-gray-500">{t('backupHint')}</p>
          </div>
          <button
            onClick={createBackup}
            disabled={creatingBackup}
            className="inline-flex h-10 items-center justify-center rounded bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingBackup ? t('creatingBackup') : t('createBackup')}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('databaseSize')}</p>
            <p className="mt-2 text-2xl font-semibold">{database?.sizeLabel ?? '-'}</p>
            <p className="mt-3 break-all text-xs text-gray-400 dark:text-gray-500">{database?.backupDir ?? ''}</p>
          </div>

          <div className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('backups')}</h3>
            {!database?.backups?.length ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noBackups')}</p>
            ) : (
              <div className="space-y-2">
                {database.backups.map((backup) => (
                  <div
                    key={backup.name}
                    className="flex flex-col gap-3 rounded border border-gray-100 dark:border-gray-800 dark:bg-gray-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-mono text-xs text-gray-700 dark:text-gray-300">{backup.name}</p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {backup.kind} · {backup.sizeLabel} ·{' '}
                        {new Date(backup.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={backup.downloadUrl}
                        className="rounded border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {t('download')}
                      </a>
                      <button
                        type="button"
                        onClick={() => setSelectedBackup(backup)}
                        className="rounded border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {t('restoreInstructions')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBackup && (
              <div className="mt-4 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-400">
                  {t('restoreInstructions')}
                </p>
                <p className="mb-3 text-xs text-amber-800 dark:text-amber-500">{t('restoreHint')}</p>
                <pre className="overflow-x-auto rounded bg-gray-950 p-3 text-xs text-gray-100">
                  {selectedBackup.restoreCommands}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t('userManagement')}</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchUsers();
          }}
          className="flex flex-col sm:flex-row gap-2 mb-4"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchUsers')}
            className="border border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:text-[var(--page-fg)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:text-[var(--page-fg)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('allRoles')}</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <button className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700">
            {t('search')}
          </button>
        </form>

        {loading && users.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noUsers')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('id')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('name')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('email')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('role')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('feeds')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('banned')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('created')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-3 py-2 text-xs font-mono text-gray-400 dark:text-gray-500">
                      {user.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">{user.name || '-'}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
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
                    <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleBan(user)}
                          disabled={user.id === session?.user?.id}
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
            {nextCursor && (
              <button
                onClick={loadMoreUsers}
                disabled={loading}
                className="w-full border border-gray-200 dark:border-gray-800 rounded px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 mt-3"
              >
                {loading ? t('loadingMore') : t('loadMore')}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
