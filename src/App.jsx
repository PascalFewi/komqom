import React, { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useSegments } from './hooks/useSegments.js';
import AuthScreen from './components/AuthScreen.jsx';
import TopBar from './components/TopBar.jsx';
import MapView from './components/MapView.jsx';
import SegmentPanel from './components/SegmentPanel.jsx';
import { LS_ACTIVITY_TYPE } from './lib/constants.js';

export default function App() {
  const { getValidToken, loading: authLoading, error: authError, login, logout, isAuthenticated } = useAuth();

  // Pass getValidToken (not raw token) — useSegments calls it before every API request
  const { segments, activeId, setActiveId, loading, error, loadForBounds, clearAll } = useSegments(getValidToken);

  const [activityType, setActivityType] = useState(
    () => localStorage.getItem(LS_ACTIVITY_TYPE) || 'riding'
  );
  const [mapBounds, setMapBounds] = useState(null);

  const handleBoundsChange = useCallback(
    (bounds) => {
      setMapBounds(bounds);
      loadForBounds(bounds, activityType);
    },
    [loadForBounds, activityType]
  );

  const handleTypeChange = useCallback(
    (type) => {
      setActivityType(type);
      localStorage.setItem(LS_ACTIVITY_TYPE, type);
      clearAll();
      if (mapBounds) {
        setTimeout(() => loadForBounds(mapBounds, type), 100);
      }
    },
    [clearAll, loadForBounds, mapBounds]
  );

  if (!isAuthenticated) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

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