import React, { useState } from 'react';

export default function SettingsModal({
  riderMass,
  stravaWeight,
  onSave,
  onClose,
  genderType,
  onTypeChange,
  bikeProfile,
  onBikeProfileChange,
  onLogout,
}) {
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

        <div className="modal-info modal-usage">
          <p className="modal-usage-text">
            Bewege die Karte und klicke <strong>„In diesem Bereich suchen"</strong>, um Segmente zu laden.
            Klicke auf ein Segment, um Details zu sehen. Segmente werden nach Schwierigkeit sortiert — basierend auf der Zeit, die du brauchst, den KOM/QOM zu schlagen.
          </p>
          <p className="modal-usage-note">
            Strava erlaubt nur begrenzte API-Aufrufe (200 pro 15 Min.). Bei häufigem Kartenwechsel kann es kurz zu einer Pause kommen.
          </p>
        </div>

        <div className="modal-divider" />

        <div className="modal-toggles">
          <div className="topbar-type-toggle">
            <button
              className={`topbar-type-btn ${bikeProfile === 'road' ? 'active' : ''}`}
              onClick={() => onBikeProfileChange('road')}
            >
              Road
            </button>
            <button
              className={`topbar-type-btn ${bikeProfile === 'mtb' ? 'active' : ''}`}
              onClick={() => onBikeProfileChange('mtb')}
            >
              MTB
            </button>
          </div>

          <div className="topbar-type-toggle">
            <button
              className={`topbar-type-btn ${genderType === 'king' ? 'active' : ''}`}
              onClick={() => onTypeChange('king')}
            >
              King
            </button>
            <button
              className={`topbar-type-btn ${genderType === 'queen' ? 'active' : ''}`}
              onClick={() => onTypeChange('queen')}
            >
              Queen
            </button>
          </div>
        </div>

        <div className="modal-divider" />

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
          <p className="modal-privacy">
            Dein Gewicht wird ausschließlich lokal auf diesem Gerät verwendet — es wird nie übertragen.
            Es fließt in die Berechnung der benötigten Wattzahl pro Segment ein.
          </p>
        </div>

        <div className="modal-divider" />

        <div className="modal-info">
          <div className="modal-info-title">Wie wird die Leistung berechnet?</div>
          <p className="modal-info-text">
            Das Modell summiert drei Kräfte: Schwerkraft (Steigung × Gesamtmasse), Rollwiderstand
            und Luftwiderstand. Die resultierende Wattzahl wird mit dem{' '}
            <em>Critical-Power-Modell</em> (nach Coggan, „Good"-Level) ins Verhältnis gesetzt —
            so entsteht der Schwierigkeits-Score in %.
          </p>
          <p className="modal-info-text">
            Road-Profil: CdA 0.32, Rad 8 kg. MTB-Profil: CdA 0.40, Rad 12 kg.
            Rollwiderstand variiert je nach Untergrund.
          </p>
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-logout" onClick={onLogout}>
            Logout
          </button>
          <div style={{ flex: 1 }} />
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
