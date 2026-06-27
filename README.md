# KoalaNews

> RSS-Reader mit Mehrbenutzer-Support, i18n, lokaler SQLite-Persistenz und privacy-safe Asset-Caching.
>
> **Live-Demo:** [https://news.koalastuff.net](https://news.koalastuff.net)

## Projektstruktur

```
KoalaNews/
├── website/          # Go API + eingebettete SvelteKit-Web-App
├── website_legacy/   # deprecated Next.js-Referenz, nicht mehr aktiv
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
-   **Mehrsprachig** – Deutsch, Englisch & Französisch, erweiterbar um weitere Sprachen
-   **GFS-Backups** – SQLite-Backups neben der Datenbank, ohne Artikel-/Bildcache-Datenmuell
-   **Docker** – Multi-Stage-Build, SQLite-Persistenz, CI-Pipeline

## Tech-Stack

| Bereich         | Technologie                              |
| --------------- | ---------------------------------------- |
| Backend         | Go + chi                                 |
| Frontend        | SvelteKit 5 + adapter-static             |
| Sprache         | Go, TypeScript                           |
| Styling         | Tailwind CSS                             |
| Datenbank       | SQLite via sqlc + modernc.org/sqlite     |
| Authentifizierung | HttpOnly Sessions + bcrypt             |
| RSS-Parsing     | gofeed + SSRF-geschützter HTTP-Client    |
| Internationalisierung | eigener Svelte Store (DE + EN + FR) |
| Container       | Docker (Multi-Stage)                     |
| CI/CD           | GitHub Actions → ghcr.io                 |

## Lokale Entwicklung

### Voraussetzungen

-   Node.js 24+
-   npm
-   Go 1.26+

### Setup

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

Die App läuft unter [http://localhost:3000](http://localhost:3000).

### Docker lokal

```bash
cp .env.example .env
docker compose up --build
```

Die Datenbank wird in einem Docker-Volume (`koalanews_data`) persistiert.

### Cleanup / Retention

KoalaNews speichert RSS-Artikel und gecachte Bilder lokal in SQLite. Feeds werden vom Go-Sync-Worker regelmäßig aktualisiert; `SYNC_INTERVAL` steuert den Abstand.

### Backups

KoalaNews legt Grandfather/Father/Son-Backups im `backup/` Ordner neben der SQLite-Datenbank an. Artikel, Lesestatus und Bildcache werden aus der Backup-Kopie entfernt, weil diese Daten jederzeit aus den RSS-Feeds neu geladen werden können.

Backups können über die Admin-Seite erstellt und heruntergeladen werden. Vor einem Restore immer zuerst den Container stoppen.

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
  -e SESSION_KEY="$(openssl rand -base64 32)" \
  -e DATABASE_URL="file:/data/koalanews-v2.db" \
  -e SYNC_INTERVAL="15m" \
  ghcr.io/dein-user/KoalaNews/koalanews-website:latest
```

Die SQLite-Datenbank liegt unter `/data/koalanews-v2.db`; GFS-Backups liegen unter `/data/backup`. Der Dateiname ist absichtlich anders als im Legacy-Container, damit ein bestehendes `/data/koalanews.db` auf einer Alpha-VPS nicht gelöscht oder überschrieben werden muss.

## Umgebungsvariablen

| Variable          | Beschreibung                  | Beispiel                          |
| ----------------- | ----------------------------- | --------------------------------- |
| `DATABASE_URL`    | Pfad zur SQLite-Datenbank     | `file:/data/koalanews-v2.db`      |
| `SESSION_KEY`     | Secret für Session-Cookies    | `openssl rand -base64 32`         |
| `ADDR`            | Listen-Adresse                | `:3000`                           |
| `SYNC_INTERVAL`   | RSS-Sync-Intervall            | `15m`                             |

## Caddy Reverse Proxy

KoalaNews ist für Betrieb hinter Caddy gedacht. Wichtig:

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

Artikelbilder aus RSS-Feeds werden nicht direkt im Browser von Drittservern geladen. Stattdessen ruft `/api/image` die Quelle serverseitig SSRF-geschuetzt ab, speichert sie in SQLite (`ImageCache`) und liefert sie von der eigenen App-Origin aus.

## Internationalisierung

Sprachen werden in `website/web/src/lib/messages.ts` gepflegt.
Eine neue Sprache hinzufügen:

1.  Locale in `LOCALES` ergänzen
2.  Nachrichten im `messages`-Objekt ergänzen
3.  Label in `LOCALE_LABELS` eintragen

## Richtlinien

-   [CONTRIBUTING.md](CONTRIBUTING.md) – Entwicklungs-Workflow, Commit-Conventions, Setup
-   [GUIDELINES.md](GUIDELINES.md) – Architektur-Prinzipien, Tech-Stack-Begründung, Qualitäts-Standards

## Lizenz

MIT – siehe [LICENSE](LICENSE).
