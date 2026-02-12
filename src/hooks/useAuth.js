import { useState, useEffect, useCallback } from 'react';
import {
  STRAVA_CLIENT_ID,
  AUTH_WORKER_URL,
  REDIRECT_URI,
  LS_ACCESS_TOKEN,
  LS_REFRESH_TOKEN,
  LS_TOKEN_EXPIRES,
} from '../lib/constants.js';

/**
 * Manages Strava OAuth authentication.
 *
 * Flow:
 * 1. User clicks "Connect" → redirect to Strava authorization page
 * 2. Strava redirects back with ?code=XXX
 * 3. We send the code to our Cloudflare Worker
 * 4. Worker exchanges code for tokens (needs client_secret, so server-side)
 * 5. Worker responds with { access_token, refresh_token, expires_at }
 * 6. We store tokens in localStorage
 *
 * On mount, checks for a ?code= param (OAuth callback) or existing tokens.
 */
export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(LS_ACCESS_TOKEN));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // On mount: check if we're returning from Strava OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Clean URL immediately (remove ?code= from address bar)
      window.history.replaceState({}, '', window.location.pathname);
      exchangeCode(code);
    }
  }, []);

  // Exchange authorization code for tokens via the Worker
  async function exchangeCode(code) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${AUTH_WORKER_URL}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        throw new Error('Token exchange failed');
      }

      const data = await res.json();
      saveTokens(data);
    } catch (err) {
      console.error('Auth error:', err);
      setError('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  function saveTokens({ access_token, refresh_token, expires_at }) {
    localStorage.setItem(LS_ACCESS_TOKEN, access_token);
    localStorage.setItem(LS_REFRESH_TOKEN, refresh_token);
    localStorage.setItem(LS_TOKEN_EXPIRES, String(expires_at));
    setToken(access_token);
  }

  // Build the Strava OAuth authorization URL
  const login = useCallback(() => {
    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'read',
    });
    window.location.href = `https://www.strava.com/oauth/authorize?${params}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(LS_ACCESS_TOKEN);
    localStorage.removeItem(LS_REFRESH_TOKEN);
    localStorage.removeItem(LS_TOKEN_EXPIRES);
    setToken(null);
  }, []);

  return {
    token,           // null = not authenticated
    loading,         // true while exchanging code
    error,
    login,           // redirect to Strava
    logout,          // clear tokens
    isAuthenticated: !!token,
  };
}
