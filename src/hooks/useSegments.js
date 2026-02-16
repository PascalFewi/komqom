import { useState, useCallback, useRef, useEffect } from 'react';
import { exploreSegments, getSegmentById } from '../lib/strava.js';
import { getCachedDetails, setCachedDetails } from '../lib/segmentCache.js';

/**
 * Manages segment state: loading from API, storing, selecting.
 *
 * Segments are keyed by ID in an object: { [id]: { data, details } }
 * - data: from the explore endpoint (polyline, name, etc.)
 * - details: from getSegmentById (KOM, efforts, etc.) — null until loaded
 *
 * Uses a 2×2 grid subdivision of the map bounds to fetch up to 40 segments.
 * Caches segment details in localStorage (30-day TTL) to reduce API calls.
 */
export function useSegments(token) {
  const [segments, setSegments] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const detailsFetched = useRef(new Set());

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const loadForBounds = useCallback(
    async (bounds, activityType) => {
      if (!tokenRef.current) return;

      setLoading(true);
      setError(null);

      try {
        // Split bounds into 2×2 grid and fetch all 4 quadrants in parallel
        const quadrants = splitBounds(bounds);
        const results = await Promise.all(
          quadrants.map((qBounds) =>
            exploreSegments(tokenRef.current, { bounds: qBounds, activityType })
              
          )
        );

        // Flatten and deduplicate by ID
        const seen = new Set();
        const explored = [];
        for (const batch of results) {
          for (const seg of batch) {
            if (!seen.has(seg.id)) {
              seen.add(seg.id);
              explored.push(seg);
            }
          }
        }

        // Separate into: cached (have details), needs fetch (no cache)
        const needFetch = [];
        const cachedSegments = [];

        for (const seg of explored) {
          if (detailsFetched.current.has(seg.id)) continue; // already handled
          detailsFetched.current.add(seg.id);

          const cached = getCachedDetails(seg.id);
          if (cached) {
            cachedSegments.push({ id: seg.id, data: seg, details: cached });
          } else {
            needFetch.push(seg);
          }
        }

        // Add all shells + cached details to state
        setSegments((prev) => {
          let updated = prev;

          for (const seg of explored) {
            if (!updated[seg.id]) {
              if (updated === prev) updated = { ...prev };
              updated[seg.id] = { data: seg, details: null };
            }
          }

          // Merge cached details immediately
          for (const { id, details } of cachedSegments) {
            if (updated[id]) {
              if (updated === prev) updated = { ...prev };
              updated[id] = { ...updated[id], details };
            }
          }

          return updated;
        });

        // Fire API fetches only for segments not in cache
        for (const seg of needFetch) {
          getSegmentById(tokenRef.current, seg.id)
            .then((details) => {
              // Store in cache for next session
              setCachedDetails(seg.id, details);

              setSegments((prev) => {
                if (!prev[seg.id]) return prev;
                return {
                  ...prev,
                  [seg.id]: { ...prev[seg.id], details },
                };
              });
            })
            .catch((err) => {
              detailsFetched.current.delete(seg.id);
              console.warn(`Detail fetch failed for segment ${seg.id}:`, err);
            });
        }
      } catch (err) {
        if (err.status === 401) {
          setError('Token abgelaufen. Bitte neu verbinden.');
        } else if (err.status === 429) {
          setError('Rate Limit erreicht. Bitte ein paar Minuten warten.');
        } else {
          setError('Fehler beim Laden der Segmente.');
        }
        console.error('Segment load error:', err);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const clearAll = useCallback(() => {
    setSegments({});
    setActiveId(null);
    detailsFetched.current.clear();
  }, []);

  return {
    segments,
    activeId,
    setActiveId,
    loading,
    error,
    loadForBounds,
    clearAll,
  };
}

/**
 * Split a bounds array into a 2×2 grid of sub-bounds.
 *
 * Input:  [swLat, swLng, neLat, neLng]
 * Output: array of 4 bounds in the same format
 */
function splitBounds(bounds) {
  const [swLat, swLng, neLat, neLng] = bounds;
  const midLat = (swLat + neLat) / 2;
  const midLng = (swLng + neLng) / 2;

  return [
    [swLat, swLng, midLat, midLng],
    [swLat, midLng, midLat, neLng],
    [midLat, swLng, neLat, midLng],
    [midLat, midLng, neLat, neLng],
  ];
}