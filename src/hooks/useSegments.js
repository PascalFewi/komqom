import { useState, useCallback, useRef } from 'react';
import { exploreSegments, getSegmentById } from '../lib/strava.js';

/**
 * Manages segment state: loading from API, storing, selecting.
 *
 * Key change: uses getValidToken() before every API call,
 * which automatically refreshes expired tokens.
 */
export function useSegments(getValidToken) {
  const [segments, setSegments] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const detailsFetched = useRef(new Set());

  const loadForBounds = useCallback(
    async (bounds) => {
      // Get a valid (possibly refreshed) token before calling Strava
      const token = await getValidToken();
      if (!token) return; // getValidToken triggers logout if refresh fails

      setLoading(true);
      setError(null);

      try {
        const newSegments = await exploreSegments(token, { bounds });

        setSegments((prev) => {
          const updated = { ...prev };
          let hasNew = false;

          for (const seg of newSegments) {
            if (!updated[seg.id]) {
              updated[seg.id] = { data: seg, details: null };
              hasNew = true;

              if (!detailsFetched.current.has(seg.id)) {
                detailsFetched.current.add(seg.id);
                loadDetails(seg.id);
              }
            }
          }

          return hasNew ? updated : prev;
        });
      } catch (err) {
        if (err.status === 401) {
          // Token was invalid despite refresh attempt — will be caught on next cycle
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
    [getValidToken]
  );

  async function loadDetails(segmentId) {
    try {
      const token = await getValidToken();
      if (!token) return;

      const details = await getSegmentById(token, segmentId);
      setSegments((prev) => {
        if (!prev[segmentId]) return prev;
        return {
          ...prev,
          [segmentId]: { ...prev[segmentId], details },
        };
      });
    } catch (err) {
      console.warn(`Failed to load details for segment ${segmentId}`);
    }
  }

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