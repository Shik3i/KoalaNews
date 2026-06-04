# App – Planung

## Architektur-Überblick

Die App ist ein separater Client, der mit der gleichen Backend-API wie die Website kommuniziert.
Anders als die Website (Next.js SSR) läuft die App nativ auf dem Gerät und authentifiziert sich
per **JWT Bearer Token**.

## Auth-Flow

```
App                          Server
 │                             │
 ├── POST /api/auth/token ────→│  email + password
 │                             ├── verify credentials
 │                             ├── sign JWT (30d gültig)
 │←──── { token, user } ──────┤
 │                             │
 │  speichert Token lokal      │
 │                             │
 ├── GET /api/feeds ──────────→│  Authorization: Bearer <token>
 │                             ├── verify JWT
 │←──── { feeds, articles } ──┤
```

### Token-Format (JWT)

```json
{
  "sub": "user_cuid",
  "role": "USER",
  "iat": 1700000000,
  "exp": 1702592000
}
```

- Signiert mit `NEXTAUTH_SECRET` (gleicher Secret wie Website)
- Laufzeit: 30 Tage
- Kein Refresh-Token nötig für MVP (einfach neu einloggen)

## API-Endpunkte für die App

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/api/auth/token` | – | Login, gibt JWT zurück |
| GET | `/api/statistics` | – | Öffentliche Statistiken |
| GET | `/api/feeds` | JWT | Eigene Feeds + Artikel abrufen |
| POST | `/api/feeds` | JWT | Neuen RSS-Feed hinzufügen |
| DELETE | `/api/feeds/:id` | JWT | Feed entfernen |
| POST | `/api/feeds/fetch` | JWT | Feed manuell aktualisieren |

### Geplant für spätere Versionen

| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/api/auth/register` | Registrierung (nur wenn erlaubt) |
| PATCH | `/api/users/me` | Profil bearbeiten |
| GET | `/api/users/me/feeds` | Persönliche Feed-Konfiguration |

## Tech-Stack-Vorschlag

| Bereich | Technologie | Begründung |
|---|---|---|
| **Framework** | React Native (Expo) | Cross-Plattform (iOS + Android), eine Codebase |
| **Navigation** | Expo Router | Dateibasiertes Routing, ähnlich Next.js |
| **State** | Zustand + TanStack Query | Leichtgewichtig, Server-State-Caching |
| **HTTP** | fetch (built-in) | Keine zusätzliche Lib nötig, JWT im Header |
| **Storage** | expo-secure-store | Token sicher speichern (Keychain/Keystore) |
| **Styling** | NativeWind (Tailwind) | Gleiche Utility-First-Philosophie wie Website |
| **i18n** | expo-localization + i18next | Gleiche messages/JSON-Struktur wie Website |

## Projektstruktur (Vorschlag)

```
app/
├── app/                    # Expo Router Pages
│   ├── (public)/           # Ohne Auth
│   │   ├── index.tsx       # Public Feed
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (authenticated)/    # Mit Auth
│       ├── (tabs)/
│       │   ├── dashboard.tsx
│       │   ├── feeds.tsx
│       │   └── settings.tsx
├── src/
│   ├── api/                # API-Client mit JWT-Header
│   ├── components/         # Wiederverwendbare UI
│   ├── hooks/              # Custom Hooks
│   ├── store/              # Zustand Stores
│   └── i18n/               # Übersetzungen (shared mit website?)
├── app.json
└── package.json
```

## API-Client-Beispiel

```typescript
// src/api/client.ts
const BASE_URL = "https://koalanews.example.com/api";

async function request(path: string, options?: RequestInit) {
  const token = await SecureStore.getItemAsync("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request("/auth/token", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getFeeds: () => request("/feeds"),
  addFeed: (url: string) =>
    request("/feeds", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  deleteFeed: (id: string) =>
    request(`/feeds/${id}`, { method: "DELETE" }),
  getStatistics: () => request("/statistics"),
};
```

## UI-Screens (Wireframe)

### Public Feed (ohne Login)
- Liste der letzten 50 Artikel (alle Feeds)
- Tap → öffnet Link im Browser
- Header: Logo + Login/Register Button

### Login
- Email + Passwort + "Anmelden"-Button
- Link zu "Registrieren"

### Dashboard (mit Login)
- Liste der eigenen Feeds
- Jeder Feed: Titel, Artikelanzahl, Refresh-Button
- "Feed hinzufügen"-Button → Textfeld + URL

### Feed-Artikel
- Liste der Artikel eines Feeds
- Titel, Beschreibung, Datum
- Tap → öffnet Link im Browser

### Einstellungen
- Sprache (DE/EN)
- Abmelden

## API-Auth-Middleware (wiederverwendbar)

Für geschützte API-Routen wird ein Helfer verwendet:

```typescript
// website/src/lib/with-auth.ts
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export function withAuth(
  handler: (req: Request, userId: string, role: string) => Promise<Response>,
) {
  return async (request: Request) => {
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    return handler(request, payload.sub, payload.role);
  };
}
```

Dieses Pattern kann dann für alle App-spezifischen API-Routen verwendet werden.

## Deployment

- App wird via EAS Build (Expo Application Services) gebaut
- iOS: TestFlight → App Store
- Android: Google Play Console
- API-Base-URL ist konfigurierbar (Dev/Staging/Production)
