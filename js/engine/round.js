// הבקר המרכזי (orchestrator) של התקדמות מחזור: הלב של לולאת המשחק. אחראי על הסדר הנכון
// (אירוע ממתין -> חלון העברות -> סימולציית מחזור -> בדיקת סוף עונה ->
// אירוע חדש), ועל מניעת סימולציה כפולה של אותו מחזור.

import { SETTINGS } from "../data/settings.js";
import { getLeague } from "../data/leagues.js";
import { findTeamMatch } from "./fixtures.js";
import { computeManagedTeamStrength, simulateMatch } from "./simulate.js";
import { applyMatchResult, sortedTable } from "./table.js";
import { applyMatchBonusPenalty } from "./economy.js";
import { generateTransferWindowPlayers } from "./transferMarket.js";
import { shouldTriggerEvent, triggerEvent } from "./events.js";
import { endSeason } from "./seasonEnd.js";

function teamStrengthMap(league) {
  const map = {};
  for (const t of league.teams) map[t.id] = t.baseStrength;
  return map;
}

export function needsTransferWindow(state) {
  return (
    !state.gameOver &&
    !state.pendingEvent &&
    !state.transferWindow &&
    SETTINGS.TRANSFER_WINDOW_ROUNDS.includes(state.round) &&
    !state.resolvedTransferWindows.includes(state.round)
  );
}

export function openTransferWindow(state, allPlayers, rng) {
  const players = generateTransferWindowPlayers(allPlayers, rng);
  return { ...state, transferWindow: { atRound: state.round, players } };
}

export function closeTransferWindow(state) {
  if (!state.transferWindow) return state;
  return {
    ...state,
    resolvedTransferWindows: [...state.resolvedTransferWindows, state.transferWindow.atRound],
    transferWindow: null,
  };
}

/**
 * מתקדם מחזור אחד: בודק חסימות (אירוע ממתין / חלון העברות שצריך
 * להיפתח), ואם אפשר, מסמלץ את כל משחקי המחזור ומעדכן את הטבלה.
 * מחזיר { ok, reason? , state, needsAction?, roundSummary?, seasonEnded?, ... }
 */
export function playNextRound(state, allPlayers, rng) {
  if (state.gameOver) {
    return { ok: false, reason: "המשחק הסתיים", state };
  }
  if (state.pendingEvent) {
    return { ok: false, reason: "יש להכריע באירוע הממתין לפני המשך", state, needsAction: "event" };
  }
  if (state.transferWindow) {
    return { ok: false, reason: "יש לסגור את חלון ההעברות לפני המשך", state, needsAction: "transferWindow" };
  }
  if (needsTransferWindow(state)) {
    const opened = openTransferWindow(state, allPlayers, rng);
    return { ok: true, state: opened, needsAction: "transferWindow" };
  }

  const league = getLeague(state.leagueId);
  const strengths = teamStrengthMap(league);
  const roundIndex = state.round; // round = כמה מחזורים הושלמו = אינדקס המחזור הבא
  const round = state.fixtures[roundIndex];
  if (!round) {
    return { ok: false, reason: "אין עוד מחזורים בעונה זו", state };
  }

  let table = { ...state.table };
  // עותק עמוק מספיק לשורות הטבלה
  for (const teamId of Object.keys(table)) table[teamId] = { ...table[teamId] };

  const allMatches = [];
  let userMatch = null;
  let userOutcome = null;
  let economyState = state;

  for (const [teamA, teamB] of round) {
    const isUserMatchA = teamA === state.teamId;
    const isUserMatchB = teamB === state.teamId;
    const strengthA = isUserMatchA ? computeManagedTeamStrength(state.squad) : strengths[teamA];
    const strengthB = isUserMatchB ? computeManagedTeamStrength(state.squad) : strengths[teamB];
    const { teamAGoals, teamBGoals } = simulateMatch(strengthA, strengthB, rng);
    const match = { homeTeam: teamA, awayTeam: teamB, homeGoals: teamAGoals, awayGoals: teamBGoals };
    applyMatchResult(table, match);
    allMatches.push(match);

    if (isUserMatchA || isUserMatchB) {
      userMatch = match;
      const userGoals = isUserMatchA ? teamAGoals : teamBGoals;
      const oppGoals = isUserMatchA ? teamBGoals : teamAGoals;
      userOutcome = userGoals > oppGoals ? "win" : userGoals < oppGoals ? "loss" : "draw";
      economyState = applyMatchBonusPenalty(economyState, userOutcome);
    }
  }

  const newRoundCount = state.round + 1;
  let newState = {
    ...economyState,
    table,
    round: newRoundCount,
    matchResultsByRound: { ...state.matchResultsByRound, [roundIndex]: allMatches },
  };

  const roundSummary = {
    roundIndex,
    userMatch,
    userOutcome, // null אם הקבוצה נחה במחזור זה
    standings: sortedTable(table),
  };
  newState = { ...newState, lastRoundSummary: roundSummary };

  // סוף עונה?
  if (newRoundCount >= state.fixtures.length) {
    const teamIds = league.teams.map((t) => t.id);
    const result = endSeason(newState, teamIds, rng);
    return {
      ok: true,
      state: result.state,
      roundSummary,
      seasonEnded: true,
      seasonEndSummary: result.summary,
      championTeamId: result.championTeamId,
      finalPosition: result.finalPosition,
      bankrupt: result.bankrupt,
    };
  }

  // בדיקת אירוע חדש אחרי כל N מחזורים
  if (shouldTriggerEvent(newRoundCount)) {
    newState = triggerEvent(newState, allPlayers, rng);
  }

  return { ok: true, state: newState, roundSummary, seasonEnded: false };
}
