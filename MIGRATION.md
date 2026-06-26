# KoalaNews — Migration Plan: Next.js → Go + SvelteKit (Strangler Fig)

Status: **In Arbeit** — Fundament + RSS-Pipeline lauffähig (vertikaler Schnitt steht).

## Fortschritt

- [x] **Phase 0** — `website/` → `website_legacy/`; neues Go-Modul + Struktur (`cmd/`, `internal/`, `web/`).
- [x] **Phase 1** — sauberes `schema.sql`, `sqlc`-Setup + generierter Code, SQLite via `modernc.org/sqlite` (WAL, pure-Go), ID-Generator, Auto-Schema beim Start.
- [x] **Phase 2 (Kern)** — SSRF-sicherer HTTP-Client (IP-Pinning per `Dialer.Control`, schließt TOCTOU-Lücke), Limits (2 MB/3 MB/3 Redirects/15 s), `gofeed`-Parser, Image-Extraktion, GUID-Dedup, SourceFeed-Sharing, Image-Cache, Sync-Worker (`time.Ticker`). **Tests grün** (private IPs/localhost werden geblockt).
- [x] Lauffähiger Server: `/api/health`, `/api/articles?lang=`, embedded-Frontend mit SPA-Fallback. **Smoke-Test:** holt DE/EN/FR Default-Feeds, speichert 40/41/30 Artikel, liefert echte Daten. Binary **18 MB**.
- [x] Multi-stage `Dockerfile` (node→go→`distroless/static`), `.gitignore`, `.dockerignore`. Image-Build steht aus (Docker-Daemon war offline) — Ziel ~22–28 MB.

- [x] **Docker** — Image gebaut & im Container verifiziert: **25,3 MB**, serviert echte Daten, `/data` mit nonroot-Ownership.
- [x] **Phase 5 (Frontend-Basis)** — SvelteKit 5 + `adapter-static` + Tailwind 4, hand-gerollt. Public Feed-Page gegen `/api/articles`, ArticleCard, `/api/image`-Proxy (kein Hotlinking). **Customization-System** (CSS-Variablen): 5 Themes, freier Accent-Color-Picker, 3 Card-Styles, 3 Dichten, 3 Font-Größen, Content-Toggles — persistiert in localStorage. Build wird per go:embed ins Binary eingebettet. **Visuell verifiziert** (Screenshot).

### Scope-Entscheidung (2026-06-25)
- **Volle Feature-Parität** mit Legacy als Ziel.
- **Design komplett neu** (kein 1:1-Port der alten 7 Designs/8 Themes), ABER **extrem pro-User-anpassbar** — das Customization-System ist der Kern.

- [x] **Phase 3 (Auth)** — bcrypt (cost 12), DB-gestützte Sessions (HttpOnly-Cookie, revozierbar), DB-Rate-Limit, Same-Origin/CSRF-Schutz. Endpoints: register/login/logout/me. Erster User wird ADMIN. Frontend: Login/Register-Seiten, Auth-Store, Nav mit User-Status. **End-to-end verifiziert** (UI-Register → ADMIN-Session → Logout; Cross-Origin 403). User-Preference-Queries vorbereitet.

- [x] **Dashboard / Feed-Verwaltung** — per-User Feeds: add (SSRF-validiert, SourceFeed-Sharing → kein Doppel-Download), list, delete (Ownership-Check). Personalisierte Artikelliste: eingeloggte User sehen ihre Abos, Gäste den Locale-Feed (`?scope=public` erzwingt Locale). Endpoints: `GET/POST /api/feeds`, `DELETE /api/feeds/{id}`. Frontend: Dashboard mit Add-Form + Liste, Home-Page „Your feed". **End-to-end verifiziert** (Feed hinzufügen → Artikel erscheinen; dup 409, unauth 401, SSRF-localhost blocked). HTML-Entity-Decoding in Beschreibungen gefixt.

- [x] **Appearance-Prefs in DB** — `GET/PUT /api/preferences` (requireAuth), Enum-Sanitization. Frontend-Store synct bei eingeloggten Usern automatisch zum Server (fire-and-forget PUT) und lädt Server-Prefs bei Login/`fetchMe`. **Verifiziert:** Prefs gesetzt → localStorage gelöscht → Reload → UI kommt nachweislich vom Server (Sepia+Grün). localStorage bleibt Offline-Quelle für Gäste.

