import { useState, useEffect, useCallback, useRef } from 'react';
import {
  STRAVA_CLIENT_ID,
  REDIRECT_URI,
  LS_ACCESS_TOKEN,
  LS_REFRESH_TOKEN,
  LS_TOKEN_EXPIRES,
} from '../lib/constants.js';

/**
 * Manages Strava OAuth authentication with automatic token refresh.
 *
 * Flow:
 * 1. User clicks "Connect" → redirect to Strava authorization page
 * 2. Strava redirects back with ?code=XXX
 * 3. We send the code to our Cloudflare Worker
 * 4. Worker exchanges code for tokens (needs client_secret, so server-side)
 * 5. Worker responds with { access_token, refresh_token, expires_at }
 * 6. We store tokens in localStorage
 *
 * Token refresh:
 * - getValidToken() checks expiration before every API call
 * - If token expires within 5 minutes, it refreshes automatically
 * - If refresh fails, user is logged out
 */

const REFRESH_BUFFER_SECONDS = 300; // refresh 5 min before expiry

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(LS_ACCESS_TOKEN));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track whether a refresh is already in flight to avoid duplicate calls
  const refreshPromiseRef = useRef(null);

  // On mount: check if we're returning from Strava OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      exchangeCode(code);
    }
  }, []);

  // ── Exchange authorization code for tokens ──────────────────────
  async function exchangeCode(code) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error('Token exchange failed');

      const data = await res.json();
      saveTokens(data);
    } catch (err) {
      console.error('Auth error:', err);
      setError('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  // ── Refresh an expired token ────────────────────────────────────
  async function refreshToken() {
    const refreshTok = localStorage.getItem(LS_REFRESH_TOKEN);

    if (!refreshTok) {
      // No refresh token available → force re-login
      logout();
      return null;
    }

    try {
      const res = await fetch('/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshTok }),
      });

      if (!res.ok) {
        console.error('Token refresh failed:', res.status);
        logout();
        return null;
      }

      const data = await res.json();
      saveTokens(data);
      return data.access_token;
    } catch (err) {
      console.error('Token refresh error:', err);
      logout();
      return null;
    }
  }

  // ── Get a valid token, refreshing if needed ─────────────────────
  // This is what consumers (useSegments) should call before every API request.
  // It deduplicates concurrent refresh calls via a shared promise.
  const getValidToken = useCallback(async () => {
    const currentToken = localStorage.getItem(LS_ACCESS_TOKEN);
    const expiresAt = Number(localStorage.getItem(LS_TOKEN_EXPIRES) || 0);
    const now = Math.floor(Date.now() / 1000);

    // Token still valid (with buffer)
    if (currentToken && expiresAt > now + REFRESH_BUFFER_SECONDS) {
      return currentToken;
    }

    // Token expired or about to expire → refresh
    // Deduplicate: if a refresh is already in flight, wait for it
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = refreshToken().finally(() => {
        refreshPromiseRef.current = null;
      });
    }

    return refreshPromiseRef.current;
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────
  function saveTokens({ access_token, refresh_token, expires_at }) {
    localStorage.setItem(LS_ACCESS_TOKEN, access_token);
    localStorage.setItem(LS_REFRESH_TOKEN, refresh_token);
    localStorage.setItem(LS_TOKEN_EXPIRES, String(expires_at));
    setToken(access_token);
  }

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
    token,               // current token (may be expired — use getValidToken for API calls)
    getValidToken,       // async — always returns a valid token or null (+ triggers logout)
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!token,
  };
}