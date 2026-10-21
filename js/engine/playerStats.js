// "מלך שערי העונה" / "מלך הבישולים" - עוקב אחרי כובשים ומבשלים בכל
// משחקי הליגה (לא רק שלך) לאורך עונה אחת.
//
// לכל אחת מ-13 הקבוצות היריבות (לא שלך) יש "סגל סטטיסטי" דקורטיבי -
// שחקן אמיתי אחד לכל עמדה (מגן/קשר/חלוץ, בלי שוער - שוערים לא כובשים
// ולא מבשלים) - מוגרל מחדש בתחילת כל עונה, בלי כפילויות בין הקבוצות
// ובלי אף אחד מ-4 שחקני הסגל שלך. זה לא משפיע על עוצמת הקבוצה
// (baseStrength) - רק נותן זהות לשער/בישול כדי שאפשר יהיה להציג טבלת
// מלך שערים אמיתית לכל הליגה, לא רק לסגל שלך.

import { byPosition, excludeIds } from "./playersRepo.js";
import { pickRandomN, randInt } from "./rng.js";

// הסתברות שכל עמדה תהיה הכובש בשער נתון (מסתכם ל-1).
const SCORER_POSITION_PROBS = [
  { position: "striker", probability: 0.5 },
  { position: "midfielder", probability: 0.35 },
  { position: "defender", probability: 0.15 },
];

const ASSIST_PROBABILITY = 0.5;

/**
 * מגריל "סגל סטטיסטי" טרי לכל הקבוצות היריבות בליגה הנוכחית (לא כולל
 * userTeamId): שחקן אחד (אמיתי, מהמאגר) לכל אחת מ-3 העמדות (מגן/קשר/
 * חלוץ), ללא כפילויות בין הקבוצות ובלי אף שחקן מהסגל של המשתמש.
 * teamIds הוא מערך מזהי הקבוצות (14, כולל שלך) של השלב/ליגה הנוכחית.
 * מחזיר map: teamId -> { defender, midfielder, striker } (מזהי שחקנים).
 */
export function assignSeasonRosters(teamIds, userTeamId, userSquad, allPlayers, rng) {
  const opponentTeamIds = teamIds.filter((id) => id !== userTeamId);
  const userPlayerIds = userSquad.map((s) => s.playerId);

  const rosters = {};
  for (const teamId of opponentTeamIds) rosters[teamId] = {};

  for (const position of ["defender", "midfielder", "striker"]) {
    const pool = excludeIds(byPosition(allPlayers, position), userPlayerIds);
    const picked = pickRandomN(rng, pool, opponentTeamIds.length);
    opponentTeamIds.forEach((teamId, i) => {
      rosters[teamId][position] = picked[i] ? picked[i].id : null;
    });
  }

  return rosters;
}

/**
 * מחזיר את 3 מזהי השחקנים (מגן/קשר/חלוץ) של קבוצה נתונה, לצורך הגרלת
 * שער - מהסגל האמיתי אם זו הקבוצה של המשתמש, אחרת מה"סגל הסטטיסטי"
 * המוגרל (teamRosters).
 */
export function teamScorerRoster(teamId, state) {
  if (teamId === state.teamId) {
    const byPos = {};
    for (const slot of state.squad) byPos[slot.position] = slot.playerId;
    return { defender: byPos.defender, midfielder: byPos.midfielder, striker: byPos.striker };
  }
  // שמירות ישנות (מלפני פיצ'ר "מלך שערי העונה") לא מכילות teamRosters - מוגן
  // גם כאן, בנוסף למיגרציה ב-loadSavedGame, כדי שלא תהיה קריסה על state חסר.
  return (state.teamRosters || {})[teamId] || {};
}

function pickScorerPosition(rng) {
  const r = rng();
  let cumulative = 0;
  for (const { position, probability } of SCORER_POSITION_PROBS) {
    cumulative += probability;
    if (r < cumulative) return position;
  }
  return SCORER_POSITION_PROBS[SCORER_POSITION_PROBS.length - 1].position;
}

/**
 * מגריל כובש (ולעיתים גם מבשל) עבור שער בודד, מתוך הרוסטר (3 מזהים)
 * של הקבוצה שכבשה. מחזיר { scorerId, assistId } (assistId יכול להיות
 * null - גם אם אין כובש תקין מהרוסטר, וגם ב-50% מהמקרים שבהם יש).
 */
export function drawGoalContributors(roster, rng) {
  const scorerPosition = pickScorerPosition(rng);
  const scorerId = roster[scorerPosition];
  if (!scorerId) return { scorerId: null, assistId: null };

  let assistId = null;
  if (rng() < ASSIST_PROBABILITY) {
    const otherPositions = ["defender", "midfielder", "striker"].filter((p) => p !== scorerPosition);
    const candidates = otherPositions.map((p) => roster[p]).filter(Boolean);
    if (candidates.length) {
      assistId = candidates[randInt(rng, 0, candidates.length - 1)];
    }
  }
  return { scorerId, assistId };
}

/**
 * מצבר שער בודד לתוך playerStats (map מזהה-שחקן -> {goals, assists,
 * teamId}), בלי לשנות את המקור - מחזיר map חדש. teamId נשמר על כל
 * שחקן כדי שאפשר יהיה להציג את שם הקבוצה בטבלת מלך השערים/הבישולים
 * בלי לנחש אותו מחדש.
 */
export function recordGoal(playerStats, teamId, roster, rng) {
  return recordGoalDetailed(playerStats, teamId, roster, rng).stats;
}

/** כמו recordGoal, אבל מחזיר גם את מזהה הכובש: { stats, scorerId }. */
export function recordGoalDetailed(playerStats, teamId, roster, rng) {
  const { scorerId, assistId } = drawGoalContributors(roster, rng);
  let stats = playerStats;

  if (scorerId) {
    const prev = stats[scorerId] || { goals: 0, assists: 0, teamId };
    stats = { ...stats, [scorerId]: { ...prev, goals: prev.goals + 1, teamId } };
  }
  if (assistId) {
    const prev = stats[assistId] || { goals: 0, assists: 0, teamId };
    stats = { ...stats, [assistId]: { ...prev, assists: prev.assists + 1, teamId } };
  }
  return { stats, scorerId };
}

/**
 * מגריל דקות אקראיות (1-90, ממוינות) לרשימת שערים של משחק אחד.
 * goals: [{ teamId, playerId }] -> אותו מערך עם minute, ממוין לפי דקה.
 */
export function assignGoalMinutes(goals, rng) {
  return goals
    .map((g) => ({ ...g, minute: randInt(rng, 1, 90) }))
    .sort((a, b) => a.minute - b.minute);
}

/**
 * מלך השערים וסגנו בליגה לפי playerStats: [ראשון, שני] (או פחות אם אין
 * מספיק כובשים). שוויון נשבר לפי בישולים ואז לפי מזהה שחקן (יציב).
 */
export function topTwoScorers(playerStats) {
  return Object.entries(playerStats || {})
    .map(([id, s]) => ({ playerId: Number(id), teamId: s.teamId, goals: s.goals || 0, assists: s.assists || 0 }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.playerId - b.playerId)
    .slice(0, 2);
}
