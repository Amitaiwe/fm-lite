// יצירת לוח משחקים (fixtures) לעונה - round robin חד-פעמי, כל קבוצה
// מול כל קבוצה אחרת פעם אחת, ללא משחקי בית/חוץ כפולים.
//
// עם 11 קבוצות (מספר אי-זוגי) יש צורך מתמטי ב"מחזור מנוחה" אחד לכל
// קבוצה, כמו בליגות אמיתיות עם מספר אי-זוגי של קבוצות - ראו הערה
// ב-settings.js. המימוש משתמש בשיטת "המעגל" (circle method) הקלאסית
// לבניית round robin.

import { shuffle } from "./rng.js";

/**
 * בונה לוח מחזורים מתוך רשימת מזהי קבוצות. אם מועבר rng, סדר הקבוצות
 * מעורבב אקראית *לפני* בניית הסבב (כך שגם מי-נגד-מי בכל מחזור וגם
 * הסדר הכולל של המחזורים משתנים בכל עונה - לא אותו לוח קבוע כל פעם),
 * בלי לפגוע בעקרון שכל קבוצה משחקת נגד כל אחת מהאחרות פעם אחת בדיוק.
 * בלי rng (ברירת מחדל) מתנהג כמו קודם - דטרמיניסטי לפי סדר הקלט.
 * מחזיר מערך של מחזורים; כל מחזור הוא מערך של זוגות [teamIdA, teamIdB].
 * קבוצה שנחה במחזור מסוים פשוט לא תופיע באף זוג באותו מחזור.
 */
export function generateFixtures(teamIds, rng = null) {
  const list = rng ? shuffle(rng, teamIds) : teamIds.slice();
  if (list.length % 2 !== 0) list.push(null); // BYE placeholder
  const n = list.length;
  const fixed = list[0];
  const rotation = list.slice(1);
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const roundTeams = [fixed, ...rotation];
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = roundTeams[i];
      const away = roundTeams[n - 1 - i];
      if (home !== null && away !== null) {
        matches.push([home, away]);
      }
    }
    rounds.push(matches);
    rotation.unshift(rotation.pop());
  }
  return rounds;
}

/** מחזיר את המשחק של קבוצה מסוימת במחזור נתון, או null אם היא נחה. */
export function findTeamMatch(round, teamId) {
  for (const [a, b] of round) {
    if (a === teamId) return { opponent: b, isHome: true };
    if (b === teamId) return { opponent: a, isHome: false };
  }
  return null;
}
