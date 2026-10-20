// מסלול "ממתחיל לאגדה": עולים ליגה-ליגה (צרפת -> גרמניה -> איטליה ->
// אנגליה -> ספרד -> ליגת האירופה -> ליגת האלופות) עם אותה קבוצה
// "מטיילת" שבה בחר המשתמש בתחילת המסלול - כל פעם שעוברים שלב, היא
// מצטרפת לליגה הבאה במקום הקבוצה החלשה ביותר שם (כדי שתמיד יישארו
// בדיוק 14 קבוצות, בלי מחזור מנוחה - ראו הערה ב-settings.js).

import { getLeague, findTeamAnywhere } from "../data/leagues.js";

export const CAREER_STAGES = ["france", "germany", "italy", "england", "spain", "europa", "champions"];

// מכפיל כספי עולה לפי שלב הקריירה - כך שבונוסי משחקים ופרסי סוף עונה
// גדלים ממש בין ליגה לליגה במסלול "ממתחיל לאגדה" (ולא נשארים קבועים
// מתחילת המסלול ועד סופו, כמו בשוק משחק חופשי רגיל - ראו economy.js).
export const CAREER_MONEY_MULTIPLIERS = [1, 1.25, 1.55, 1.9, 2.3, 2.8, 3.4];

/** מחזיר את המכפיל הכספי לשלב הקריירה הנוכחי של ה-state, או 1 במשחק חופשי. */
export function careerMoneyMultiplier(state) {
  if (!state.careerMode) return 1;
  const idx = state.careerStageIndex ?? 0;
  return CAREER_MONEY_MULTIPLIERS[idx] ?? CAREER_MONEY_MULTIPLIERS[CAREER_MONEY_MULTIPLIERS.length - 1];
}

/** מחזיר את מזהה הליגה הבאה במסלול, או null אם זה כבר השלב האחרון. */
export function nextCareerLeagueId(currentLeagueId) {
  const idx = CAREER_STAGES.indexOf(currentLeagueId);
  if (idx === -1 || idx >= CAREER_STAGES.length - 1) return null;
  return CAREER_STAGES[idx + 1];
}

/**
 * בונה את רשימת 14 הקבוצות של השלב/ליגה הנוכחית, עם הקבוצה המטיילת
 * (travelingTeamId) תמיד בפנים: אם היא כבר חברה טבעית בליגה הזו (למשל
 * בשלב הראשון, לפני שהתחילו לעלות שלבים) - פשוט משתמשים ברשימה הקבועה
 * כמות שהיא. אם היא "הגיעה" מליגה אחרת (אחרי עלייה) - מורידים את הקבוצה
 * החלשה ביותר (לפי baseStrength) מהרשימה הקבועה כדי לפנות לה מקום.
 * עובד זהה גם במשחק חופשי (שם הקבוצה תמיד טבעית לליגה שלה) - בלי צורך
 * בהבחנה בין מצבי משחק.
 */
export function resolveStageTeams(leagueId, travelingTeamId) {
  const league = getLeague(leagueId);
  const staticTeams = league.teams;
  let others = staticTeams.filter((t) => t.id !== travelingTeamId);

  if (others.length >= staticTeams.length) {
    // הקבוצה המטיילת לא הייתה ברשימה הזו מלכתחילה - מורידים את החלשה ביותר
    others = others.slice().sort((a, b) => a.baseStrength - b.baseStrength).slice(1);
  }

  const travelingRecord = findTeamAnywhere(travelingTeamId) || {
    id: travelingTeamId,
    name_he: travelingTeamId,
    name_en: travelingTeamId,
    baseStrength: 70,
  };

  return [...others, travelingRecord];
}
