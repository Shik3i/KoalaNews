# Contributing

## Dev Setup

```bash
cd website/web
npm install
npm run dev
```

In einem zweiten Terminal:

```bash
cd website
go run ./cmd/koalanews
```

## Before Every Commit

Der Pre-Commit-Hook (`husky`) führt automatisch aus:

```bash
(cd website/web && npm run check)
(cd website && go vet ./...)
```

Bitte vor dem Pushen manuell prüfen:

```bash
(cd website/web && npm run check && npm run build)
(cd website && go vet ./... && go test ./...)
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

### Frontend

-   Svelte-Props immer explizit typen, nie `any`.
-   i18n Übersetzungen in `website/web/src/lib/messages.ts` pflegen, nicht hardcoded.
-   Keine clientseitigen Third-Party-Requests: keine externen CDNs, Google Fonts, Remote-Images, Tracking-Scripts, Widgets oder Font-/Icon-CDNs. Browser-Assets müssen lokal/self-hosted sein.
-   Externe Links sind okay als Navigation zu Artikeln, aber keine eingebetteten externen Ressourcen im UI.

### API

-   Authentifizierte Endpoints über die Go-Middleware schützen.
-   Fehler mit eindeutigem HTTP-Status und JSON-Body zurückgeben.
-   Externe Netzwerkzugriffe gehören nicht in den Client. RSS-Abrufe laufen ausschließlich serverseitig, SSRF-geschützt, rate-limited und idealerweise über einen kontrollierten Cronjob/Refresh-Prozess.

### Datenbank

-   Schema-Änderungen in `website/internal/db/schema.sql` und passende Queries in `queries.sql` pflegen.
-   Nach Query-Änderungen `sqlc generate` ausführen.
-   Für dynamische SQL-Formen nur bewusst handgeschriebene Queries verwenden und kommentieren.
-   RSS-Quellen werden als globale `SourceFeed`s dedupliziert; User-Feeds sind Subscriptions. Artikel hängen an `SourceFeed`, damit derselbe Feed nicht mehrfach gespeichert wird.
-   RSS-Artikel und gecachte Bilder werden in SQLite gespeichert.

### Tests

-   Go-Tests liegen neben dem Paket (`*_test.go`).
-   Riskante Frontend-Änderungen mindestens mit `npm run check` und Browser-Smoke prüfen.

### i18n

-   Messages in `website/web/src/lib/messages.ts` pflegen.
-   In Komponenten den `$t(...)` Store aus `$lib/i18n` nutzen.

### Docker

-   Image läuft als distroless `nonroot`.
-   SQLite unter `/data/koalanews.db` – via Volume persistieren.
-   `SESSION_KEY` und `DATABASE_URL` immer als Env-Vars setzen.

## CI/CD

-   Auf jeden PR & Push: **Svelte check/build → Go vet/test/build**.
-   Docker Build & Push laufen für `v*`-Tags oder manuell per `workflow_dispatch`.

## Fragen?

→ Issues oder PRs im GitHub Repository.
