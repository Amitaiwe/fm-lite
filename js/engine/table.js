// חישוב טבלת הליגה מתוך תוצאות משחקים.

import { SETTINGS } from "../data/settings.js";

/** יוצר שורת טבלה ריקה לקבוצה. */
export function emptyTableRow(teamId) {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

/** בונה טבלה ריקה לכל הקבוצות. */
export function initTable(teamIds) {
  const table = {};
  for (const id of teamIds) table[id] = emptyTableRow(id);
  return table;
}

/**
 * מעדכן את הטבלה (מוטציה על עותק) בעקבות תוצאת משחק יחיד.
 * match: { homeTeam, awayTeam, homeGoals, awayGoals }
 */
export function applyMatchResult(table, match) {
  const { homeTeam, awayTeam, homeGoals, awayGoals } = match;
  const home = table[homeTeam];
  const away = table[awayTeam];
  if (!home || !away) return table;

  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won += 1;
    away.lost += 1;
  } else if (homeGoals < awayGoals) {
    away.won += 1;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
  }
  return table;
}

function points(row) {
  return row.won * SETTINGS.POINTS_WIN + row.drawn * SETTINGS.POINTS_DRAW;
}

function goalDiff(row) {
  return row.goalsFor - row.goalsAgainst;
}

/**
 * מחזיר מערך ממוין של שורות הטבלה (עם points ו-goalDiff מחושבים),
 * לפי נקודות -> הפרש שערים -> שערי זכות.
 */
export function sortedTable(table) {
  return Object.values(table)
    .map((row) => ({ ...row, points: points(row), goalDiff: goalDiff(row) }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });
}

/** מחזיר את המיקום (1-based) של קבוצה בטבלה הממוינת. */
export function teamPosition(table, teamId) {
  const sorted = sortedTable(table);
  const idx = sorted.findIndex((r) => r.teamId === teamId);
  return idx === -1 ? null : idx + 1;
}
