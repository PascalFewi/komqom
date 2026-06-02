import { STRAVA_API } from './constants.js';

/**
 * Lightweight Strava API client.
 * All methods throw on non-2xx responses with { status, message }.
 */

/**
 * Parse Strava's rate-limit headers into a structured object.
 * Each header is two comma-separated values: 15-minute, then daily.
 * Both the overall and the read-specific limits are considered; a window
 * counts as exceeded if either set has usage >= limit.
 * https://developers.strava.com/docs/rate-limits/
 */
function parseRateLimit(headers) {
  const pair = (name) => {
    const v = headers.get(name);
    if (!v) return null;
    const [a, b] = v.split(',').map((n) => parseInt(n.trim(), 10));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  };

  const limit = pair('x-ratelimit-limit');
  const usage = pair('x-ratelimit-usage');
  const readLimit = pair('x-readratelimit-limit');
  const readUsage = pair('x-readratelimit-usage');

  if (!usage && !readUsage) return null;

  const exceeded = (i) =>
    (!!usage && !!limit && usage[i] >= limit[i]) ||
    (!!readUsage && !!readLimit && readUsage[i] >= readLimit[i]);

  return {
    fifteenMinExceeded: exceeded(0),
    dailyExceeded: exceeded(1),
    usage,
    limit,
    readUsage,
    readLimit,
  };
}

async function request(endpoint, token) {
  const res = await fetch(`${STRAVA_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error(`Strava API error: ${res.status}`);
    error.status = res.status;
    if (res.status === 429) {
      error.rateLimit = parseRateLimit(res.headers);
    }
    throw error;
  }

  return res.json();
}

/**
 * Explore segments within map bounds.
 * https://developers.strava.com/docs/reference/#api-Segments-exploreSegments
 *
 * @param {string} token - Access token
 * @param {object} params
 * @param {[number,number,number,number]} params.bounds - [SW_lat, SW_lng, NE_lat, NE_lng]
 * @returns {Promise<Array>} Array of segment summaries
 */
function splitBoundsIntoQuadrants([swLat, swLng, neLat, neLng]) {
  const midLat = (swLat + neLat) / 2;
  const midLng = (swLng + neLng) / 2;
  return [
    [swLat, swLng, midLat, midLng],
    [swLat, midLng, midLat, neLng],
    [midLat, swLng, neLat, midLng],
    [midLat, midLng, neLat, neLng],
  ];
}

export async function exploreSegments(token, { bounds }) {
  const quadrants = splitBoundsIntoQuadrants(bounds);

  const requests = quadrants.flatMap((q) => {
    const boundsStr = q.map((b) => b.toFixed(6)).join(',');
    const base = `/segments/explore?bounds=${boundsStr}&activity_type=riding`;
    return [
      request(`${base}&sSurface=1`, token).then((r) => [r.segments || [], 'paved']),
      request(`${base}&sSurface=2`, token).then((r) => [r.segments || [], 'unpaved']),
    ];
  });

  const responses = await Promise.all(requests);

  const seen = new Set();
  const results = [];
  for (const [segs, surface] of responses) {
    for (const seg of segs) {
      if (!seen.has(seg.id)) {
        seen.add(seg.id);
        results.push({ ...seg, surface });
      }
    }
  }
  return results;
}

/**
 * Get the authenticated athlete's profile (includes weight in kg).
 */
export async function getAthlete(token) {
  return request('/athlete', token);
}

/**
 * Get detailed info for a single segment.
 * https://developers.strava.com/docs/reference/#api-Segments-getSegmentById
 *
 * @param {string} token - Access token
 * @param {number} segmentId
 * @returns {Promise<object>} Full segment details (distance, xoms, elevation, etc.)
 */
export async function getSegmentById(token, segmentId) {
  return request(`/segments/${segmentId}`, token);
}
