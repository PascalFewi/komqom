import { AUTH_WORKER_URL } from './constants.js';

/**
 * Frontend API client for the Worker.
 *
 * The explore call still goes directly to Strava (in strava.js) because
 * it returns user-specific data (starred). Only detail calls go via Worker.
 */

/**
 * Get segment details — cache-first via Worker.
 *
 * @param {string} token   - User's Strava access token (forwarded to Strava on miss)
 * @param {number} segmentId
 * @returns {Promise<SegmentDetail>}
 */
export async function getSegmentDetail(token, segmentId) {
  const res = await fetch(`${AUTH_WORKER_URL}/api/segments/${segmentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = new Error(`Segment fetch failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Force refresh a segment from Strava, bypassing the cache.
 * Only succeeds if extracted_at is older than 7 days.
 *
 * @param {string} token
 * @param {number} segmentId
 * @returns {Promise<{ refreshAllowed: boolean } & SegmentDetail>}
 */
export async function refreshSegment(token, segmentId) {
  const res = await fetch(`${AUTH_WORKER_URL}/api/segments/${segmentId}/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = new Error(`Segment refresh failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}
