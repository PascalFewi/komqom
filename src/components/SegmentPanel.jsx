import React, { useState, useEffect, useRef } from 'react';
import SegmentCard from './SegmentCard.jsx';
import { getSegmentDifficulty } from '../lib/segmentDifficulty.js';

const SCROLL_AMOUNT = 252; // card width + gap

export default function SegmentPanel({
  segments,
  activeId,
  onSelect,
  loading,
  mapBounds,
  genderType,
  riderMass,
  bikeProfile,
  onRefreshSegment,
}) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const visible = Object.entries(segments)
    .filter(([_, s]) => {
      if (mapBounds) {
        const [swLat, swLng, neLat, neLng] = mapBounds;
        const [lat, lng] = s.data.start_latlng;
        if (!(lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng)) return false;
      }
      if (bikeProfile === 'road' && s.surface === 'unpaved') return false;
      return true;
    })
    .map(([id, seg]) => ({
      id,
      seg,
      difficulty: getSegmentDifficulty(seg, riderMass, genderType, bikeProfile),
    }));

  visible.sort((a, b) => {
    if (a.difficulty.isValid !== b.difficulty.isValid) {
      return a.difficulty.isValid ? -1 : 1;
    }
    return (a.difficulty.difficultyScore || 0) - (b.difficulty.difficultyScore || 0);
  });

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    updateArrows();
  }, [visible.length]);

  useEffect(() => {
    if (activeId && scrollRef.current) {
      const card = scrollRef.current.querySelector(`[data-seg-id="${activeId}"]`);
      card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      setTimeout(updateArrows, 400);
    }
  }, [activeId]);

  function scrollBy(dir) {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_AMOUNT, behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  }

  return (
    <div className="panel">
      <button
        className={`panel-arrow panel-arrow-left ${canLeft ? '' : 'panel-arrow-hidden'}`}
        onClick={() => scrollBy(-1)}
      >&lt;</button>

      <div className="panel-scroll" ref={scrollRef} onScroll={updateArrows}>
        {loading && visible.length === 0 ? (
          <div className="status-msg">
            <span className="loading-spinner" /> Segmente laden…
          </div>
        ) : visible.length === 0 ? (
          <div className="status-msg">
            Keine Segmente im Sichtbereich. Karte bewegen oder reinzoomen.
          </div>
        ) : (
          visible.map(({ id, seg, difficulty }) => (
            <div key={id} data-seg-id={id}>
              <SegmentCard
                segment={seg}
                difficulty={difficulty}
                isActive={Number(id) === activeId}
                onClick={() => onSelect(Number(id))}
                genderType={genderType}
                onRefresh={onRefreshSegment ? () => onRefreshSegment(Number(id)) : undefined}
              />
            </div>
          ))
        )}
      </div>

      <button
        className={`panel-arrow panel-arrow-right ${canRight ? '' : 'panel-arrow-hidden'}`}
        onClick={() => scrollBy(1)}
      >&gt;</button>
    </div>
  );
}
