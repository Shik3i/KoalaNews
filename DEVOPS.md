# DevOps-Routine

## Vor jedem Push (egal welcher Branch)

Pflichtprogramm, das **immer** vor `git push` durchlaufen muss:

```bash
# 1. Frontend prüfen und bauen
cd website/web
npm run check
npm run build

# 2. Backend prüfen und testen
cd ..
go vet ./...
go test ./...
```

Erst wenn alle Schritte grün sind, darf gepusht werden.

## Vor einem Tag (Release)

Ein Tag (`v1.2.3`) wird nur dann gesetzt, wenn ein Release erstellt wird.
Vor `git tag` und `git push --tags` läuft eine erweiterte Routine:

### Schritt-für-Schritt

```bash
# 1. Lokalen Build und Tests (siehe oben)
cd website/web && npm run check && npm run build
cd .. && go vet ./... && go test ./...

# 2. Docker-Image lokal bauen
cd ..
docker build -t koalanews-website:test website

# 3. Wenn alles grün: Tag setzen
git tag v1.2.3
git push origin main
git push origin v1.2.3
```

### Integrationstests

Für einen manuellen Smoke-Test: Container mit frischer SQLite-Datenbank starten, `/api/health` prüfen, User registrieren, Feed hinzufügen und Home/Dashboard im Browser öffnen.

### Was beim Tag-Push passiert

Der Push eines `v*`-Tags löst GitHub Actions aus:

```
v1.2.3 pushed
  → CI: Go vet/test
  → CI: Docker Build & Push zu ghcr.io
  → Image: ghcr.io/shik3i/koalanews/koalanews-website:1.2.3
  → Image: ghcr.io/shik3i/koalanews/koalanews-website:1.2
  → Image: ghcr.io/shik3i/koalanews/koalanews-website:latest
```

## CI/CD Pipeline (GitHub Actions)

| Event | Aktion |
|---|---|
| Push auf `main` (ohne Tag) | Nur Tests (kein Docker-Build) |
| Push mit Tag `v*` | Tests → Docker Build & Push |
| `workflow_dispatch` (manuell) | Tests → Docker Build & Push |

Hinweis: Die Pipeline ist in `.github/workflows/docker-build.yml` konfiguriert.
Sie wird nur durch Tags mit `v`-Prefix ausgelöst.

## Tägliche Entwicklung

Für die tägliche Arbeit reicht:

```bash
cd website
go run ./cmd/koalanews     # Backend starten

cd website/web
npm run dev                # Frontend-Devserver starten
npm run check              # Svelte/TypeScript prüfen
```

## Troubleshooting

### Docker-Container läuft nicht

```bash
docker logs koalanews-test  # Logs ansehen
```

### SQLite-Datenbank zurücksetzen

```bash
rm -f website/koalanews.db
go run ./cmd/koalanews
```

### Frontend-Build neu einbetten

```bash
cd website/web
npm run build
cd ..
go build -o /tmp/koalanews ./cmd/koalanews
```
