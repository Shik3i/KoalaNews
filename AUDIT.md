# KoalaNews Website Audit Remediation

Scope: `website/`

Status: All previously recorded findings have been rechecked and remediated in code. A second release audit for public hosting behind Caddy was performed before `v0.1.0`; newly found release blockers were remediated as well.

## Critical and High

- Fixed JWT fallback secret: production now requires `NEXTAUTH_SECRET`.
- Fixed Feed SSRF risk: feed URLs are normalized, DNS-checked, private hosts/IPs are blocked, redirects are bounded, timeouts and response size limits are enforced.
- Fixed mutating API CSRF exposure: shared auth wrapper validates same-origin browser requests and supports Bearer tokens.
- Fixed stale/weak API auth: `requireAuth`/`requireAdmin` now load the current DB user and reject banned users.
- Fixed missing auth-wrapper usage: feed, admin, statistics, OPML, account and read-state routes now use shared wrappers.
- Fixed admin self-lockout risks: admins cannot ban themselves or remove their own admin role server-side.
- Fixed arbitrary admin settings writes: settings updates are allowlisted.
- Fixed `scripts/init.mjs` syntax and safer admin logging.

## Medium and Low

- Replaced in-memory rate limiting with DB-backed `RateLimitEntry`.
- Added validation for auth, feed, admin user and settings payloads.
- Removed Google OAuth provider and UI automatically when Google credentials are absent.
- Hardened OAuth user creation with `upsert` and stable DB-backed JWT claims.
- Added Pepper hard failure when missing instead of silently hashing with an empty pepper.
- Added Prisma migration coverage for the nullable-password era and new audit-fix schema.
- Added feed dedupe, invalid-date handling, per-user feed URL uniqueness and refresh cooldown.
- Added pagination/search/filter/sort surfaces for public feed, dashboard feeds and admin users.
- Added OPML export, mark-all-read, password reset endpoints/pages and account settings for profile/password changes.
- Added safer external article links, loading/error/confirmation states, skeletons, admin search/filtering, responsive nav wrapping, accessible labels and a dark-mode toggle.
- Protected statistics data behind admin auth and removed unnecessary `force-dynamic` exports.
- Added Caddy/public-hosting hardening: HSTS/COOP/CORP headers, documented HTTPS `NEXTAUTH_URL`, and safer same-origin checks based on the forwarded Host.
- Added explicit 404 pages for global and localized routes.
- Restricted `/api/image` so it cannot be used as an arbitrary public image proxy; it serves only known article images or cached data.
- Added global `SourceFeed` dedupe so multiple users subscribing to the same RSS URL share one source and one article set.
- Added automatic and scriptable SQLite retention cleanup for articles, cached images, reset tokens, rate-limit entries and orphaned source feeds.
- Added DB indexes for cleanup and source-feed article queries.

## Verification

- `node node_modules/prisma/build/index.js generate`
- `node node_modules/typescript/bin/tsc --noEmit`
- `/Users/koala/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run`
- `/Users/koala/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build`

Note: The system `node`/native optional dependencies hit macOS code-signature issues for Rollup/Next SWC in this environment, so tests and build were run with the bundled Codex Node runtime.
