import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useSegments } from './hooks/useSegments.js';
import AuthScreen from './components/AuthScreen.jsx';
import TopBar from './components/TopBar.jsx';
import MapView from './components/MapView.jsx';
import SegmentPanel from './components/SegmentPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { getAthlete } from './lib/strava.js';
import { LS_GENDER_TYPE, LS_RIDER_MASS } from './lib/constants.js';

const DEFAULT_MASS = 75;

export default function App() {
  const { getValidToken, loading: authLoading, error: authError, login, logout, isAuthenticated } = useAuth();
  const { segments, activeId, setActiveId, loading, error, loadForBounds } = useSegments(getValidToken);

  const [genderType, setGenderType] = useState(
    () => localStorage.getItem(LS_GENDER_TYPE) || 'king'
  );
  const [riderMass, setRiderMass] = useState(
    () => parseFloat(localStorage.getItem(LS_RIDER_MASS)) || DEFAULT_MASS
  );
  const [stravaWeight, setStravaWeight] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);

  // On first auth: fetch athlete weight, auto-show settings if mass not yet stored
  useEffect(() => {
    if (!isAuthenticated) return;

    getValidToken().then((token) => {
      if (!token) return;
      getAthlete(token)
        .then((athlete) => {
          if (athlete.weight) {
            setStravaWeight(athlete.weight);
            if (!localStorage.getItem(LS_RIDER_MASS)) {
              setRiderMass(athlete.weight);
              setShowSettings(true);
            }
          } else if (!localStorage.getItem(LS_RIDER_MASS)) {
            setShowSettings(true);
          }
        })
        .catch(() => {
          if (!localStorage.getItem(LS_RIDER_MASS)) setShowSettings(true);
        });
    });
  }, [isAuthenticated]);

  const handleBoundsChange = useCallback(
    (bounds) => {
      setMapBounds(bounds);
      loadForBounds(bounds);
    },
    [loadForBounds]
  );

  const handleGenderChange = useCallback((gender) => {
    setGenderType(gender);
    localStorage.setItem(LS_GENDER_TYPE, gender);
  }, []);

  const handleSaveMass = useCallback((val) => {
    setRiderMass(val);
    localStorage.setItem(LS_RIDER_MASS, String(val));
    setShowSettings(false);
  }, []);

  if (!isAuthenticated) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

  const segmentCount = Object.keys(segments).length;

  return (
    <div className="app-screen">
      <TopBar
        segmentCount={segmentCount}
        genderType={genderType}
        onTypeChange={handleGenderChange}
        onSettingsOpen={() => setShowSettings(true)}
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
          genderType={genderType}
          riderMass={riderMass}
        />
      </div>

      {showSettings && (
        <SettingsModal
          riderMass={riderMass}
          stravaWeight={stravaWeight}
          onSave={handleSaveMass}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
