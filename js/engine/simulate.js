// סימולציית משחקים - מחשבת תוצאות ריאליסטיות המבוססות על יכולת/כושר
// שחקני הקבוצה המנוהלת, חוזק הקבוצה היריבה, ורכיב אקראי משמעותי.

import { SETTINGS } from "../data/settings.js";

/**
 * מחשב "עוצמת קבוצה" עבור קבוצת השחקן, מתוך הסגל (4 שחקנים).
 * כושר נמוך מוריד את התרומה אך לא מאפס אותה.
 */
export function computeManagedTeamStrength(squad) {
  if (!squad.length) return 0;
  const total = squad.reduce((sum, slot) => {
    const fitnessFactor = 0.6 + 0.4 * (slot.fitness / SETTINGS.FITNESS_MAX);
    return sum + slot.currentAbility * fitnessFactor;
  }, 0);
  return total / squad.length;
}

/** מחזיר עוצמה מותאמת-אקראית (±SIMULATION_RANDOM_SWING) לקבוצה נתונה. */
function applyRandomSwing(baseStrength, rng) {
  const swing = SETTINGS.SIMULATION_RANDOM_SWING;
  const factor = 1 + (rng() * 2 - 1) * swing; // בטווח [1-swing, 1+swing]
  return Math.max(1, baseStrength * factor);
}

/** דגימת מספר שערים מהתפלגות פואסונית, בקירוב, מוגבלת ל-0..8. */
export function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L && k < 9);
  return Math.min(k - 1, 8);
}

function expectedGoals(myStrength, oppStrength) {
  const diff = myStrength - oppStrength;
  const base = 1.35 + diff / 22;
  return Math.max(0.15, Math.min(4.2, base));
}

/**
 * מסמלץ משחק בודד בין שתי "עוצמות קבוצה" בסיסיות (לפני רכיב אקראי).
 * מחזיר { teamAGoals, teamBGoals }.
 */
export function simulateMatch(strengthA, strengthB, rng) {
  const effA = applyRandomSwing(strengthA, rng);
  const effB = applyRandomSwing(strengthB, rng);
  const xgA = expectedGoals(effA, effB);
  const xgB = expectedGoals(effB, effA);
  const teamAGoals = poissonSample(xgA, rng);
  const teamBGoals = poissonSample(xgB, rng);
  return { teamAGoals, teamBGoals };
}
