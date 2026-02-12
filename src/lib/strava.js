import { STRAVA_API } from './constants.js';

/**
 * Lightweight Strava API client.
 * All methods throw on non-2xx responses with { status, message }.
 */

async function request(endpoint, token) {
  const res = await fetch(`${STRAVA_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = new Error(`Strava API error: ${res.status}`);
    error.status = res.status;
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
 * @param {'riding'|'running'} params.activityType
 * @returns {Promise<Array>} Array of segment summaries
 */
export async function exploreSegments(token, { bounds, activityType }) {
  const boundsStr = bounds.map((b) => b.toFixed(6)).join(',');
  const data = await request(
    `/segments/explore?bounds=${boundsStr}&activity_type=${activityType}`,
    token
  );
  return data.segments || [];
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