- [x] **Admin-Panel** — `GET /api/admin/users`, `PATCH /api/admin/users/{id}` (Rolle/Ban mit Self-Lockout-Schutz + Session-Revoke beim Bannen), `GET /api/admin/stats` (User/Feed/Source/Article-Counts + DB-Größe via SQLite-Pragmas). Frontend: Stats-Cards + User-Tabelle mit Promote/Demote/Ban/Unban. **End-to-end verifiziert** (UI-Ban → Status „banned" + Session weg; Self-Ban/Demote 403; non-admin 403).

- [x] **Read-State** — `article_reads` pro User. `POST/DELETE /api/articles/{id}/read`, `POST /api/articles/read-all`. Personalisierte Artikelliste liefert `read`-Flag (Subquery). Frontend: gelesene Artikel gedimmt, Per-Card Read/Unread-Toggle (optimistisch), „Mark all read" + Unread-Counter. **End-to-end verifiziert** (Toggle → Counter 10→9 + Dimming; Server-Persistenz nach Reload; unauth 401).

- [x] **OPML Import/Export** — `GET /api/feeds/opml` (Download, `text/x-opml`), `POST /api/feeds/opml/import` (parst verschachtelte Outlines, SSRF-validiert pro Feed, max 200, Dedup). Frontend: Export-Link + Import-File-Picker im Dashboard mit Ergebnis-Summary. **Verifiziert** (Round-trip A→B: added 2, Re-Import skipped 2; Export-Headers korrekt; unauth 401).

### Als Nächstes
- [ ] Weitere Parität: Statistiken (user-facing), Smart-Feeds, Kategorien, i18n, Backups.
- [ ] **Phase 4** — restliche API-Routes: feeds CRUD, categories, smart-feeds, statistics, admin (users/settings/backups), read-state, OPML.
- [ ] **Phase 5 (Rest)** — Seiten: login/register, dashboard (Feeds verwalten), settings, statistics, admin. i18n (de/en/fr).
- [ ] **Phase 6/7** — GFS-Backups (CLI + admin), Cutover via Reverse-Proxy.

---



## Ziel

Den aktuellen `website/` (Next.js 16 + Prisma 7 + libsql) ersetzen durch:

- **Backend:** Go (single binary), `net/http` + `chi`, `modernc.org/sqlite` (pure-Go, kein cgo)
- **DB-Layer:** `sqlc` (typsicheres SQL-Codegen) — kein ORM, kein Prisma
- **Frontend:** SvelteKit mit `adapter-static`, via `go:embed` ins Binary eingebettet
- **Image:** `scratch` / `distroless:static` → **~25 MB** statt geschätzt 300–500 MB

### Warum

- Prisma 7 + libsql native bindings sind die Quelle der letzten ~6 „fix"-Releases (siehe git log). Fällt komplett weg.
- Ein statisches Binary: kein Node-Runtime, keine handkopierten node_modules, kein DB-Init-Loop.
- RSS-Fetching als Goroutine + Ticker statt Next-API-Cron.

### Architektur (ein Prozess)

```
Browser ──GET /──────────────► Go ──► eingebettete Svelte-Assets (go:embed)
Browser ──GET /api/articles──► Go ──► SQLite (dedup. Artikel)
Browser ──POST /api/login───► Go ──► Session-Cookie (signed)
                                 └─ Goroutine (time.Ticker): alle N Min Feeds fetchen → SQLite
```

Das Frontend ist statisch *gebaut*, aber das Backend läuft permanent und macht Sync/Auth/DB/Cron. „Static" = die UI wird einmal beim Build kompiliert, nicht pro Request von Node gerendert.

---

## Phase 0 — Vorbereitung

- [ ] `website/` → `website_legacy/` umbenennen (läuft unverändert weiter, dient als Referenz + Fallback).
- [ ] Neues `website/` anlegen mit Struktur:
  ```
  website/
    cmd/koalanews/main.go        # entrypoint
    internal/
      db/        # sqlc-generierter Code + queries.sql + schema.sql
      rss/       # fetcher, SSRF-guard, parser, dedup
      auth/      # bcrypt+pepper, sessions, ratelimit
      api/       # http handlers (chi router)
      backup/    # VACUUM INTO + GFS retention
      config/    # env
    web/         # SvelteKit-Projekt (adapter-static)
    web/build/   # build output (go:embed-Quelle)
    Dockerfile
    sqlc.yaml
  ```
- [ ] DB-Strategie festlegen: **gleiche SQLite-Datei & gleiches Schema weiterverwenden** (`/data/koalanews.db`). Prisma-Migrations-SQL aus `website_legacy/prisma/migrations` als initiales `schema.sql` übernehmen → bestehende Daten (User, Pepper, Feeds) bleiben nutzbar. Kein Datenmigrations-Skript nötig.

## Phase 1 — Go-Fundament + DB

- [ ] `schema.sql` aus den Prisma-Migrations ableiten (1:1, gleiche Tabellen/Indizes/Constraints).
- [ ] `sqlc.yaml` + `queries.sql` für die Kern-Queries (Articles, Feeds, SourceFeeds, Users).
- [ ] SQLite-Connection: `modernc.org/sqlite`, WAL-Mode, `busy_timeout`, foreign_keys=on.
- [ ] cuid-Ersatz: bestehende IDs sind cuid-Strings. Neue IDs mit kompatiblem Generator (z. B. `github.com/nrednav/cuid2` oder schlicht weiter cuid-förmig) — **Format muss zu Bestands-FKs passen**, aber Kollisionsfreiheit reicht; cuid-Schema ist nicht erzwungen.
- [ ] Health-Check + DB-Init beim Start (Tabellen anlegen falls leer) — ersetzt `init.mjs` + den Dockerfile-`sqlite3`-Hack.

## Phase 2 — RSS-Pipeline (Kernstück, sicherheitskritisch)

Referenz: `website_legacy/src/lib/rss.ts`

- [ ] **SSRF-Guard** mit `net.Dialer.Control`: bei jedem Connect die *tatsächliche* Ziel-IP gegen Blocklist prüfen (10/8, 127/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7, fe80::/10, localhost). Schließt TOCTOU-Lücke der JS-Version.
- [ ] Limits 1:1: max 2 MB Feed, max 3 MB Image, max 3 Redirects (manuell), 15 s Timeout, User-Agent `KoalaNews/1.0`.
- [ ] Parser: `github.com/mmcdole/gofeed` (RSS+Atom, media:content/thumbnail, enclosure, content:encoded).
- [ ] Image-URL-Extraktion: enclosure → media:content → media:thumbnail → erstes `<img src>` aus content (gleiche Reihenfolge wie jetzt).
- [ ] **Dedup:** pro `SourceFeed` GUID-Set laden, nur neue Artikel `INSERT`, `UNIQUE(sourceFeedId, guid)` als Sicherung. SourceFeed-Sharing zwischen Usern beibehalten.
- [ ] Image-Cache: bis zu 12 neue Bilder pro Sync in `ImageCache` (bytes) vorab laden.
- [ ] **Sync-Worker:** `time.Ticker` (Intervall via env, z. B. `SYNC_INTERVAL=15m`) iteriert alle `SourceFeed`s mit Cooldown. Ersetzt `/api/cron/sync`.

## Phase 3 — Auth + Sicherheit

Referenz: `website_legacy/src/lib/auth.ts`, `with-auth.ts`, `rate-limit.ts`, `jwt.ts`

- [ ] **Pepper aus `Setting`-Tabelle** lesen, `bcrypt(password+pepper)` via `golang.org/x/crypto/bcrypt`. **Bestehenden Pepper-Wert NICHT neu generieren** → sonst alle Logins kaputt.
- [ ] Sessions: signed/encrypted Cookie (HttpOnly, Secure, SameSite=Lax). Optionaler Bearer-JWT für API (`golang-jwt`) wie heute `/api/auth/token`.
- [ ] DB-backed Rate-Limit (`RateLimitEntry`) — Login 10/min/IP, 20/15min/email.
- [ ] CSRF/Same-Origin-Check für mutierende Requests (Origin/Host gegen forwarded Host), banned-User-Block, Admin-Self-Lockout-Schutz.
- [ ] Password-Reset (Token-Hash, expiry) + Register + Account-Settings.
- [ ] Google OAuth: **als optional/später markiert** — nur nachbauen wenn genutzt (Legacy entfernt es automatisch ohne Credentials). Kandidat zum Weglassen im MVP.

## Phase 4 — API-Routes (29 Stück → chi handlers)

Gruppen (Legacy `src/app/api/`): articles (read/bulk-read/read-all), feeds (+[id], fetch, opml import/export), categories, smart-feeds, preferences, statistics, account, auth/*, admin (users, settings, database, backups), image, favicon, cron/sync.

- [ ] Reihenfolge: **public feed read → auth → feeds CRUD → preferences → admin → backups → statistics**. Jede Gruppe sofort gegen Legacy-Verhalten testen.
- [ ] `/api/image`: nur bekannte Artikel-Bilder / Cache ausliefern (kein offener Proxy) — Content-Type + Size-Check.

## Phase 5 — Frontend (SvelteKit, adapter-static)

Referenz: `website_legacy/src/app/[locale]/*`, `src/components/*`

- [ ] SvelteKit + `adapter-static`, Tailwind 4 (gleiche Tokens), `go:embed web/build`.
- [ ] i18n (de/en/fr): Messages aus `website_legacy/src/messages` übernehmen, leichte Lib (`svelte-i18n` o. Ä.) oder eigenes Mini-Store.
- [ ] Seiten: public feed, login/register, dashboard (feeds), appearance, settings, statistics, admin. Appearance-Prefs: eingeloggt via `/api/preferences`, Gast via localStorage (`koalanews:appearance`) — wie heute.
- [ ] Komponenten: ArticleCard, NavBar, ReaderModeModal, AppearanceProvider → Svelte-Pendants.

## Phase 6 — Backup + Ops

Referenz: `website_legacy/scripts/backup.mjs`, `src/lib/database-backups.ts`

- [ ] `VACUUM INTO` Snapshot + Entfernen von Article/ArticleRead/ImageCache + Re-VACUUM. GFS-Retention (7 daily / 5 weekly / 12 monthly). Als CLI-Subcommand (`koalanews backup`) + Admin-Endpoint.

## Phase 7 — Docker + Cutover

- [ ] Multi-stage Dockerfile: `node` baut Svelte → `golang` baut Binary (CGO_ENABLED=0) → `FROM scratch`/`distroless:static` + Binary + ca-certificates. Ziel **< 30 MB**.
- [ ] `docker-compose.yml`: gleiche Volume-Mounts (`/data`), gleiche `DATABASE_URL`-Semantik (file path).
- [ ] Parallelbetrieb: legacy auf altem Port, neu auf neuem; Reverse-Proxy schrittweise umrouten. Bei grünem Smoke-Test Cutover, `website_legacy` bleibt 1–2 Releases als Fallback.
- [ ] CI (`.github/workflows`): Go test/vet/build + Svelte build statt npm-only.

---

## Risiken / offene Punkte

- **Pepper-Übernahme** ist der gefährlichste Schritt — vor Cutover mit echtem Login gegen Prod-DB-Kopie testen.
- **cuid-ID-Kompatibilität** mit bestehenden FK-Strings verifizieren.
- **Google OAuth** — bestätigen ob überhaupt im Einsatz; sonst aus MVP streichen.
- **SSRF-Tests** portieren (`rss.test.ts`) — private IPs müssen weiter geblockt werden.
- Aufwand realistisch: kein Wochenend-Job. Auth+Admin+Backups+i18n+29 Routes sind ~70 % der Arbeit, nicht das RSS-Fetching.

## Vorgeschlagene Go-Dependencies

| Zweck | Paket |
|---|---|
| Router | `github.com/go-chi/chi/v5` |
| SQLite (pure-Go) | `modernc.org/sqlite` |
| SQL codegen | `sqlc` (build-time) |
| RSS/Atom | `github.com/mmcdole/gofeed` |
| bcrypt | `golang.org/x/crypto/bcrypt` |
| JWT (optional) | `github.com/golang-jwt/jwt/v5` |
| cuid | `github.com/nrednav/cuid2` |
