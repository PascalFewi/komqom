# Segment Scout

Explore Strava segments on an interactive map. Find segments by panning/zooming, see stats (length, grade, elevation, KOM times), and click to highlight them.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React + Vite + Leaflet)              │
│                                                 │
│  1. User clicks "Connect with Strava"           │
│  2. Redirect to Strava OAuth                    │
│  3. Strava redirects back with ?code=           │
│  4. Frontend sends code to Worker               │──── POST /exchange ──▶ ┌──────────────────┐
│  5. Worker returns tokens                       │◀── { access_token } ── │ Cloudflare Worker │
│  6. Frontend calls Strava API directly          │                        │ (token exchange)  │
│     - GET /segments/explore                     │                        └──────┬───────────┘
│     - GET /segments/{id}                        │                               │
│                                                 │                        POST /oauth/token
│  Map: Leaflet + CARTO Dark tiles                │                               │
│  Segments: Polylines from encoded polyline data │                               ▼
└─────────────────────────────────────────────────┘                     ┌──────────────────┐
                                                                       │   Strava API      │
                                                                       └──────────────────┘
```

## Setup

### 1. Strava API Application

Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create an app:
- **Authorization Callback Domain**: `localhost` (for dev), later your production domain
- Note your **Client ID** and **Client Secret**

### 2. Cloudflare Worker (Backend)

```bash
cd worker

# Install wrangler CLI
npm install -g wrangler

# Login to Cloudflare
npx wrangler login

# Set secrets
npx wrangler secret put STRAVA_CLIENT_ID      # paste your client ID
npx wrangler secret put STRAVA_CLIENT_SECRET   # paste your client secret
npx wrangler secret put ALLOWED_ORIGIN         # e.g. http://localhost:3000

# Deploy
npx wrangler deploy
```

Note the worker URL (e.g. `https://strava-auth.your-subdomain.workers.dev`).

### 3. Frontend

```bash
# Copy env template
cp .env.example .env

# Edit .env:
#   VITE_STRAVA_CLIENT_ID=your_client_id
#   VITE_AUTH_WORKER_URL=https://strava-auth.your-subdomain.workers.dev

# Install & run
npm install
npm run dev
```

Open `http://localhost:3000`.

## Project Structure

```
strava-scout/
├── index.html                  # HTML entry point
├── package.json
├── vite.config.js
├── .env.example                # Environment variables template
│
├── src/
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Root component (orchestrates auth + map + panel)
│   │
│   ├── components/
│   │   ├── AuthScreen.jsx      # Login screen with Strava connect button
│   │   ├── TopBar.jsx          # Navigation: type toggle, counter, logout
│   │   ├── MapView.jsx         # Leaflet map: renders polylines + markers
│   │   ├── SegmentPanel.jsx    # Bottom panel: horizontal scrollable card list
│   │   └── SegmentCard.jsx     # Individual segment card with stats
│   │
│   ├── hooks/
│   │   ├── useAuth.js          # OAuth flow: login, logout, token management
│   │   └── useSegments.js      # Segment loading, caching, selection
│   │
│   ├── lib/
│   │   ├── constants.js        # All config values, colors, keys
│   │   ├── strava.js           # Strava API client (explore, getById)
│   │   └── polyline.js         # Google Encoded Polyline decoder
│   │
│   └── styles/
│       └── index.css           # Global styles (dark theme)
│
└── worker/
    ├── index.js                # Cloudflare Worker (OAuth token exchange)
    └── wrangler.toml           # Worker deployment config
```

## Tech Choices

| Concern | Choice | Why |
|---------|--------|-----|
| Map | Leaflet + CARTO Dark | Free, lightweight, native polyline support |
| Segment rendering | `L.polyline()` | Segments are routes (lines), not areas |
| Geometry decoding | Custom decoder | Strava uses Google Encoded Polyline format |
| Auth backend | Cloudflare Worker | Free tier (100k req/day), one function, no server |
| Frontend | React + Vite | Fast DX, modular components |
