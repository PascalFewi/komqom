/**
 * Cloudflare Worker: Strava OAuth Token Exchange
 *
 * This is the ONLY backend component. It does one thing:
 * exchange an authorization code for access/refresh tokens.
 *
 * Why this can't be in the frontend:
 * 1. Strava requires client_secret for token exchange — can't expose it in JS
 * 2. Strava's token endpoint doesn't send CORS headers — browser blocks it
 *
 * Endpoints:
 *   POST /exchange  { code: "xxx" }  →  { access_token, refresh_token, expires_at }
 *   POST /refresh   { refresh_token: "xxx" }  →  { access_token, refresh_token, expires_at }
 *
 * Environment variables (set via wrangler secret):
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   ALLOWED_ORIGIN       (e.g. https://your-app.com)
 */

export default {
  async fetch(request, env) {
    // ── CORS preflight ─────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'POST' && url.pathname === '/exchange') {
        return corsResponse(env, await handleExchange(request, env));
      }

      if (request.method === 'POST' && url.pathname === '/refresh') {
        return corsResponse(env, await handleRefresh(request, env));
      }

      return corsResponse(env, new Response('Not found', { status: 404 }));
    } catch (err) {
      console.error('Worker error:', err);
      return corsResponse(
        env,
        new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
  },
};

// ── Exchange authorization code for tokens ──────────────────────
async function handleExchange(request, env) {
  const { code } = await request.json();

  if (!code) {
    return jsonResponse({ error: 'Missing code' }, 400);
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return jsonResponse({ error: data.message || 'Token exchange failed' }, res.status);
  }

  // Only return what the frontend needs — no athlete data
  return jsonResponse({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
}

// ── Refresh an expired token ────────────────────────────────────
async function handleRefresh(request, env) {
  const { refresh_token } = await request.json();

  if (!refresh_token) {
    return jsonResponse({ error: 'Missing refresh_token' }, 400);
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return jsonResponse({ error: data.message || 'Token refresh failed' }, res.status);
  }

  return jsonResponse({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
}

// ── Helpers ─────────────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsResponse(env, response) {
  const origin = env.ALLOWED_ORIGIN || '*';
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
