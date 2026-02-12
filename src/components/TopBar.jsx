import React from 'react';

/**
 * Top navigation bar with:
 * - App title
 * - Segment counter badge
 * - Ride/Run toggle
 * - Logout button
 */
export default function TopBar({
  segmentCount,
  activityType,
  onTypeChange,
  onLogout,
}) {
  return (
    <div className="topbar">
      <div className="topbar-title">Segment Scout</div>

      <div className="topbar-right">
        <span className="topbar-badge">
          {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
        </span>

        <div className="topbar-type-toggle">
          <button
            className={`topbar-type-btn ${activityType === 'riding' ? 'active' : ''}`}
            onClick={() => onTypeChange('riding')}
          >
            Ride
          </button>
          <button
            className={`topbar-type-btn ${activityType === 'running' ? 'active' : ''}`}
            onClick={() => onTypeChange('running')}
          >
            Run
          </button>
        </div>

        <button className="disconnect-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
