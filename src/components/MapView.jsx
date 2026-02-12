import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { decodePolyline } from '../lib/polyline.js';
import {
  TILE_URL,
  TILE_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM_FOR_SEGMENTS,
  COLOR_DEFAULT,
  COLOR_ACTIVE,
  MOVE_DEBOUNCE,
} from '../lib/constants.js';

/**
 * Leaflet map component.
 *
 * Responsibilities:
 * - Initialize Leaflet map with dark CARTO tiles
 * - Draw segment polylines + start markers
 * - Highlight active segment
 * - Emit bounds on map move (debounced)
 * - Show zoom hint when too far out
 *
 * Props:
 * - segments: { [id]: { data, details } }
 * - activeId: currently highlighted segment ID
 * - onBoundsChange(bounds): called with [SW_lat, SW_lng, NE_lat, NE_lng]
 * - onSegmentClick(id): called when a segment is clicked on the map
 */
export default function MapView({ segments, activeId, onBoundsChange, onSegmentClick }) {
  const mapRef = useRef(null);         // Leaflet Map instance
  const containerRef = useRef(null);   // DOM element
  const layersRef = useRef({});        // segmentId -> { polyline, marker }
  const debounceRef = useRef(null);

  // ── Initialize map ──────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return; // already initialized

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Debounced move handler
    map.on('moveend', () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (map.getZoom() < MIN_ZOOM_FOR_SEGMENTS) return;
        const b = map.getBounds();
        onBoundsChange([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
      }, MOVE_DEBOUNCE);
    });

    // Try geolocation
    map.locate({ setView: true, maxZoom: 14 });

    mapRef.current = map;

    // Trigger initial load
    setTimeout(() => {
      const b = map.getBounds();
      onBoundsChange([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    }, 600);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // intentionally stable — onBoundsChange is captured via ref below

  // Keep onBoundsChange ref stable for the effect above
  const boundsCallbackRef = useRef(onBoundsChange);
  boundsCallbackRef.current = onBoundsChange;

  // ── Sync segments to map layers ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Add new segments
    for (const [id, seg] of Object.entries(segments)) {
      if (layersRef.current[id]) continue; // already drawn

      const coords = decodePolyline(seg.data.points);

      const polyline = L.polyline(coords, {
        color: COLOR_DEFAULT,
        weight: 3,
        opacity: 0.8,
      }).addTo(map);

      const marker = L.circleMarker(seg.data.start_latlng, {
        radius: 5,
        fillColor: COLOR_DEFAULT,
        fillOpacity: 1,
        stroke: true,
        color: '#fff',
        weight: 1.5,
      }).addTo(map);

      marker.bindTooltip(seg.data.name, {
        className: 'segment-tooltip',
        direction: 'top',
        offset: [0, -8],
      });

      // Click handlers
      const handleClick = () => onSegmentClick(Number(id));
      polyline.on('click', handleClick);
      marker.on('click', handleClick);

      layersRef.current[id] = { polyline, marker };
    }

    // Remove segments that no longer exist (e.g. after clearAll)
    for (const id of Object.keys(layersRef.current)) {
      if (!segments[id]) {
        layersRef.current[id].polyline.remove();
        layersRef.current[id].marker.remove();
        delete layersRef.current[id];
      }
    }
  }, [segments, onSegmentClick]);

  // ── Highlight active segment ────────────────────────────────────
  useEffect(() => {
    for (const [id, layers] of Object.entries(layersRef.current)) {
      const isActive = Number(id) === activeId;
      layers.polyline.setStyle({
        color: isActive ? COLOR_ACTIVE : COLOR_DEFAULT,
        weight: isActive ? 5 : 3,
        opacity: isActive ? 1 : 0.8,
      });
      layers.marker.setStyle({ fillColor: isActive ? COLOR_ACTIVE : COLOR_DEFAULT });
      layers.marker.setRadius(isActive ? 7 : 5);

      if (isActive) {
        layers.polyline.bringToFront();
        layers.marker.bringToFront();
      }
    }
  }, [activeId]);

  // ── Expose invalidateSize for parent (panel toggle) ─────────────
  // The parent can call this via a ref if needed; for now we also
  // watch for window resize.
  useEffect(() => {
    const handleResize = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Zoom hint ───────────────────────────────────────────────────
  const [showZoomHint, setShowZoomHint] = useZoomHint(mapRef);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div ref={containerRef} id="map" style={{ width: '100%', height: '100%' }} />
      {showZoomHint && (
        <div className="zoom-hint">Zoom in closer to load segments</div>
      )}
    </div>
  );
}

/**
 * Tiny hook to track whether the zoom hint should be visible.
 */
function useZoomHint(mapRef) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (mapRef.current) {
        setShow(mapRef.current.getZoom() < MIN_ZOOM_FOR_SEGMENTS);
      }
    };

    // Poll until map exists, then attach listener
    const interval = setInterval(() => {
      if (mapRef.current) {
        clearInterval(interval);
        mapRef.current.on('zoomend', check);
        check();
      }
    }, 200);

    return () => {
      clearInterval(interval);
      mapRef.current?.off('zoomend', check);
    };
  }, []);

  return [show, setShow];
}

// Need useState import for the zoom hint hook
import { useState } from 'react';
