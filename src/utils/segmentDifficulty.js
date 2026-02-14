/**
 * Strava Segment Difficulty Utilities
 * 
 * Berechnet Difficulty Score basierend auf:
 * 1. Physik-Modell (Gravity + Rolling + Aero)
 * 2. 3-Parameter Critical Power Model
 */

// ============================================================================
// KONSTANTEN
// ============================================================================

const PHYSICS = {
  g: 9.81,           // Gravitation [m/s²]
  rho: 1.2,          // Luftdichte [kg/m³]
  bikeMass: 8,       // Fahrradgewicht [kg]
  Crr: 0.004,        // Rollwiderstand [-]
  CdA: 0.28,         // Luftwiderstand [m²]
  eta: 0.98,         // Antriebseffizienz [-]
};

// 3-P CP Model für "Good" Level (Coggan)
const CP_MODEL = {
  Pmax: 21.80,       // Peak Power [W/kg]
  CP: 4.77,          // Critical Power [W/kg]
  Wprime: 280,       // Anaerobe Kapazität [J/kg]
};

// Vorberechnet
const APR = CP_MODEL.Pmax - CP_MODEL.CP;  // 17.03
const W_APR = CP_MODEL.Wprime * APR;       // 4768.4

// ============================================================================
// DIFFICULTY CLASSES
// ============================================================================

