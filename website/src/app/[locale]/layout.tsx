import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { locales } from '@/i18n/routing';
import Providers from '@/components/Providers';
import NavBar from '@/components/NavBar';
import '../globals.css';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--page-bg)] text-[var(--page-fg)] antialiased transition-colors duration-300">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var stored = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var resolved = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
                document.documentElement.classList.toggle('dark', resolved === 'dark');
                document.documentElement.dataset.theme = resolved;
              } catch (error) {
                document.documentElement.classList.remove('dark');
                document.documentElement.dataset.theme = 'light';
              }
            })();
          `}
        </Script>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <NavBar />
            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
