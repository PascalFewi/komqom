import React, { useState, useEffect, useRef } from 'react';
import SegmentCard from './SegmentCard.jsx';

/**
 * Bottom panel showing segment cards in a horizontal scroll.
 *
 * Features:
 * - Expandable (click header to toggle)
 * - Filters segments to those visible in current map bounds
 * - Sorts by grade (flattest first)
 * - Auto-scrolls to active card
 * - Calls onResize when expanded/collapsed (so map can invalidateSize)
 *
 * Props:
 * - segments: { [id]: { data, details } }
 * - activeId: number | null
 * - onSelect(id): select a segment
 * - loading: boolean
 * - mapBounds: [SW_lat, SW_lng, NE_lat, NE_lng] | null
 * - onResize(): called after panel toggle
 */
export default function SegmentPanel({
  segments,
  activeId,
  onSelect,
  loading,
  mapBounds,
  onResize,
}) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);

  // Filter to visible segments (within current map bounds)
  const visible = Object.entries(segments).filter(([_, s]) => {
    if (!mapBounds) return true;
    const [swLat, swLng, neLat, neLng] = mapBounds;
    const [lat, lng] = s.data.start_latlng;
    return lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng;
  });

  // Sort by absolute grade ascending (flattest first)
  visible.sort(
    (a, b) => Math.abs(a[1].data.avg_grade || 0) - Math.abs(b[1].data.avg_grade || 0)
  );

  // Auto-scroll to active card
  useEffect(() => {
    if (activeId && scrollRef.current) {
      const card = scrollRef.current.querySelector(`[data-seg-id="${activeId}"]`);
      card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeId]);

  function toggleExpanded() {
    setExpanded((e) => !e);
    // Give CSS transition time, then tell parent to resize map
    setTimeout(() => onResize?.(), 350);
  }

  return (
    <div className={`panel ${expanded ? 'expanded' : ''}`}>
      <div className="panel-header" onClick={toggleExpanded}>
        <span className="panel-title">
          Segments{' '}
          {visible.length > 0 && (
            <span className="panel-count">({visible.length} sichtbar)</span>
          )}
        </span>
        <span className="panel-toggle">▲</span>
      </div>

      <div className="panel-scroll" ref={scrollRef}>
        {loading && visible.length === 0 ? (
          <div className="status-msg">
            <span className="loading-spinner" /> Segmente laden…
          </div>
        ) : visible.length === 0 ? (
          <div className="status-msg">
            Keine Segmente im Sichtbereich. Karte bewegen oder reinzoomen.
          </div>
        ) : (
          visible.map(([id, seg]) => (
            <div key={id} data-seg-id={id}>
              <SegmentCard
                segment={seg}
                isActive={Number(id) === activeId}
                onClick={() => onSelect(Number(id))}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
