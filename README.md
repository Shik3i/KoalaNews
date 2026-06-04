# KoalaNews

> RSS-Reader mit Mehrbenutzer-Support, i18n und Docker-Deployment.

## Projektstruktur

```
KoalaNews/
├── website/          # Next.js RSS-Reader (Web-App)
├── app/              # Mobile App (geplant)
└── .github/workflows # CI/CD Pipeline
```

## Features

-   **Öffentlicher Feed** – ohne Anmeldung alle Artikel durchstöbern
-   **Benutzerkonten** – Registrierung & Login (E-Mail + Passwort)
-   **Eigene Feeds** – RSS-Feeds hinzufügen, verwalten, aktualisieren
-   **Automatisches Parsing** – Artikel werden beim Hinzufügen & auf Knopfdruck abgerufen
-   **Zweisprachig** – Deutsch & Englisch, erweiterbar um weitere Sprachen
-   **Docker** – Multi-Stage-Build, SQLite-Persistenz, CI-Pipeline

## Tech-Stack

| Bereich         | Technologie                              |
| --------------- | ---------------------------------------- |
| Framework       | Next.js 14 (App Router)                  |
| Sprache         | TypeScript                               |
| Styling         | Tailwind CSS                             |
| Datenbank       | SQLite via Prisma                        |
| Authentifizierung | NextAuth.js (Credentials)              |
| RSS-Parsing     | rss-parser                               |
| Internationalisierung | next-intl (DE + EN)              |
| Container       | Docker (Multi-Stage)                     |
| CI/CD           | GitHub Actions → ghcr.io                 |

## Lokale Entwicklung

### Voraussetzungen

-   Node.js 20+
-   npm

### Setup

```bash
cd website
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Die App läuft unter [http://localhost:3000](http://localhost:3000).

### Docker lokal

```bash
cd website
docker compose up --build
```

Die Datenbank wird in einem Docker-Volume (`koalanews_data`) persistiert.

## Deployment

1.  Repository auf GitHub pushen
2.  GitHub Actions baut automatisch das Docker-Image
3.  Image wird in die GitHub Container Registry (ghcr.io) gepusht
4.  Auf dem Zielserver:

```bash
docker run -d \
  --name koalanews \
  -p 3000:3000 \
  -v /pfad/zu/data:/data \
  -e NEXTAUTH_SECRET="geheimes-salt" \
  -e NEXTAUTH_URL="https://deine-domain.de" \
  ghcr.io/dein-user/KoalaNews/koalanews-website:latest
```

Die SQLite-Datenbank liegt unter `/data/koalanews.db` – einfach per Volume-Backup sichern.

## Umgebungsvariablen

| Variable          | Beschreibung                  | Beispiel                          |
| ----------------- | ----------------------------- | --------------------------------- |
| `DATABASE_URL`    | Pfad zur SQLite-Datenbank     | `file:/data/koalanews.db`         |
| `NEXTAUTH_SECRET` | Secrets für JWT-Tokens        | `openssl rand -base64 32`         |
| `NEXTAUTH_URL`    | Öffentliche URL der Anwendung | `https://koalanews.example.com`   |

## Internationalisierung

Sprachen werden in `website/src/messages/{locale}.json` gepflegt.
Eine neue Sprache hinzufügen:

1.  `website/src/messages/fr.json` anlegen
2.  `fr` in `website/src/i18n/routing.ts` in `locales` eintragen
3.  Fertig – die Sprache erscheint automatisch im Language-Switcher.

## Richtlinien

-   [CONTRIBUTING.md](CONTRIBUTING.md) – Entwicklungs-Workflow, Commit-Conventions, Setup
-   [GUIDELINES.md](GUIDELINES.md) – Architektur-Prinzipien, Tech-Stack-Begründung, Qualitäts-Standards

## Lizenz

MIT – siehe [LICENSE](LICENSE).
