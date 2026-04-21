# KOM QOM

Explore Strava cycling segments on an interactive map. Segments are sorted by a physics-based difficulty score so you can find the ones worth chasing.

Inspired by [stravanity](https://github.com/emilebres/stravanity) for understanding the Strava API request structure.

---

## How difficulty is calculated

The goal is to answer: *how hard is it to match the current KOM/QOM on this segment?*

### Step 1 — Required power

Given the segment's distance, elevation, and KOM time, the required average power is estimated from three physical forces:

```
P = (P_gravity + P_rolling + P_aero) / η
```

| Term | Formula | What it models |
|---|---|---|
| Gravity | `(m_total · g · v · grade)` | climbing resistance |
| Rolling | `(m_total · g · v · Crr · cos θ)` | tyre/surface friction |
| Aero drag | `(0.5 · ρ · CdA · v³)` | air resistance |

Constants vary by bike profile:

| Profile | CdA | Bike mass | Crr (paved / unpaved) |
|---|---|---|---|
| Road | 0.32 | 8 kg | 0.004 / 0.004 |
| MTB | 0.40 | 12 kg | 0.008 / 0.012 |

### Step 2 — Normalise against a reference athlete

Raw watts aren't comparable across segments of different durations. A 10-second sprint and a 60-minute climb can't be ranked on watts alone.

We normalise using **Coggan's 3-parameter Critical Power model** at "Good" level:

```
P_ref(t) = CP + (W' · (Pmax − CP)) / (W' + (Pmax − CP) · t)
```

With constants: `Pmax = 21.8 W/kg`, `CP = 4.77 W/kg`, `W' = 280 J/kg`.

### Step 3 — Difficulty score

```
score = (required W/kg / P_ref(t)) × 100
```

A score of 100 means the KOM exactly matches what a "Good" athlete can sustain for that duration. Higher = harder.

| Score | Label |
|---|---|
| > 130 | Extrem |
| 110–130 | Sehr schwer |
| 90–110 | Schwer |
| 70–90 | Moderat |
| 50–70 | Machbar |
| < 50 | Einfach |

---

## Setup

### 1. Strava API app

Create an app at [strava.com/settings/api](https://www.strava.com/settings/api). Set the **Authorization Callback Domain** to your production domain (or `localhost` for local dev). Note your **Client ID** and **Client Secret**.

### 2. Cloudflare Worker + D1

The Worker handles OAuth token exchange and caches segment details in a D1 SQLite database.

```bash
cd worker

npm install -g wrangler
npx wrangler login

# Create the D1 database
npx wrangler d1 create komqom-segments
# → copy the database_id into worker/wrangler.toml

# Run the schema migration
npx wrangler d1 execute komqom-segments --file=schema.sql

# Set secrets
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET

# Deploy
npx wrangler deploy
```

Configure `worker/wrangler.toml` with your domain in the `routes` array.

### 3. Frontend

```bash
cp .env.example .env
# Set VITE_STRAVA_CLIENT_ID in .env

npm install
npm run dev
```

---

## Project structure

```
├── src/
│   ├── components/       # MapView, SegmentPanel, SegmentCard, TopBar, …
│   ├── hooks/            # useAuth.js, useSegments.js
│   └── lib/              # strava.js (explore), api.js (Worker/cache), segmentDifficulty.js
│
└── worker/
    ├── worker.js         # Cloudflare Worker: OAuth + D1 cache proxy
    └── wrangler.toml     # Worker deployment config (routes, D1 binding)
```
