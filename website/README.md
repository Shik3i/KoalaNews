# KoalaNews Website

Next.js app for reading public and personal RSS feeds with locale-aware defaults.

## Local Development

```bash
npm install
npm run db:push
node scripts/init.mjs
npm run dev
```

The default SQLite URL is `DATABASE_URL="file:./dev.db"`. Prisma resolves this path relative to `prisma/schema.prisma`, so the local database is created at `website/prisma/dev.db`.

## Public Experience

The public feed page is available without login. It loads a locale-specific default feed when no articles are available:

- `de`: Tagesschau RSS
- `en`: BBC News RSS

Search and source filters are collapsed by default so the article list remains the first-class reading surface.

## Feed Languages

Feeds have a `language` field on both `Feed` and `SourceFeed`. When authenticated users add a feed in the dashboard, they choose the feed's default language. The public feed page only shows articles matching the active locale.

## Appearance

The appearance page is public. Authenticated users save appearance preferences in the database through `/api/preferences`; guests save the same settings in `localStorage` under `koalanews:appearance`.

The navigation language selector displays country flags using the `Twemoji Country Flags` font when installed, with system color emoji fonts as fallbacks.

## Verification

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```
