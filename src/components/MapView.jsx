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
function getAdjustedBounds(map, panelOffset) {
  const b = map.getBounds();
  if (!panelOffset) return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
  const size = map.getSize();
  const adjustedSouth = map.containerPointToLatLng(
    L.point(size.x / 2, size.y - panelOffset)
  ).lat;
  return [adjustedSouth, b.getWest(), b.getNorth(), b.getEast()];
}

export default function MapView({ segments, activeId, onBoundsChange, onSegmentClick, bikeProfile, onZoomChange, panelOffset }) {
  const mapRef = useRef(null);         // Leaflet Map instance
  const containerRef = useRef(null);   // DOM element
  const layersRef = useRef({});        // segmentId -> { polyline, marker }
  const debounceRef = useRef(null);
  const panelOffsetRef = useRef(panelOffset || 0);
  panelOffsetRef.current = panelOffset || 0;

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
        boundsCallbackRef.current(getAdjustedBounds(map, panelOffsetRef.current));
      }, MOVE_DEBOUNCE);
    });

    // Try geolocation
    map.locate({ setView: true, maxZoom: 14 });

    mapRef.current = map;

    // Trigger initial load
    setTimeout(() => {
      boundsCallbackRef.current(getAdjustedBounds(map, panelOffsetRef.current));
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

  // ── Show/hide layers based on bike profile ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, layers] of Object.entries(layersRef.current)) {
      const seg = segments[id];
      if (!seg) continue;
      const isVisible = bikeProfile === 'mtb' || seg.surface !== 'unpaved';
      if (isVisible) {
        if (!map.hasLayer(layers.polyline)) layers.polyline.addTo(map);
        if (!map.hasLayer(layers.marker)) layers.marker.addTo(map);
      } else {
        layers.polyline.remove();
        layers.marker.remove();
      }
    }
  }, [bikeProfile, segments]);

  // ── Highlight active segment ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    for (const [id, layers] of Object.entries(layersRef.current)) {
      if (!map?.hasLayer(layers.polyline)) continue; // skip hidden layers
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

  // ── Report zoom level to parent ─────────────────────────────────
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  useEffect(() => {
    const interval = setInterval(() => {
      if (!mapRef.current) return;
      clearInterval(interval);
      const check = () => onZoomChangeRef.current?.(mapRef.current.getZoom() < MIN_ZOOM_FOR_SEGMENTS);
      mapRef.current.on('zoomend', check);
      check();
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} id="map" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

