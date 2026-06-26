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

- `de`: Tagesschau RSS (`https://www.tagesschau.de/xml/rss2/`)
- `en`: BBC News RSS (`https://feeds.bbci.co.uk/news/rss.xml`)
- `fr`: BFMTV RSS (`https://www.bfmtv.com/rss/news-24-7/`)

Search and source filters are collapsed by default so the article list remains the first-class reading surface.

## Feed Languages

Feeds have a `language` field on both `Feed` and `SourceFeed`. When authenticated users add a feed in the dashboard, they choose the feed's default language. The public feed page only shows articles matching the active locale.

## Article Images

Article images are never loaded directly from third-party domains in the browser. RSS fetches store discovered image URLs on articles and prefetch a limited set of new images into the SQLite-backed `ImageCache` table. The `/api/image` route serves cached or known article images through KoalaNews with size and content-type checks.

## Appearance

The appearance page is public. Authenticated users save appearance preferences in the database through `/api/preferences`; guests save the same settings in `localStorage` under `koalanews:appearance`.

The navigation language selector displays country flags using the `Twemoji Country Flags` font when installed, with system color emoji fonts as fallbacks.

## SQLite Backups

The admin page shows the current SQLite database size and available backups. Admins can create and download Grandfather/Father/Son backups from the UI.

Backups are stored next to the database in a `backup/` directory:

- local dev default: `website/prisma/backup/`
- Docker default: `/data/backup/`

Backup snapshots are created with SQLite `VACUUM INTO`. After the consistent snapshot is created, disposable feed data is removed from the backup copy and the backup is compacted again. The backup keeps users, account data, preferences, settings, feed subscriptions, reset tokens, rate limits, and source feed metadata. It intentionally excludes:

- `Article`
- `ArticleRead`
- `ImageCache`

Retention keeps the latest 7 daily, 5 weekly, and 12 monthly backups.

Manual local backup:

```bash
npm run backup
```

Docker cron example on the host:

```cron
15 3 * * * docker exec koalanews node backup.mjs
```

Restore is intentionally manual. Stop the container first, then run the commands shown on the admin page from the `/data` directory. The default command pattern is:

```bash
docker compose stop koalanews
cp koalanews.db koalanews.db.old-$(date +%Y%m%d-%H%M%S)
cp backup/koalanews-backup-daily-YYYY-MM-DD.db koalanews.db
docker compose start koalanews
```

## Verification

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```
