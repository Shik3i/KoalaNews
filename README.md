# KoalaNews

> RSS-Reader mit Mehrbenutzer-Support, i18n, lokaler SQLite-Persistenz und privacy-safe Asset-Caching.
>
> **Live-Demo:** [https://news.koalastuff.net](https://news.koalastuff.net)

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
-   **Deduplizierte Feed-Quellen** – derselbe RSS-Feed wird global nur einmal als `SourceFeed` gespeichert, auch wenn mehrere User ihn abonnieren
-   **Automatisches Parsing** – Artikel werden beim Hinzufügen & auf Knopfdruck serverseitig abgerufen
-   **Lokaler Artikel-/Bildcache** – RSS-Artikel und gecachte Bilder liegen in SQLite; Browser laden Bilder nur über die eigene App-Origin
-   **Appearance Settings** – Design-Presets, Card-Layouts, Dichte, Schriftgröße und sichtbare Felder pro User
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
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Die App läuft unter [http://localhost:3000](http://localhost:3000).

### Docker lokal

```bash
cd website
docker compose up --build
```

Die Datenbank wird in einem Docker-Volume (`koalanews_data`) persistiert.

### Cleanup / Retention

KoalaNews speichert RSS-Artikel und gecachte Bilder lokal in SQLite. Alte Daten werden per Cleanup-Script entfernt:

```bash
cd website
KOALANEWS_RETENTION_DAYS=14 npm run cleanup
```

`KOALANEWS_RETENTION_DAYS` defaultet auf `14`. Das Script loescht:

- Artikel mit `pubDate` oder `createdAt` aelter als Retention
- gecachte Bilder in `ImageCache` aelter als Retention
- abgelaufene Passwort-Reset-Tokens
- abgelaufene Rate-Limit-Eintraege
- verwaiste `SourceFeed`s ohne Subscriptions und Artikel

Die App startet den Cleanup außerdem automatisch opportunistisch bei Feed-Hinzufügen/Refresh. `KOALANEWS_CLEANUP_INTERVAL_HOURS` begrenzt diese Auto-Cleanup-Läufe, Default ist `24`. Für harte Betriebsfenster kann zusätzlich ein Host-Cron, systemd timer oder Orchestrator-Schedule `npm run cleanup` ausführen.

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
  -e KOALANEWS_RETENTION_DAYS="14" \
  ghcr.io/dein-user/KoalaNews/koalanews-website:latest
```

Die SQLite-Datenbank liegt unter `/data/koalanews.db` – einfach per Volume-Backup sichern.

## Umgebungsvariablen

| Variable          | Beschreibung                  | Beispiel                          |
| ----------------- | ----------------------------- | --------------------------------- |
| `DATABASE_URL`    | Pfad zur SQLite-Datenbank     | `file:/data/koalanews.db`         |
| `NEXTAUTH_SECRET` | Secrets für JWT-Tokens        | `openssl rand -base64 32`         |
| `NEXTAUTH_URL`    | Öffentliche URL der Anwendung | `https://koalanews.example.com`   |
| `ALLOW_REGISTRATION` | Registrierung erlauben | `true` |
| `ADMIN_EMAIL` | Optionaler initialer Admin | `admin@example.com` |
| `ADMIN_PASSWORD` | Passwort fuer initialen Admin | `change-me` |
| `GOOGLE_CLIENT_ID` | Optional; wenn leer, wird Google OAuth ausgeblendet | leer |
| `GOOGLE_CLIENT_SECRET` | Optional; wenn leer, wird Google OAuth ausgeblendet | leer |
| `KOALANEWS_RETENTION_DAYS` | Retention fuer Artikel/Bildcache in Tagen | `14` |
| `KOALANEWS_CLEANUP_INTERVAL_HOURS` | Mindestabstand fuer Auto-Cleanup-Läufe | `24` |

## Caddy Reverse Proxy

KoalaNews ist für Betrieb hinter Caddy gedacht. Wichtig:

- `NEXTAUTH_URL` muss auf die öffentliche HTTPS-URL zeigen.
- Die App sollte nur intern erreichbar sein, z.B. Caddy auf `localhost:3000` oder ein internes Docker-Netz.
- Caddy sollte den originalen `Host` weiterreichen (Default bei `reverse_proxy`).
- TLS endet bei Caddy; KoalaNews setzt zusätzlich Security-Header inklusive HSTS.

Minimalbeispiel:

```caddyfile
koalanews.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

## Privacy & externe Verbindungen

KoalaNews laedt im Browser keine externen CDNs, Google Fonts, Remote-Images oder Third-Party-Widgets. Alle Client-Assets muessen lokal/self-hosted sein. Die regulaeren externen Verbindungen sind serverseitig:

- RSS-Fetching fuer abonnierte Feeds
- optionaler OAuth-Provider, nur wenn explizit konfiguriert

Artikelbilder aus RSS-Feeds werden nicht direkt im Browser von Drittservern geladen. Stattdessen ruft `/api/image` die Quelle serverseitig SSRF-geschuetzt ab, speichert sie in SQLite (`ImageCache`) und liefert sie von der eigenen App-Origin aus.

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
