// יצירת משחק חדש: בחירת ליגה -> הגרלת קבוצה -> תקציב התחלתי -> הגרלת
// סגל -> יצירת לוח מחזורים וטבלה ריקה לעונה הראשונה.

import { SETTINGS } from "../data/settings.js";
import { getLeague } from "../data/leagues.js";
import { draftInitialSquad, buildSquadFromChoices } from "./squad.js";
import { generateFixtures } from "./fixtures.js";
import { initTable } from "./table.js";
import { emptySeasonFinance } from "./economy.js";
import { pickRandom } from "./rng.js";
import { resolveStageTeams } from "./career.js";

export const GAME_VERSION = 1;

/**
 * יוצר מצב משחק חדש לגמרי, מתוך ליגה שנבחרה ומאגר השחקנים.
 * teamId אופציונלי - אם ניתן (ותקף לליגה), הקבוצה הזו תנוהל במקום הגרלה אקראית.
 * chosenPlayerIds אופציונלי - מזהה שחקן לכל עמדה, ממסך בחירת הסגל; אם לא
 * ניתן, מגרילים סגל אקראי לגמרי כמו קודם.
 * careerMode - אם true, זהו תחילת מסלול "ממתחיל לאגדה" (ראו career.js):
 * הקבוצה הנבחרת "תטייל" בין הליגות בכל עלייה, במקום להישאר קבועה לנצח
 * באותה ליגה כמו במשחק חופשי רגיל.
 */
export function createNewGame(leagueId, allPlayers, rng, teamId = null, chosenPlayerIds = null, careerMode = false) {
  const league = getLeague(leagueId);
  if (!league) {
    throw new Error(`ליגה לא קיימת: ${leagueId}`);
  }
  const chosenTeam = teamId ? league.teams.find((t) => t.id === teamId) : null;
  const userTeam = chosenTeam || pickRandom(rng, league.teams);
  const teamIds = resolveStageTeams(leagueId, userTeam.id).map((t) => t.id);
  const squad = chosenPlayerIds
    ? buildSquadFromChoices(allPlayers, rng, chosenPlayerIds)
    : draftInitialSquad(allPlayers, rng);
  const fixtures = generateFixtures(teamIds);
  const table = initTable(teamIds);

  return {
    version: GAME_VERSION,
    createdAt: Date.now(),
    leagueId,
    teamId: userTeam.id,
    careerMode,
    careerStageIndex: careerMode ? 0 : null,
    careerWon: false,
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
