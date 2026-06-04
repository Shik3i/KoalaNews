# Contributing

## Dev Setup

```bash
cd website
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

## Before Every Commit

Der Pre-Commit-Hook (`husky`) führt automatisch aus:

```bash
npx lint-staged
# → ESLint --fix + Prettier --write für staged Dateien
```

Bitte vor dem Pushen manuell prüfen:

```bash
npx next lint          # ESLint
npx tsc --noEmit       # TypeScript Check
npx vitest run         # Tests
```

## Commit Conventions

`<type>: <kurzbeschreibung>`

| Typ     | Wofür                          |
| ------- | ------------------------------ |
| feat    | Neues Feature                  |
| fix     | Bugfix                         |
| refactor| Refactoring ohne Verhaltensänderung |
| test    | Tests hinzufügen/ändern        |
| docs    | Dokumentation                  |
| chore   | Tooling, CI, Dependencies      |
| i18n    | Übersetzungen / Sprachdateien  |
| style   | Formatierung (Prettier)        |

Beispiele: `feat: add feed refresh button`, `fix: handle empty RSS feeds`

## Branch Naming

| Branch-Typ   | Prefix          | Beispiel                        |
| ------------ | --------------- | ------------------------------- |
| Feature      | `feat/`         | `feat/dark-mode`                |
| Bugfix       | `fix/`          | `fix/feed-parsing-error`        |
| Refactoring  | `refactor/`     | `refactor/api-routes`           |
| Tests        | `test/`         | `test/feed-service`             |

## Code Guidelines

### Allgemein

-   **Keine `console.log`** im Commit – wenn nötig, `console.warn` mit ESLint-Erlaubnis.
-   **TypeScript strict mode** ist aktiv – nutze explizite Typen statt `any`.
-   **Unused variables** vermeiden (ESLint warnt).
-   **Prettier** formatiert automatisch – nutze `npm run format`.

### Komponenten

-   Server Components bevorzugen, Client Components nur wo nötig (`'use client'`).
-   Props immer explizit typen, nie `any`.
-   i18n Übersetzungen in `src/messages/{locale}.json` pflegen, nicht hardcoded.
-   Keine clientseitigen Third-Party-Requests: keine externen CDNs, Google Fonts, Remote-Images, Tracking-Scripts, Widgets oder Font-/Icon-CDNs. Browser-Assets müssen lokal/self-hosted sein.
-   Externe Links sind okay als Navigation zu Artikeln, aber keine eingebetteten externen Ressourcen im UI.

### API Routes

-   Jede Route authentifizieren via `getServerSession(authOptions)`.
-   Fehler mit eindeutigem HTTP-Status und JSON-Body zurückgeben.
-   Externe Netzwerkzugriffe gehören nicht in den Client. RSS-Abrufe laufen ausschließlich serverseitig, SSRF-geschützt, rate-limited und idealerweise über einen kontrollierten Cronjob/Refresh-Prozess.
-   Wiederkehrende Cleanup-Jobs laufen serverseitig über `npm run cleanup`; Retention wird über `KOALANEWS_RETENTION_DAYS` gesteuert.

### Datenbank

-   Schema-Änderungen via Prisma-Migrationen einchecken; lokal mit `npx prisma migrate dev`, Produktion mit `npx prisma migrate deploy`.
-   Keine rohen SQL-Queries – immer Prisma Client.
-   RSS-Quellen werden als globale `SourceFeed`s dedupliziert; User-Feeds sind Subscriptions. Artikel hängen an `SourceFeed`, damit derselbe Feed nicht mehrfach gespeichert wird.
-   RSS-Artikel und gecachte Bilder werden in SQLite gespeichert und per Retention-Cleanup gelöscht.

### Tests

-   Tests liegen neben der zu testenden Datei: `Component.test.tsx`.
-   Mock-Dateien liegen in `__mocks__/` im Projekt-Root.
-   Neue Features brauchen Tests – Coverage soll steigen, nicht fallen.

### i18n

-   Sprachdateien in `src/messages/` nach ISO-Code benennen: `de.json`, `en.json`.
-   Neue Sprache: `routing.ts` erweitern + Datei anlegen.
-   In Komponenten `useTranslations('namespace')` nutzen.

### Docker

-   Image läuft als `nextjs` User (non-root).
-   SQLite unter `/data/koalanews.db` – via Volume persistieren.
-   `NEXTAUTH_SECRET` und `DATABASE_URL` immer als Env-Vars setzen.
-   `KOALANEWS_RETENTION_DAYS` dokumentiert setzen; Default ist `14`.

## CI/CD

-   Auf jeden PR & Push zu `main`: **Tests → Lint → Typecheck → Docker Build**
-   Coverage-Reports als Build-Artifact.
-   Nur wenn Tests grün sind, wird das Image gebaut & gepusht.

## Fragen?

→ Issues oder PRs im GitHub Repository.
