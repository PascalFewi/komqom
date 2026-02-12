import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useSegments } from './hooks/useSegments.js';
import AuthScreen from './components/AuthScreen.jsx';
import TopBar from './components/TopBar.jsx';
import MapView from './components/MapView.jsx';
import SegmentPanel from './components/SegmentPanel.jsx';
import { LS_ACTIVITY_TYPE } from './lib/constants.js';

export default function App() {
  const { token, loading: authLoading, error: authError, login, logout, isAuthenticated } = useAuth();
  const { segments, activeId, setActiveId, loading, error, loadForBounds, clearAll } = useSegments(token);

  const [activityType, setActivityType] = useState(
    () => localStorage.getItem(LS_ACTIVITY_TYPE) || 'riding'
  );
  const [mapBounds, setMapBounds] = useState(null);

  // Handle map move → load segments for new bounds
  const handleBoundsChange = useCallback(
    (bounds) => {
      setMapBounds(bounds);
      loadForBounds(bounds, activityType);
    },
    [loadForBounds, activityType]
  );

  // Switch activity type: clear segments, reload
  const handleTypeChange = useCallback(
    (type) => {
      setActivityType(type);
      localStorage.setItem(LS_ACTIVITY_TYPE, type);
      clearAll();
      if (mapBounds) {
        // Small delay to let state settle
        setTimeout(() => loadForBounds(mapBounds, type), 100);
      }
    },
    [clearAll, loadForBounds, mapBounds]
  );

  // ── Not authenticated → show login ─────────────────────────────
  if (!isAuthenticated) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

  // ── Authenticated → show map + segments ────────────────────────
  const segmentCount = Object.keys(segments).length;

  return (
    <div className="app-screen">
      <TopBar
        segmentCount={segmentCount}
        activityType={activityType}
        onTypeChange={handleTypeChange}
        onLogout={logout}
      />

      {error && <div className="error-toast">{error}</div>}

      <div className="main-content">
        <MapView
          segments={segments}
          activeId={activeId}
          onBoundsChange={handleBoundsChange}
          onSegmentClick={setActiveId}
        />

        <SegmentPanel
          segments={segments}
          activeId={activeId}
          onSelect={setActiveId}
          loading={loading}
          mapBounds={mapBounds}
        />
      </div>
    </div>
  );
}
