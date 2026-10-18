// ניהול הסגל: טיוטת סגל התחלתי, חישוב שכר, החלפת שחקן, רענון כושר עונתי.

import { SETTINGS } from "../data/settings.js";
import { byPosition, excludeIds, findById } from "./playersRepo.js";
import { randInt, pickRandom } from "./rng.js";

/** מחשב שכר עונתי התחלתי לפי יכולת, לפי הנוסחה המרכזית. */
export function calcSalary(ability) {
  return SETTINGS.SALARY_BASE + ability * SETTINGS.SALARY_PER_ABILITY_POINT;
}

/** מגריל כושר התחלתי בטווח המוגדר. */
export function randomFitness(rng) {
  return randInt(rng, SETTINGS.FITNESS_MIN, SETTINGS.FITNESS_MAX);
}

/** בונה שורת סגל חדשה משחקן מהמאגר. */
export function buildSquadSlot(playerRecord, rng) {
  return {
    playerId: playerRecord.id,
    position: playerRecord.position,
    currentAbility: playerRecord.ability,
    fitness: randomFitness(rng),
    salary: calcSalary(playerRecord.ability),
  };
}

/**
 * מגריל סגל התחלתי: שחקן אחד אקראי מכל עמדה מתוך מאגר 250 השחקנים,
 * ללא כפילויות (ממילא לא אפשרי כי הגרלה מכל עמדה בנפרד).
 */
export function draftInitialSquad(allPlayers, rng) {
  const squad = [];
  for (const position of SETTINGS.SQUAD_POSITIONS) {
    const candidates = byPosition(allPlayers, position);
    const chosen = pickRandom(rng, candidates);
    squad.push(buildSquadSlot(chosen, rng));
  }
  return squad;
}

/** מרענן את הכושר של כל שחקני הסגל בתחילת עונה חדשה. */
export function refreshSquadFitness(squad, rng) {
  return squad.map((slot) => ({ ...slot, fitness: randomFitness(rng), lastFitnessDelta: null }));
}

/**
 * מחיל שינוי כושר אקראי (±MATCH_FITNESS_SWING) על כל שחקן בסגל, אחרי
 * כל משחק שהקבוצה המנוהלת שיחקה בפועל (לא במחזורי מנוחה - ראו round.js).
 * שומר את השינוי בפועל (אחרי הגבלת הטווח) ב-lastFitnessDelta, כדי
 * שה-UI יוכל להציג חץ+מספר קבוע ליד השחקן בתצוגת הסגל.
 */
export function applyMatchFitnessSwing(squad, rng) {
  const swing = SETTINGS.MATCH_FITNESS_SWING;
  return squad.map((slot) => {
    const delta = randInt(rng, -swing, swing);
    const newFitness = clampFitness(slot.fitness + delta);
    return { ...slot, fitness: newFitness, lastFitnessDelta: newFitness - slot.fitness };
  });
}

/**
 * מחליף שחקן בעמדה נתונה בשחקן חדש אקראי מהמאגר, שלא נמצא כבר בסגל.
 * משמש הן להחלפה אוטומטית בעקבות אירוע/עזיבה, והן כבסיס לרכישה בשוק.
 */
export function replacePlayerInPosition(squad, allPlayers, position, rng) {
  const currentIds = squad.map((s) => s.playerId);
  const candidates = excludeIds(byPosition(allPlayers, position), currentIds);
  if (candidates.length === 0) {
    throw new Error(`אין שחקנים זמינים להחלפה בעמדה ${position}`);
  }
  const chosen = pickRandom(rng, candidates);
  const newSlot = buildSquadSlot(chosen, rng);
  return squad.map((s) => (s.position === position ? newSlot : s));
}

/** מחליף שחקן בעמדה בשחקן ספציפי (לשימוש בשוק ההעברות). */
export function setPlayerInPosition(squad, playerRecord, rng) {
  const newSlot = buildSquadSlot(playerRecord, rng);
  return squad.map((s) => (s.position === playerRecord.position ? newSlot : s));
}

export function getSlotByPosition(squad, position) {
  return squad.find((s) => s.position === position) || null;
}

export function squadWithPlayerData(squad, allPlayers) {
  return squad.map((slot) => ({
    ...slot,
    player: findById(allPlayers, slot.playerId),
  }));
}

export function clampFitness(value) {
  return Math.max(SETTINGS.FITNESS_MIN, Math.min(SETTINGS.FITNESS_MAX, value));
}

export function clampAbility(value) {
  return Math.max(SETTINGS.ABILITY_MIN, Math.min(SETTINGS.ABILITY_MAX, value));
}
