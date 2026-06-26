import { writable } from 'svelte/store';
import { setServerBacked, loadServerAppearance } from './appearance';

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export const user = writable<User | null>(null);
export const authReady = writable(false);

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Throws an Error with the server message on failure. */
async function asUser(res: Response): Promise<User> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  user.set(data as User);
  // From now on, appearance changes persist to the server. Load any saved prefs.
  setServerBacked(true);
  await loadServerAppearance();
  return data as User;
}

export async function fetchMe(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    user.set(data.user ?? null);
    if (data.user) {
      setServerBacked(true);
      await loadServerAppearance();
    }
  } catch {
    user.set(null);
  } finally {
    authReady.set(true);
  }
}

export async function login(email: string, password: string): Promise<User> {
  return asUser(await post('/api/auth/login', { email, password }));
}

export async function register(email: string, password: string, name: string): Promise<User> {
  return asUser(await post('/api/auth/register', { email, password, name }));
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout', {});
  user.set(null);
  // Stop syncing to the server; local (localStorage) appearance stays as-is.
  setServerBacked(false);
}
