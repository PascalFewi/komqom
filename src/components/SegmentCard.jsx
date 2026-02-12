import React from 'react';

/**
 * Single segment card showing key stats.
 *
 * Props:
 * - segment: { data, details }
 * - isActive: boolean
 * - onClick: () => void
 */
export default function SegmentCard({ segment, isActive, onClick }) {
  const { data, details } = segment;

  // Distance: prefer details (more accurate), fallback to explore data
  const dist = details?.distance || data.distance;
  const distStr = formatDistance(dist);

  // Grade
  const grade = data.avg_grade != null ? `${data.avg_grade.toFixed(1)}%` : '—';
  const gradeClass = getGradeClass(data.avg_grade);
  const gradeWidth = Math.min(Math.abs(data.avg_grade || 0) / 15 * 100, 100);

  // Elevation
  const elev =
    data.elev_difference != null
      ? `${Math.round(data.elev_difference)} m`
      : details?.total_elevation_gain != null
        ? `${Math.round(details.total_elevation_gain)} m`
        : '—';

  // KOM time (from segment details xoms)
  const kom = details?.xoms?.kom || '—';

  return (
    <div
      className={`seg-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="seg-name" title={data.name}>
        {data.name}
      </div>

      <div className="seg-grade-bar">
        <div
          className={`seg-grade-fill ${gradeClass}`}
          style={{ width: `${gradeWidth}%` }}
        />
      </div>

      <div className="seg-stats">
        <Stat label="Länge" value={distStr} />
        <Stat label="Steigung" value={grade} />
        <Stat label="Höhe" value={elev} />
        <Stat label="KOM" value={kom} />
      </div>
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

function getGradeClass(grade) {
  const g = Math.abs(grade || 0);
  if (g < 2) return 'grade-flat';
  if (g < 5) return 'grade-easy';
  if (g < 8) return 'grade-moderate';
  if (g < 12) return 'grade-steep';
  return 'grade-hc';
}
