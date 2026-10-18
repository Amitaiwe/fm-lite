// יצירת משחק חדש: בחירת ליגה -> הגרלת קבוצה -> תקציב התחלתי -> הגרלת
// סגל -> יצירת לוח מחזורים וטבלה ריקה לעונה הראשונה.

import { SETTINGS } from "../data/settings.js";
import { getLeague } from "../data/leagues.js";
import { draftInitialSquad } from "./squad.js";
import { generateFixtures } from "./fixtures.js";
import { initTable } from "./table.js";
import { emptySeasonFinance } from "./economy.js";
import { pickRandom } from "./rng.js";

export const GAME_VERSION = 1;

/**
 * יוצר מצב משחק חדש לגמרי, מתוך ליגה שנבחרה ומאגר השחקנים.
 * teamId אופציונלי - אם ניתן (ותקף לליגה), הקבוצה הזו תנוהל במקום הגרלה אקראית.
 */
export function createNewGame(leagueId, allPlayers, rng, teamId = null) {
  const league = getLeague(leagueId);
  if (!league) {
    throw new Error(`ליגה לא קיימת: ${leagueId}`);
  }
  const teamIds = league.teams.map((t) => t.id);
  const chosenTeam = teamId ? league.teams.find((t) => t.id === teamId) : null;
  const userTeam = chosenTeam || pickRandom(rng, league.teams);
  const squad = draftInitialSquad(allPlayers, rng);
  const fixtures = generateFixtures(teamIds);
  const table = initTable(teamIds);

  return {
    version: GAME_VERSION,
    createdAt: Date.now(),
    leagueId,
    teamId: userTeam.id,
    season: 1,
    round: 0, // מספר המחזורים שהושלמו בעונה הנוכחית
    budget: SETTINGS.STARTING_BUDGET,
    squad,
    fixtures,
    table,
    matchResultsByRound: {}, // round index (0-based) -> array of {homeTeam, awayTeam, homeGoals, awayGoals}
    commitments: [],
    finance: emptySeasonFinance(),
    financeHistory: [],
    pendingEvent: null,
    lastEventId: null,
    eventLog: [],
    transferWindow: null, // {windowAt, players:[ids], resolved:false} כשפתוח
    resolvedTransferWindows: [], // אינדקסי מחזור שכבר נפתחו ונסגרו העונה
    gameOver: null,
    lastRoundSummary: null,
  };
}
