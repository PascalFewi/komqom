import { useState, useCallback, useRef } from 'react';
import { exploreSegments, getSegmentById } from '../lib/strava.js';

/**
 * Manages segment state: loading from API, storing, selecting.
 *
 * Segments are keyed by ID in a Map-like object.
 * Each entry has: { data (from explore), details (from getSegmentById) }
 *
 * The hook exposes:
 * - segments: object of all loaded segments
 * - activeId: currently selected segment
 * - loading: whether a fetch is in progress
 * - error: last error message
 * - loadForBounds(): trigger loading for map bounds
 * - setActiveId(): select a segment
 * - clearAll(): remove all segments (e.g. on activity type switch)
 */
export function useSegments(token) {
  const [segments, setSegments] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ref to track which segment IDs we've already fetched details for,
  // so we don't re-fetch during rapid map moves
  const detailsFetched = useRef(new Set());

  const loadForBounds = useCallback(
    async (bounds, activityType) => {
      if (!token) return;

      setLoading(true);
      setError(null);

      try {
        const newSegments = await exploreSegments(token, { bounds, activityType });

        setSegments((prev) => {
          const updated = { ...prev };
          let hasNew = false;

          for (const seg of newSegments) {
            if (!updated[seg.id]) {
              updated[seg.id] = { data: seg, details: null };
              hasNew = true;

              // Fire-and-forget: load details for new segments
              if (!detailsFetched.current.has(seg.id)) {
                detailsFetched.current.add(seg.id);
                loadDetails(seg.id, updated);
              }
            }
          }

          return hasNew ? updated : prev;
        });
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

  async function loadDetails(segmentId) {
    try {
      const details = await getSegmentById(token, segmentId);
      setSegments((prev) => {
        if (!prev[segmentId]) return prev;
        return {
          ...prev,
          [segmentId]: { ...prev[segmentId], details },
        };
      });
    } catch (err) {
      // Details are optional — fail silently
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
