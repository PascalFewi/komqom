import { useState, useCallback, useRef, useEffect } from 'react';
import { exploreSegments, getSegmentById } from '../lib/strava.js';

/**
 * Manages segment state: loading from API, storing, selecting.
 *
 * Segments are keyed by ID in an object: { [id]: { data, details } }
 * - data: from the explore endpoint (polyline, name, etc.)
 * - details: from getSegmentById (KOM, efforts, etc.) — null until loaded
 *
 * Uses a 2×2 grid subdivision of the map bounds to fetch up to 40 segments
 * (Strava explore returns max 10 per call).
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
              .catch((err) => {
                // If one quadrant fails (e.g. rate limit), don't kill the others
                console.warn('Quadrant fetch failed:', err);
                return [];
              })
          )
        );

        // Flatten and deduplicate by ID (quadrants may overlap at edges)
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

        // 1) Figure out which segments are new
        const newSegments = [];
        for (const seg of explored) {
          if (!detailsFetched.current.has(seg.id)) {
            newSegments.push(seg);
            detailsFetched.current.add(seg.id);
          }
        }

        // 2) Add shells to state
        setSegments((prev) => {
          let updated = prev;
          for (const seg of explored) {
            if (!updated[seg.id]) {
              if (updated === prev) updated = { ...prev };
              updated[seg.id] = { data: seg, details: null };
            }
          }
          return updated;
        });

        // 3) Fire detail fetches for new segments
        for (const seg of newSegments) {
          getSegmentById(tokenRef.current, seg.id)
            .then((details) => {
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
 *
 *   ┌────────┬────────┐
 *   │  NW    │  NE    │
 *   ├────────┼────────┤
 *   │  SW    │  SE    │
 *   └────────┴────────┘
 */
function splitBounds(bounds) {
  const [swLat, swLng, neLat, neLng] = bounds;
  const midLat = (swLat + neLat) / 2;
  const midLng = (swLng + neLng) / 2;

  return [
    [swLat, swLng, midLat, midLng],   // SW quadrant
    [swLat, midLng, midLat, neLng],   // SE quadrant
    [midLat, swLng, neLat, midLng],   // NW quadrant
    [midLat, midLng, neLat, neLng],   // NE quadrant
  ];
}