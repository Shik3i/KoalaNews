# KoalaNews – Architektur- & Entwicklungsrichtlinien

Dieses Dokument hält die grundlegenden Architektur- und Designentscheidungen fest. Es dient als Kompass für alle zukünftigen Entwickler – damit Entscheidungen nachvollziehbar und konsistent bleiben.

---

## 1. Tech-Stack & Begründung

| Technologie | Wahlgrund |
|---|---|
| **Next.js 14 (App Router)** | Fullstack-Framework: SSR, API-Routes, i18n, Routing aus einer Hand. Kein separater Backend-Server nötig. |
| **Tailwind CSS** | Utility-First, keine CSS-Dateien, konsistentes Design über alle Komponenten. |
| **SQLite (via Prisma)** | Zero-Admin-Datenbank. Ein Container, ein Prozess, keine externen Dienste. Perfekt für Einzel-Nutzer bis mittlere Instanzen. Migration zu PostgreSQL jederzeit möglich (Prisma-Datasource-Wechsel). |
| **Prisma** | Typensicherer Datenbankzugriff, auto-generierter Client, einfache Migrations. Wechsel zu PostgreSQL = eine Zeile in `schema.prisma`. |
| **NextAuth.js (Credentials)** | Einfach, passwortbasiert, JWT-Sessions. Reicht für MVP, erweiterbar um OAuth (Google, GitHub). |
| **next-intl** | Einzige i18n-Lösung die nativ mit Next.js App Router funktioniert. Typesafe, lazy-loaded, einfach erweiterbar. |
| **rss-parser** | Leichtgewichtig, unterstützt RSS 2.0 + Atom, bewährt. |
| **Vitest + RTL** | Schnell (esbuild), nativer ESM-Support, React Testing Library für Komponententests. |

## 2. Architektur-Prinzipien

### 2.1 Server First

- **Server Components** sind der Standard. Nur wenn Interaktivität, Lifecycle-Events oder Browser-APIs nötig sind → `'use client'`.
- Datenbank-Zugriffe und API-Calls gehören in Server Components oder API Routes – nicht in Client Components.
- Übersetzungen in Server Components via `getTranslations()`, in Client Components via `useTranslations()`.

### 2.2 i18n by Default

- **Kein hartcodierter Text** in Komponenten oder API-Responses. Jeder sichtbare String gehört in `src/messages/{locale}.json`.
- Namespaces nutzen (`home`, `auth`, `dashboard`, `common`, `nav`) um Übersicht zu behalten.
- Neue Sprache = neue JSON-Datei + Eintrag in `src/i18n/routing.ts`.

### 2.3 Test neben dem Code

- Tests liegen direkt neben der zu testenden Datei: `Component.test.tsx` neben `Component.tsx`.
- Mock-Dateien im Projekt-Root unter `__mocks__/`.
- Jedes neue Feature braucht Tests. Die Coverage soll mit jeder Version steigen, nicht fallen.

### 2.4 API Auth First – Default Deny

- Jede API-Route, die auf Nutzerdaten zugreift, beginnt mit `getServerSession(authOptions)`.
- Fehler werden mit eindeutigem HTTP-Statuscode und JSON-Body zurückgegeben.
- Keine sensiblen Daten in Fehlermeldungen.

### 2.5 Datenbank-Portabilität

- Kein SQLite-spezifisches SQL – immer Prisma Client.
- `skipDuplicates` wird nicht verwendet (SQLite-Unterstützung erst ab neueren Prisma-Versionen).
- Stattdessen: GUID-basierte Duplikatsprüfung in der Applikationsschicht.
- Schema-Änderungen via `prisma migrate dev` (nicht `db push`) für Produktion.

## 3. Projektstruktur

```
KoalaNews/
├── website/              # Next.js RSS-Reader (unabhängiges Modul)
│   ├── prisma/           # Datenbank-Schema + Migrationen
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/ # Locale-Routing (en, de, …)
│   │   │   └── api/      # API-Routes
│   │   ├── components/   # Wiederverwendbare UI-Komponenten
│   │   ├── lib/          # Business-Logik (prisma, auth, rss)
│   │   ├── messages/     # i18n Übersetzungen
│   │   └── i18n/         # Routing + Navigation (next-intl)
│   ├── __mocks__/        # Zentrale Test-Mocks
│   └── vitest.config.ts
├── app/                  # Mobile App (geplant – unabhängiges Modul)
└── .github/              # CI, Templates, Dependabot
```

Gemeinsame Typen zwischen `website/` und `app/` (sobald vorhanden) in einem `packages/shared/` Verzeichnis.

## 4. Qualitäts-Standards

### 4.1 Automatisierte Prüfungen (CI)

Jeder Push zu `main` und jeder PR durchläuft:

1. **ESLint** – keine Warnings
2. **TypeScript Check** – `tsc --noEmit` ohne Fehler
3. **Tests** – `vitest run`, alle Tests grün
4. **Build** – `next build` erfolgreich
5. **Docker Build** – Image wird gebaut (gepusht nur bei `main`)

### 4.2 Pre-Commit-Hooks (Husky)

Vor jedem Commit: ESLint + Prettier für gestagte Dateien (`lint-staged`).

### 4.3 Code-Review

Jeder PR braucht mindestens ein Review, bevor gemerged wird.

### 4.4 Dependencies

- Dependabot prüft wöchentlich npm-Updates, monatlich Docker & Actions.
- Major-Updates werden manuell reviewed und getestet.
- `npm audit` vor dem Mergen von Dependency-PRs.

## 5. Deployment & DevOps

### 5.1 Docker

- **Multi-Stage-Build** – minimale Image-Größe (production-only dependencies).
- **Non-Root User** – Container läuft als `nextjs` User.
- **SQLite unter `/data`** – Persistierung via Docker-Volume. Backup = Volume-Backup oder `cp`.
- **Keine Build-Tools im Production-Image** – Prisma-Client wird in der Builder-Stage generiert.

### 5.2 Umgebungsvariablen (12-Factor App)

Keine Config-Dateien in der Produktion. Alles über Env-Vars:

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Pfad zur SQLite-DB |
| `NEXTAUTH_SECRET` | JWT-Signing-Secret |
| `NEXTAUTH_URL` | Öffentliche URL der App |

### 5.3 CI/CD Pipeline

```
Push → main
  ├── (1) Test (Lint + Typecheck + Tests + Coverage)
  └── (2) Build & Push Docker Image (nur wenn Tests grün)
        └── ghcr.io/shik3i/koalanews/koalanews-website:{sha,latest}
```

### 5.4 Backup-Strategie

- SQLite-Datenbank liegt im Docker-Volume.
- Backup: `docker run --rm -v koalanews_data:/data -v $(pwd):/backup alpine cp /data/koalanews.db /backup/koalanews-$(date +%Y%m%d).db`
- Automatisierung: Cron-Job auf dem Host oder via orchestriertem Backup-Dienst.

## 6. Umgang mit diesem Dokument

- Dieses Dokument lebt im Repository und wird per PR geändert.
- Neue Technologie-Entscheidungen, Architektur-Änderungen oder Prozess-Anpassungen gehören hier rein.
- "Weil wir es schon immer so gemacht haben" ist kein Grund – jede Regel muss begründet sein.
