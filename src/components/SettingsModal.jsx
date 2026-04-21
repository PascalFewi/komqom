import React, { useState } from 'react';

export default function SettingsModal({ riderMass, stravaWeight, onSave, onClose }) {
  const [input, setInput] = useState(String(riderMass ?? stravaWeight ?? 75));

  function handleSave() {
    const val = parseFloat(input);
    if (val > 20 && val < 300) onSave(val);
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Einstellungen</div>

        <div className="modal-field">
          <label className="modal-label">Körpergewicht (kg)</label>
          <input
            className="modal-input"
            type="number"
            min="20"
            max="300"
            step="0.5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
          {stravaWeight && stravaWeight !== riderMass && (
            <span className="modal-hint">
              Strava: {stravaWeight} kg —{' '}
              <button className="modal-hint-btn" onClick={() => setInput(String(stravaWeight))}>
                übernehmen
              </button>
            </span>
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="modal-btn modal-btn-primary" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
