/**
 * Simple localStorage cache for Strava segment details.
 *
 * Storage format per key "seg:{id}":
 *   { details: {...}, ts: timestamp }
 *
 * - TTL: 30 days (configurable)
 * - Gracefully handles quota errors and corrupt entries
 */

const PREFIX = 'seg:';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Get cached details for a segment ID.
 * Returns the details object or null if missing/expired.
 */
export function getCachedDetails(segmentId) {
  try {
    const raw = localStorage.getItem(PREFIX + segmentId);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) {
      // Expired — clean up
      localStorage.removeItem(PREFIX + segmentId);
      return null;
    }

    return entry.details;
  } catch {
    // Corrupt entry — remove it
    localStorage.removeItem(PREFIX + segmentId);
    return null;
  }
}

/**
 * Store details for a segment ID.
 */
export function setCachedDetails(segmentId, details) {
  try {
    localStorage.setItem(
      PREFIX + segmentId,
      JSON.stringify({ details, ts: Date.now() })
    );
  } catch {
    // localStorage full — evict oldest entries and retry once
    evictOldest(20);
    try {
      localStorage.setItem(
        PREFIX + segmentId,
        JSON.stringify({ details, ts: Date.now() })
      );
    } catch {
      // Still full — give up silently
    }
  }
}

/**
 * Remove all cached segments (e.g. for a manual cache clear).
 */
export function clearSegmentCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Evict the N oldest cached entries to free space.
 */
function evictOldest(n) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const { ts } = JSON.parse(localStorage.getItem(key));
      entries.push({ key, ts });
    } catch {
      // Corrupt — remove immediately
      localStorage.removeItem(key);
    }
  }

  entries
    .sort((a, b) => a.ts - b.ts)
    .slice(0, n)
    .forEach((e) => localStorage.removeItem(e.key));
}