import React from 'react';

/**
 * Full-screen login view.
 * Uses the official Strava "Connect with Strava" button asset.
 */
export default function AuthScreen({ onLogin, loading, error }) {
  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-logo">KOM QOM</div>
        <div className="auth-sub">Explore Strava segments on the map</div>

        {error && <div className="auth-error">{error}</div>}

        {loading ? (
          <div className="auth-loading">
            <span className="loading-spinner" /> Connecting…
          </div>
        ) : (
          <button
            className="strava-connect-btn"
            onClick={onLogin}
            aria-label="Connect with Strava"
          >
            <img
              src="/btn_strava_connect_with_orange.svg"
              alt="Connect with Strava"
              height="48"
            />
          </button>
        )}

        <p className="auth-hint">
          We only request <code>read</code> access to explore public segments.
          No write permissions needed.
        </p>
      </div>
    </div>
  );
}