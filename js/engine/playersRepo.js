// פונקציות טהורות לעבודה עם מאגר השחקנים (players.json).
// לא מבצע I/O - מקבל תמיד מערך שחקנים כפרמטר, כדי שיהיה קל לבדוק.

import { SETTINGS } from "../data/settings.js";

const REQUIRED_FIELDS = ["id", "name_he", "name_en", "position", "ability", "market_value"];
const VALID_POSITIONS = new Set(SETTINGS.SQUAD_POSITIONS);

/**
 * בודק שמאגר השחקנים תקין: מערך לא ריק, כל שחקן כולל את השדות הנדרשים,
 * עמדות חוקיות, ו-id ייחודי. זורק שגיאה עם הודעה ברורה אם לא.
 */
export function validatePlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("קובץ players.json ריק או אינו מערך תקין");
  }
  const seenIds = new Set();
  for (const p of players) {
    for (const field of REQUIRED_FIELDS) {
      if (p[field] === undefined || p[field] === null) {
        throw new Error(`שחקן עם id=${p.id ?? "?"} חסר שדה "${field}"`);
      }
    }
    if (!VALID_POSITIONS.has(p.position)) {
      throw new Error(`שחקן ${p.name_he} (id=${p.id}) עם עמדה לא חוקית: "${p.position}"`);
    }
    if (typeof p.ability !== "number" || p.ability < 1 || p.ability > 99) {
      throw new Error(`שחקן ${p.name_he} (id=${p.id}) עם יכולת לא חוקית: ${p.ability}`);
    }
    if (typeof p.market_value !== "number" || p.market_value < 0) {
      throw new Error(`שחקן ${p.name_he} (id=${p.id}) עם שווי שוק לא חוקי: ${p.market_value}`);
    }
    if (seenIds.has(p.id)) {
      throw new Error(`id כפול במאגר השחקנים: ${p.id}`);
    }
    seenIds.add(p.id);
  }
  return true;
}

export function findById(players, id) {
  return players.find((p) => p.id === id) || null;
}

export function byPosition(players, position) {
  return players.filter((p) => p.position === position);
}

export function excludeIds(players, ids) {
  const idSet = new Set(ids);
  return players.filter((p) => !idSet.has(p.id));
}
