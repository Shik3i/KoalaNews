'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppearanceSettings, DEFAULT_APPEARANCE, normalizeAppearance } from '@/lib/appearance';

const AppearanceContext = createContext<AppearanceSettings>(DEFAULT_APPEARANCE);

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      try {
        const stored = localStorage.getItem('koalanews:appearance');
        if (stored) {
          setSettings(normalizeAppearance(JSON.parse(stored)));
        }
      } catch {}
      return;
    }

    // Authenticated: fetch from API
    fetch('/api/preferences')
      .then((res) => (res.ok ? res.json() : DEFAULT_APPEARANCE))
      .then((data) => setSettings({ ...DEFAULT_APPEARANCE, ...data }))
      .catch(() => {});
  }, [status]);

  // Listen to local storage changes for cross-tab sync or same-page updates
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'koalanews:appearance' && e.newValue) {
        try {
          setSettings(normalizeAppearance(JSON.parse(e.newValue)));
        } catch {}
      }
    };
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AppearanceSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        try {
          const stored = localStorage.getItem('koalanews:appearance');
          if (stored) {
            setSettings(normalizeAppearance(JSON.parse(stored)));
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('koalanews:appearance_updated', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('koalanews:appearance_updated', handleCustomEvent);
    };
  }, []);

  return <AppearanceContext.Provider value={settings}>{children}</AppearanceContext.Provider>;
}
