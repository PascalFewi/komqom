import React from 'react';
import { parseKomTime } from '../lib/segmentDifficulty.js';

export default function SegmentCard({ segment, difficulty, isActive, onClick, genderType }) {
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
  const komQomTime = (isQueen ? details?.xoms?.qom : details?.xoms?.kom) || '—';

  const komSeconds = parseKomTime(komQomTime);
  const avgSpeed =
    komSeconds && dist ? `${((dist / komSeconds) * 3.6).toFixed(1)} km/h` : '—';

  const elevProfile = data.elevation_profile;
  const starred = details?.starred ?? false;
  const starCount = details?.star_count ?? '';
  const stravaHref = details?.xoms?.destination?.href?.replace(
    'strava://',
    'https://www.strava.com/'
  );

  return (
    <div className={`seg-card ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="seg-card-header">
        <div className="seg-name" title={data.name}>
          {data.name}
        </div>
        <div className="seg-star" onClick={(e) => e.stopPropagation()}>
          <svg
            className={`seg-star-icon ${starred ? 'starred' : ''}`}
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

      {stravaHref && (
        <a
          className="seg-strava-link"
          href={stravaHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Auf Strava anzeigen →
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

function formatDistance(meters) {
  if (meters == null) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}
