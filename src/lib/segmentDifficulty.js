import { BIKE_PROFILES } from './constants.js';

// ============================================================================
// KONSTANTEN
// ============================================================================

const PHYSICS = {
  g: 9.81,   // Gravitation [m/s²]
  rho: 1.2,  // Luftdichte [kg/m³]
  eta: 0.98, // Antriebseffizienz [-]
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
 * @param {{ CdA: number, bikeMass: number, Crr: number }} profilePhysics
 * @returns {{ P_total: number, P_totalWkg: number }}
 */
function calculateRequiredW(distance, elevation, timeSeconds, riderMass, profilePhysics) {
  const { g, rho, eta } = PHYSICS;
  const { CdA, bikeMass, Crr } = profilePhysics;

  const v = distance / timeSeconds;
  const grade = Math.min(elevation / distance, 0.99);
  const totalMass = riderMass + bikeMass;

  const P_gravity = totalMass * g * v * grade;
  const P_aero = 0.5 * rho * CdA * v * v * v;
  const cosTheta = Math.sqrt(1 - grade * grade);
  const P_rolling = totalMass * g * v * Crr * cosTheta;

  const P_total = Math.max(0, (P_gravity + P_rolling + P_aero) / eta);
  const P_totalWkg = P_total / riderMass;
  return { P_total, P_totalWkg };
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

const DEFAULT_PROFILE_PHYSICS = { CdA: 0.32, bikeMass: 8, Crr: 0.004 };

export function calculateSegmentDifficulty({ distance, elevation, komTime, riderMass, profilePhysics = DEFAULT_PROFILE_PHYSICS }) {
  const defaultResult = {
    komPower: null,
    komPowerWKg: null,
    difficultyScore: null,
    difficultyClass: { class: 'unknown', label: '—', color: '#9ca3af' },
    isValid: false,
  };

  if (!distance || distance <= 0 || elevation == null || !riderMass || riderMass <= 0 || !komTime) {
    return defaultResult;
  }

  const komSeconds = parseKomTime(komTime);
  if (!komSeconds || komSeconds <= 0) return defaultResult;

  const powerResult = calculateRequiredW(distance, elevation, komSeconds, riderMass, profilePhysics);
  const komPower = powerResult.P_total;
  const komPowerWKg = powerResult.P_totalWkg;
  const refPower = referencePower(komSeconds);
  const difficultyScore = (komPowerWKg / refPower) * 100;
  const difficultyClass = getDifficultyClass(difficultyScore);

  return { komPower, komPowerWKg, difficultyScore, difficultyClass, isValid: true };
}

export function getSegmentDifficulty(segment, riderMass, genderType = 'king', bikeProfile = 'road') {
  const { data, details, surface } = segment;

  const distance = details?.distance || data?.distance;
  const elevation = data?.elev_difference ?? details?.total_elevation_gain ?? 0;
  const komTime = genderType === 'queen' ? details?.xoms?.qom : details?.xoms?.kom;

  const profile = BIKE_PROFILES[bikeProfile] || BIKE_PROFILES.road;
  const isPaved = surface !== 'unpaved';
  const Crr = isPaved ? profile.Crr.paved : profile.Crr.unpaved;
  const profilePhysics = { CdA: profile.CdA, bikeMass: profile.bikeMass, Crr };

  return calculateSegmentDifficulty({ distance, elevation, komTime, riderMass, profilePhysics });
}

// ============================================================================
// ADDITIONAL EXPORTS
// ============================================================================

export { parseKomTime, referencePower, getDifficultyClass, DIFFICULTY_CLASSES };