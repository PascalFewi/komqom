import React, { useState } from 'react';
import { parseKomTime } from '../lib/segmentDifficulty.js';

const REFRESH_MIN_AGE_DAYS = 7;

export default function SegmentCard({ segment, difficulty, isActive, onClick, genderType, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const { data, details } = segment;
  const { komPower, komPowerWKg, difficultyClass, isValid } = difficulty;

  const dist = details?.distance || data.distance;
  const distStr = formatDistance(dist);
  const grade = data.avg_grade != null ? `${data.avg_grade.toFixed(1)}%` : '—';
  const elev =
    data.elev_difference != null
      ? `${Math.round(data.elev_difference)} m`
      : details?.total_elevation_gain != null
        ? `${Math.round(details.total_elevation_gain)} m`
        : '—';

  const isQueen = genderType === 'queen';
  const komQomTime = (isQueen ? details?.qom_time : details?.kom_time) || '—';

  const komSeconds = parseKomTime(komQomTime);
  const avgSpeed =
    komSeconds && dist ? `${((dist / komSeconds) * 3.6).toFixed(1)} km/h` : '—';

  const elevProfile = data.elevation_profile;
  const starCount = details?.star_count ?? '';
  const stravaHref = details?.strava_href?.replace('strava://', 'https://www.strava.com/');

  const extractedAt = details?.extracted_at;
  const extractedStr = extractedAt ? formatDate(extractedAt) : null;
  const canRefresh = extractedAt && isOlderThan(extractedAt, REFRESH_MIN_AGE_DAYS);

  async function handleRefresh(e) {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className={`seg-card ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="seg-card-header">
        <div className="seg-name" title={data.name}>
          {data.name}
        </div>
        <div className="seg-star" onClick={(e) => e.stopPropagation()}>
          <svg
            className="seg-star-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="seg-star-count">{starCount}</span>
        </div>
      </div>

      {elevProfile && (
        <div className="seg-grade-profile">
          <img src={elevProfile} alt="Elevation profile" height="25" />
        </div>
      )}

      <div className="seg-stats">
        <Stat label="Länge" value={distStr} />
        <Stat label="Steigung" value={grade} />
        <Stat label="Höhe" value={elev} />
        <Stat label="Ø Speed" value={avgSpeed} />
      </div>

      {isValid && (
        <div
          className="seg-difficulty-bar"
          style={{ backgroundColor: difficultyClass.color + '4D' }}
        >
          ~ {komPower.toFixed(0)} W  für {komQomTime}
        </div>
      )}

      {extractedStr && (
        <div className="seg-extracted">
          <span className="seg-extracted-date">Aktualisiert: {extractedStr}</span>
          {canRefresh && onRefresh && (
            <button
              className="seg-refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Von Strava aktualisieren"
            >
              {refreshing ? <span className="loading-spinner" /> : <RefreshIcon />}
            </button>
          )}
        </div>
      )}

      {stravaHref && (
        <a
          className="seg-strava-link"
          href={stravaHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          View on Strava
        </a>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="seg-stat">
      <span className="seg-stat-label">{label}</span>
      <span className="seg-stat-value">{value}</span>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function formatDistance(meters) {
  if (meters == null) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDate(unixSecs) {
  const d = new Date(unixSecs * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function isOlderThan(unixSecs, days) {
  return (Math.floor(Date.now() / 1000) - unixSecs) > days * 86400;
}
