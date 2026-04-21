/**
 * Segment Scout — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /api/segments/:id          Cache-first detail lookup
 *   POST /api/segments/:id/refresh  Force re-fetch from Strava
 *
 * Auth:
 *   User's Strava token must be passed as Authorization: Bearer <token>
 *   It is forwarded to Strava on cache miss — never stored.
 *
 * Environment (wrangler.toml + secrets):
 *   DB                  D1 database binding
 *   STRAVA_CLIENT_ID    For OAuth exchange
 *   STRAVA_CLIENT_SECRET
 *
 * Config:
 *   CACHE_TTL_DAYS      90   — re-fetch from Strava if older than this
 *   REFRESH_MIN_AGE_DAYS 7   — minimum age before user can force refresh
 */

// ─── Config ────────────────────────────────────────────────────────────────

const CACHE_TTL_DAYS       = 90;
const REFRESH_MIN_AGE_DAYS = 7;
const STRAVA_API           = 'https://www.strava.com/api/v3';

// ─── Router ────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      // ── OAuth ──────────────────────────────────────────────────────────
      if (parts[0] === 'exchange' && request.method === 'POST') {
        return await handleExchange(request, env);
      }
      if (parts[0] === 'refresh-token' && request.method === 'POST') {
        return await handleRefreshToken(request, env);
      }

      // ── Segment endpoints ──────────────────────────────────────────────
      if (parts[0] === 'api' && parts[1] === 'segments' && parts[2]) {
        const segmentId = parseInt(parts[2], 10);
        if (isNaN(segmentId)) return json({ error: 'Invalid segment ID' }, 400);

        // POST /api/segments/:id/refresh
        if (parts[3] === 'refresh' && request.method === 'POST') {
          return await handleRefresh(request, env, segmentId);
        }

        // GET /api/segments/:id
        if (request.method === 'GET') {
          return await handleSegment(request, env, segmentId);
        }
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};

// ─── GET /api/segments/:id ─────────────────────────────────────────────────

/**
 * Cache-first segment detail lookup.
 *
 * 1. Query D1 for segment
 * 2a. Found + fresh → return from cache
 * 2b. Found + stale OR not found → fetch Strava, upsert D1, return
 *
 * Response shape: SegmentDetail (see bottom of file)
 */
async function handleSegment(request, env, segmentId) {
  const cached = await getFromCache(env.DB, segmentId);

  if (cached && isFresh(cached.extracted_at)) {
    return json({ ...cached, _source: 'cache' });
  }

  // Need to fetch from Strava — requires user token
  const token = getBearerToken(request);
  if (!token) return json({ error: 'Authorization required' }, 401);

  const stale = !!cached; // already in DB but old
  const segment = await fetchFromStrava(segmentId, token);
  if (!segment) return json({ error: 'Segment not found on Strava' }, 404);

  await upsert(env.DB, segment);

  return json({ ...segment, _source: stale ? 'stale' : 'miss' });
}

// ─── POST /api/segments/:id/refresh ────────────────────────────────────────

/**
 * Force re-fetch from Strava regardless of cache age.
 * Only allowed if extracted_at is older than REFRESH_MIN_AGE_DAYS.
 *
 * Returns { refreshAllowed: false } if too recent.
 */
async function handleRefresh(request, env, segmentId) {
  const token = getBearerToken(request);
  if (!token) return json({ error: 'Authorization required' }, 401);

  const cached = await getFromCache(env.DB, segmentId);
  if (cached && !isRefreshable(cached.extracted_at)) {
    return json({
      refreshAllowed: false,
      message: `Segment was updated less than ${REFRESH_MIN_AGE_DAYS} days ago`,
      extractedAt: cached.extracted_at,
    });
  }

  const segment = await fetchFromStrava(segmentId, token);
  if (!segment) return json({ error: 'Segment not found on Strava' }, 404);

  await upsert(env.DB, segment);

  return json({ ...segment, refreshAllowed: true, _source: 'refresh' });
}

// ─── OAuth: POST /exchange ─────────────────────────────────────────────────

async function handleExchange(request, env) {
  const { code } = await request.json();
  if (!code) return json({ error: 'Missing code' }, 400);

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();
  if (!res.ok) return json({ error: data.message || 'Exchange failed' }, res.status);

  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
}

// ─── OAuth: POST /refresh-token ────────────────────────────────────────────

async function handleRefreshToken(request, env) {
  const { refresh_token } = await request.json();
  if (!refresh_token) return json({ error: 'Missing refresh_token' }, 400);

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) return json({ error: data.message || 'Refresh failed' }, res.status);

  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
}

// ─── D1 helpers ────────────────────────────────────────────────────────────

async function getFromCache(db, segmentId) {
  const result = await db
    .prepare('SELECT * FROM segments WHERE id = ?')
    .bind(segmentId)
    .first();
  return result || null;
}

