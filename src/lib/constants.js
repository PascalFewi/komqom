// Strava API base URL
export const STRAVA_API = 'https://www.strava.com/api/v3';

// OAuth config — client_id comes from env, secret stays on the worker
export const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;

// OAuth redirect: back to the app root
export const REDIRECT_URI = `${window.location.origin}/`;

// Map defaults
export const DEFAULT_CENTER = [47.37, 8.54]; // Zürich
export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM_FOR_SEGMENTS = 12;

// Tile layer (CARTO Dark — fits the dark UI)
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Segment colors
export const COLOR_DEFAULT = '#FC5200';
export const COLOR_ACTIVE = '#3B82F6';

// Debounce delay for map moves (ms)
export const MOVE_DEBOUNCE = 350;

// LocalStorage keys
export const LS_ACCESS_TOKEN = 'strava_access_token';
export const LS_REFRESH_TOKEN = 'strava_refresh_token';
export const LS_TOKEN_EXPIRES = 'strava_token_expires';
export const LS_GENDER_TYPE = 'strava_gender_type';
export const LS_RIDER_MASS = 'rider_mass';
export const LS_BIKE_PROFILE = 'strava_bike_profile';

// Bike profile physics constants
// Crr keys match Strava's surface_type field ('paved' | 'unpaved')
export const BIKE_PROFILES = {
  road: { label: 'Road', CdA: 0.32, bikeMass: 8,  Crr: { paved: 0.004, unpaved: 0.004 } },
  mtb:  { label: 'MTB',  CdA: 0.40, bikeMass: 12, Crr: { paved: 0.008, unpaved: 0.012 } },
};
