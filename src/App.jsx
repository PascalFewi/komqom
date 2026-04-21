import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useSegments } from './hooks/useSegments.js';
import AuthScreen from './components/AuthScreen.jsx';
import TopBar from './components/TopBar.jsx';
import MapView from './components/MapView.jsx';
import SegmentPanel from './components/SegmentPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StatusBar from './components/StatusBar.jsx';
import { getAthlete } from './lib/strava.js';
import { LS_GENDER_TYPE, LS_RIDER_MASS, LS_BIKE_PROFILE } from './lib/constants.js';

const DEFAULT_MASS = 75;

export default function App() {
  const { getValidToken, loading: authLoading, error: authError, login, logout, isAuthenticated } = useAuth();
  const { segments, activeId, setActiveId, loading, error, loadForBounds, refreshDetail } = useSegments(getValidToken);

  const [genderType, setGenderType] = useState(
    () => localStorage.getItem(LS_GENDER_TYPE) || 'king'
  );
  const [bikeProfile, setBikeProfile] = useState(
    () => localStorage.getItem(LS_BIKE_PROFILE) || 'road'
  );
  const [riderMass, setRiderMass] = useState(
    () => parseFloat(localStorage.getItem(LS_RIDER_MASS)) || DEFAULT_MASS
  );
  const [stravaWeight, setStravaWeight] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);
  const [pendingSearch, setPendingSearch] = useState(false);
  const hasSearchedOnce = useRef(false);
  const [zoomTooLow, setZoomTooLow] = useState(false);
  const [displayError, setDisplayError] = useState(null);

  // Auto-dismiss API errors after 5 s; zoom hint persists until resolved
  useEffect(() => {
    if (!error) { setDisplayError(null); return; }
    setDisplayError(error);
    const t = setTimeout(() => setDisplayError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const statusMessage = displayError
    ? { type: 'error', text: displayError }
    : zoomTooLow
    ? { type: 'info', text: 'Zoom in closer to load segments' }
    : null;

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
      if (!hasSearchedOnce.current) {
        hasSearchedOnce.current = true;
        loadForBounds(bounds);
      } else {
        setPendingSearch(true);
      }
    },
    [loadForBounds]
  );

  const handleSearchHere = useCallback(() => {
    if (!mapBounds) return;
    setPendingSearch(false);
    loadForBounds(mapBounds);
  }, [mapBounds, loadForBounds]);

  const handleGenderChange = useCallback((gender) => {
    setGenderType(gender);
    localStorage.setItem(LS_GENDER_TYPE, gender);
  }, []);

  const handleBikeProfileChange = useCallback((profile) => {
    setBikeProfile(profile);
    localStorage.setItem(LS_BIKE_PROFILE, profile);
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
        bikeProfile={bikeProfile}
        onBikeProfileChange={handleBikeProfileChange}
        onSettingsOpen={() => setShowSettings(true)}
        onLogout={logout}
      />

      <StatusBar message={statusMessage} />

      <div className="main-content">
        {pendingSearch && !loading && !zoomTooLow && !displayError && (
          <button className="search-here-btn" onClick={handleSearchHere}>
            In diesem Bereich suchen
          </button>
        )}
        {loading && hasSearchedOnce.current && (
          <div className="search-here-btn search-here-loading">
            <span className="loading-spinner" /> Segmente laden…
          </div>
        )}

        <MapView
          segments={segments}
          activeId={activeId}
          onBoundsChange={handleBoundsChange}
          onSegmentClick={setActiveId}
          bikeProfile={bikeProfile}
          onZoomChange={setZoomTooLow}
        />

        <SegmentPanel
          segments={segments}
          activeId={activeId}
          onSelect={setActiveId}
          loading={loading}
          mapBounds={mapBounds}
          genderType={genderType}
          riderMass={riderMass}
          bikeProfile={bikeProfile}
          onRefreshSegment={refreshDetail}
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
