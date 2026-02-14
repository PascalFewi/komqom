import React from 'react';

/**
 * Full-screen login view.
 * Shows "Connect with Strava" button that triggers the OAuth redirect.
 */
export default function AuthScreen({ onLogin, loading, error }) {
  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-logo">KOM QOM</div>
        <div className="auth-sub">Explore Strava segments on the map</div>

        {error && <div className="auth-error">{error}</div>}

        <button
          className="auth-btn strava-btn"
          onClick={onLogin}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner" /> Connecting…
            </>
          ) : (
            <>
              <StravaIcon /> Connect with Strava
            </>
          )}
        </button>

        <p className="auth-hint">
          We only request <code>read</code> access to explore public segments.
          No write permissions needed.
        </p>
      </div>
    </div>
  );
}

function StravaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
