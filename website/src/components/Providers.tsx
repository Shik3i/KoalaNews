'use client';

import { SessionProvider } from 'next-auth/react';

// Suppress the React 19 false-positive script warning in development to prevent dev overlay blocks.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return;
    }
    orig.apply(console, args);
  };
}

import { AppearanceProvider } from './AppearanceProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppearanceProvider>{children}</AppearanceProvider>
    </SessionProvider>
  );
}