const DIFFICULTY_CLASSES = [
  { min: 150, class: 'suspicious', label: 'hmmmm',      color: '#6b7280' },
  { min: 130, class: 'extreme',    label: 'Extrem',          color: '#7c3aed' },
  { min: 110,  class: 'very-hard',  label: 'Sehr schwer',     color: '#dc2626' },
  { min: 90,  class: 'hard',       label: 'Schwer',          color: '#ea580c' },
  { min: 70,  class: 'moderate',   label: 'Moderat',         color: '#ca8a04' },
  { min: 50,  class: 'accessible', label: 'Machbar',         color: '#16a34a' },
  { min: 0,   class: 'easy',       label: 'Einfach',         color: '#22c55e' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parst KOM-Zeit String zu Sekunden
 * Unterstützt: "1:23", "5:30", "1:23:45", "45" (nur Sekunden)
 * @param {string} timeStr - Zeit als String
 * @returns {number|null} - Sekunden oder null wenn ungültig
 */
function parseKomTime(timeStr) {
  if (!timeStr || timeStr === '—') return null;
  
  // Entferne Whitespace
  const clean = timeStr.trim();
  
    // Nur Zahl (optional mit 's') = Sekunden
    if (/^\d+s?$/.test(clean)) {
    return parseInt(clean, 10);
    }
  
  // Split by ':'
  const parts = clean.split(':').map(p => parseInt(p, 10));
  
  if (parts.some(isNaN)) return null;
  
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return null;
}

/**
 * Referenz-Power für eine gegebene Dauer (3-P CP Model)
 * @param {number} t - Dauer in Sekunden
 * @returns {number} - Referenz W/kg für "Good" Level
 */
function referencePower(t) {
  if (t <= 0) return CP_MODEL.Pmax;
  return CP_MODEL.CP + W_APR / (CP_MODEL.Wprime + APR * t);
}

/**
 * Berechnet benötigte W/kg für ein Segment
 * @param {number} distance - Länge in Metern
 * @param {number} elevation - Höhenmeter
 * @param {number} timeSeconds - Zeit in Sekunden
 * @param {number} riderMass - Fahrergewicht in kg
 * @returns {number} - Benötigte W/kg
 */
function calculateRequiredW(distance, elevation, timeSeconds, riderMass) {
  const { g, rho, bikeMass, Crr, CdA, eta } = PHYSICS;
  
  const v = distance / timeSeconds;              // Geschwindigkeit [m/s]
  const grade = elevation / distance;            // Steigung [-]
  const totalMass = riderMass + bikeMass;        // Gesamtmasse [kg]
  
  // Power-Komponenten [W]
  const P_gravity = totalMass * g * v * grade;
  const P_rolling = totalMass * g * v * Crr;
  const P_aero = 0.5 * rho * CdA * v * v * v;
  
  // Total (mit Antriebsverlusten)
  const P_total = (P_gravity + P_rolling + P_aero) / eta;
  const P_totalWkg = P_total / riderMass;
  return  {P_total, P_totalWkg};
}

/**
 * Ermittelt Difficulty Class basierend auf Score
 * @param {number} score - Difficulty Score
 * @returns {Object} - { class, label, color }
 */
function getDifficultyClass(score) {
  for (const level of DIFFICULTY_CLASSES) {
    if (score >= level.min) {
      return {
        class: level.class,
        label: level.label,
        color: level.color,
      };
    }
  }
  return DIFFICULTY_CLASSES[DIFFICULTY_CLASSES.length - 1];
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Berechnet alle Difficulty-Metriken für ein Segment
 * 
 * @param {Object} options
 * @param {number} options.distance - Segment-Länge in Metern
 * @param {number} options.elevation - Höhenmeter
 * @param {string} options.komTime - KOM-Zeit als String (z.B. "5:30")
 * @param {number} options.riderMass - Fahrergewicht in kg
 * 
 * @returns {Object} - { komPower, difficultyScore, difficultyClass, ... }
 */
export function calculateSegmentDifficulty({ distance, elevation, komTime, riderMass }) {
  // Default return wenn Daten fehlen
  const defaultResult = {
    komPower: null,
    komPowerWKg: null,
    difficultyScore: null,
    difficultyClass: { class: 'unknown', label: '—', color: '#9ca3af' },
    isValid: false,
  };
  
    // debugging
  if (
    (!distance || distance <= 0)
    || (elevation == null)
    || (!riderMass || riderMass <= 0)
    || (!komTime)
  ) {
    console.log('Ungültige Daten für Difficulty-Berechnung:', { distance, elevation, komTime, riderMass });
    return defaultResult;
  }

  // Validierung
  if (!distance || distance <= 0) return defaultResult;
  if (elevation == null) return defaultResult;
  if (!riderMass || riderMass <= 0) return defaultResult;
  
  const komSeconds = parseKomTime(komTime);
  if (!komSeconds || komSeconds <= 0) return defaultResult;

  // Berechnungen
  const powerResult = calculateRequiredW(distance, elevation, komSeconds, riderMass);
  const komPower = powerResult.P_total;
  const komPowerWKg = powerResult.P_totalWkg;
  const refPower = referencePower(komSeconds);
  const difficultyScore = (komPowerWKg / refPower) * 100;
  const difficultyClass = getDifficultyClass(difficultyScore);
  
  return {
    komPower, 
    komPowerWKg ,                  // W/kg benötigt für KOM
    difficultyScore,             // Score in %
    difficultyClass,             // { class, label, color }
    isValid: true,
  };
}

/**
 * Shorthand: Holt Difficulty aus Segment-Objekt (Strava API Format)
 * 
 * @param {Object} segment - { data, details }
 * @param {number} riderMass - Fahrergewicht in kg
 * @returns {Object} - Difficulty result
 */
export function getSegmentDifficulty(segment, riderMass) {
  const { data, details } = segment;
  
  // Distance: prefer details (more accurate)
  const distance = details?.distance || data?.distance;
  
  // Elevation: prefer elev_difference, fallback to total_elevation_gain
  const elevation = data?.elev_difference ?? details?.total_elevation_gain ?? 0;
  
  // KOM time from xoms
  const komTime = details?.xoms?.kom;
  
  return calculateSegmentDifficulty({
    distance,
    elevation,
    komTime,
    riderMass,
  });
}

// ============================================================================
// ADDITIONAL EXPORTS
// ============================================================================

export { parseKomTime, referencePower, getDifficultyClass, DIFFICULTY_CLASSES };