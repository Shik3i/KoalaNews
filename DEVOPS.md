# DevOps-Routine

## Vor jedem Push (egal welcher Branch)

Pflichtprogramm, das **immer** vor `git push` durchlaufen muss:

```bash
# 1. TypeScript prüfen
cd website
npx tsc --noEmit

# 2. ESLint
npx next lint

# 3. Alle Tests
npx vitest run

# 4. Build
npx next build
```

Erst wenn alle vier Schritte grün sind, darf gepusht werden.

## Vor einem Tag (Release)

Ein Tag (`v1.2.3`) wird nur dann gesetzt, wenn ein Release erstellt wird.
Vor `git tag` und `git push --tags` läuft eine erweiterte Routine:

### Schritt-für-Schritt

```bash
# 1. Lokalen Build und Tests (siehe oben)
cd website
npm run typecheck && npm run lint && npm run test:run && npm run build

# 2. Docker-Image lokal bauen
docker build -t koalanews-website:test .

# 3. Integrationstests mit Live-Container
../scripts/test-integration.sh

# 4. Wenn alles grün: Tag setzen
cd ..
git tag v1.2.3
git push origin main
git push origin v1.2.3
```

### Integrationstests

Das Script `scripts/test-integration.sh` macht folgendes:

1. Startet einen Docker-Container mit einer frischen SQLite-Datenbank
2. Wartet bis der Server bereit ist (Healthcheck)
3. Führt API-Tests per `curl` durch
4. Stoppt den Container wieder

```bash
# Manuell ausführen
../scripts/test-integration.sh
```

### Was beim Tag-Push passiert

Der Push eines `v*`-Tags löst GitHub Actions aus:

```
v1.2.3 pushed
  → CI: Tests (Lint + Typecheck + Unit Tests)
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
npm run dev                # Entwicklungsserver starten
npm run test               # Tests im Watch-Mode
npm run lint               # ESLint
npm run test:run -- --coverage  # Coverage vor dem Pushen checken
```

## Troubleshooting

### Docker-Container läuft nicht

```bash
docker logs koalanews-test  # Logs ansehen
docker exec -it koalanews-test sh  # In Container einsteigen
```

### SQLite-Datenbank zurücksetzen

```bash
rm -f website/prisma/dev.db
npx prisma db push
```

### Tests brauchen frischen Prisma-Client

```bash
cd website
npx prisma generate
```
