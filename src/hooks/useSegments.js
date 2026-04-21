import { useState, useCallback, useRef } from 'react';
import { exploreSegments } from '../lib/strava.js';
import { getSegmentDetail, refreshSegment } from '../lib/api.js';

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
      const token = await getValidToken();
      if (!token) return;

      setLoading(true);
      setError(null);

      try {
        const newSegments = await exploreSegments(token, { bounds });

        setSegments((prev) => {
          const updated = { ...prev };
          let hasNew = false;

          for (const seg of newSegments) {
            if (!updated[seg.id]) {
              const { surface, ...data } = seg;
              updated[seg.id] = { data, details: null, surface };
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

      const details = await getSegmentDetail(token, segmentId);
      setSegments((prev) => {
        if (!prev[segmentId]) return prev;
        return { ...prev, [segmentId]: { ...prev[segmentId], details } };
      });
    } catch (err) {
      console.warn(`Failed to load details for segment ${segmentId}`);
    }
  }

  const refreshDetail = useCallback(async (segmentId) => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const details = await refreshSegment(token, segmentId);
      if (details.refreshAllowed === false) return;
      setSegments((prev) => {
        if (!prev[segmentId]) return prev;
        return { ...prev, [segmentId]: { ...prev[segmentId], details } };
      });
    } catch (err) {
      console.warn(`Failed to refresh segment ${segmentId}:`, err);
    }
  }, [getValidToken]);

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
    refreshDetail,
    clearAll,
  };
}