async function upsert(db, segment) {
  await db
    .prepare(`
      INSERT INTO segments (
        id, name, distance, avg_grade, elev_difference,
        start_lat, start_lng, end_lat, end_lng,
        points, surface, total_elevation_gain,
        kom_time, qom_time, star_count, strava_href, extracted_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        name                 = excluded.name,
        distance             = excluded.distance,
        avg_grade            = excluded.avg_grade,
        elev_difference      = excluded.elev_difference,
        start_lat            = excluded.start_lat,
        start_lng            = excluded.start_lng,
        end_lat              = excluded.end_lat,
        end_lng              = excluded.end_lng,
        points               = excluded.points,
        surface              = excluded.surface,
        total_elevation_gain = excluded.total_elevation_gain,
        kom_time             = excluded.kom_time,
        qom_time             = excluded.qom_time,
        star_count           = excluded.star_count,
        strava_href          = excluded.strava_href,
        extracted_at         = excluded.extracted_at
    `)
    .bind(
      segment.id,
      segment.name,
      segment.distance,
      segment.avg_grade,
      segment.elev_difference,
      segment.start_lat,
      segment.start_lng,
      segment.end_lat,
      segment.end_lng,
      segment.points,
      segment.surface,
      segment.total_elevation_gain,
      segment.kom_time,
      segment.qom_time,
      segment.star_count,
      segment.strava_href,
      segment.extracted_at,
    )
    .run();
}

// ─── Strava fetch ───────────────────────────────────────────────────────────

/**
 * Fetches /segments/:id from Strava and normalizes to our DB shape.
 */
async function fetchFromStrava(segmentId, token) {
  const res = await fetch(`${STRAVA_API}/segments/${segmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const s = await res.json();

  return {
    id:                   s.id,
    name:                 s.name,
    distance:             s.distance,
    avg_grade:            s.average_grade,
    elev_difference:      s.elevation_high - s.elevation_low,
    start_lat:            s.start_latlng?.[0] ?? null,
    start_lng:            s.start_latlng?.[1] ?? null,
    end_lat:              s.end_latlng?.[0] ?? null,
    end_lng:              s.end_latlng?.[1] ?? null,
    points:               s.map?.polyline ?? null,
    surface:              normalizeSurface(s),
    total_elevation_gain: s.total_elevation_gain,
    kom_time:             formatTime(s.xoms?.kom),
    qom_time:             formatTime(s.xoms?.qom),
    star_count:           s.star_count ?? 0,
    strava_href:          s.xoms?.destination?.href ?? null,
    extracted_at:         Math.floor(Date.now() / 1000),
  };
}

// ─── Staleness ─────────────────────────────────────────────────────────────

function isFresh(extractedAt) {
  const ageSeconds = Math.floor(Date.now() / 1000) - extractedAt;
  return ageSeconds < CACHE_TTL_DAYS * 86400;
}

function isRefreshable(extractedAt) {
  const ageSeconds = Math.floor(Date.now() / 1000) - extractedAt;
  return ageSeconds >= REFRESH_MIN_AGE_DAYS * 86400;
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Strava doesn't reliably expose surface in the segment endpoint.
 * Best approximation: segment.segment_type or activity_type.
 * 'MTB', 'trail', 'dirt' → 'unpaved', everything else → 'paved'.
 */
function normalizeSurface(segment) {
  const type = (segment.segment_type || segment.activity_type || '').toLowerCase();
  if (['mtb', 'trail', 'dirt', 'gravel'].some(t => type.includes(t))) {
    return 'unpaved';
  }
  return 'paved';
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  // Strava xoms.kom already returns e.g. "5:32" — pass through
  return timeStr;
}

// ─── TypeScript-style interface docs (for frontend reference) ───────────────

/**
 * SegmentDetail — shape returned by GET /api/segments/:id
 *
 * {
 *   id:                   number
 *   name:                 string
 *   distance:             number        // meters
 *   avg_grade:            number        // percent
 *   elev_difference:      number        // meters
 *   start_lat:            number
 *   start_lng:            number
 *   end_lat:              number
 *   end_lng:              number
 *   points:               string        // encoded polyline
 *   surface:              'paved' | 'unpaved'
 *   total_elevation_gain: number
 *   kom_time:             string        // "5:32"
 *   qom_time:             string        // "6:11"
 *   star_count:           number
 *   strava_href:          string        // deep link
 *   extracted_at:         number        // Unix seconds
 *   _source:              'cache' | 'miss' | 'stale' | 'refresh'
 * }
 *
 * RefreshResponse (POST /api/segments/:id/refresh)
 * Same as SegmentDetail + { refreshAllowed: boolean }
 * If refreshAllowed === false, no other fields are present.
 */
