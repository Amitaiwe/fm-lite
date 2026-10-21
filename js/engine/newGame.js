// יצירת משחק חדש: בחירת ליגה -> הגרלת קבוצה -> תקציב התחלתי -> הגרלת
// סגל -> יצירת לוח מחזורים וטבלה ריקה לעונה הראשונה.

import { SETTINGS } from "../data/settings.js";
import { getLeague, findTeamAnywhere } from "../data/leagues.js";
import { draftInitialSquad, buildSquadFromChoices } from "./squad.js";
import { generateFixtures } from "./fixtures.js";
import { initTable } from "./table.js";
import { emptySeasonFinance } from "./economy.js";
import { pickRandom } from "./rng.js";
import { resolveStageTeams, CAREER_STAGES } from "./career.js";
import { assignSeasonRosters } from "./playerStats.js";

export const GAME_VERSION = 1;

/**
 * יוצר מצב משחק חדש לגמרי, מתוך ליגה שנבחרה ומאגר השחקנים.
 * teamId אופציונלי - אם ניתן (ותקף לליגה), הקבוצה הזו תנוהל במקום הגרלה אקראית.
 * chosenPlayerIds אופציונלי - מזהה שחקן לכל עמדה, ממסך בחירת הסגל; אם לא
 * ניתן, מגרילים סגל אקראי לגמרי כמו קודם.
 * careerMode - מסלול "ממתחיל לאגדה" (ראו career.js): הקבוצה הנבחרת
 * "מטיילת" בין הליגות בכל עלייה. מאז ביטול המשחק החופשי זהו מצב המשחק
 * היחיד, ולכן ברירת המחדל היא true; הפרמטר נשאר למען תאימות מבנה
 * השמירה (state.careerMode קיים בכל שמירה ישנה).
 */
export function createNewGame(leagueId, allPlayers, rng, teamId = null, chosenPlayerIds = null, careerMode = true) {
  const league = getLeague(leagueId);
  if (!league) {
    throw new Error(`ליגה לא קיימת: ${leagueId}`);
  }
  // teamId יכול להיות קבוצה שלא טבעית ל-leagueId (למשל במסלול הקריירה,
  // שתמיד מתחיל בצרפת אבל אפשר לבחור קבוצה מכל אחת מ-5 הליגות) - אז
  // מחפשים אותה בכל הליגות ולא רק ברשימה הסטטית של leagueId.
  const chosenTeam = teamId ? league.teams.find((t) => t.id === teamId) || findTeamAnywhere(teamId) : null;
  const userTeam = chosenTeam || pickRandom(rng, league.teams);
  const teamIds = resolveStageTeams(leagueId, userTeam.id).map((t) => t.id);
  const squad = chosenPlayerIds
    ? buildSquadFromChoices(allPlayers, rng, chosenPlayerIds)
    : draftInitialSquad(allPlayers, rng);
  const fixtures = generateFixtures(teamIds, rng);
  const table = initTable(teamIds);
  // "סגל סטטיסטי" דקורטיבי ל-13 הקבוצות היריבות (ראו playerStats.js) -
  // לצורך טבלת מלך שערי העונה/הבישולים, לא משפיע על עוצמת הקבוצה.
  const teamRosters = assignSeasonRosters(teamIds, userTeam.id, squad, allPlayers, rng);

  return {
    version: GAME_VERSION,
    createdAt: Date.now(),
    leagueId,
    teamId: userTeam.id,
    careerMode,
    careerStageIndex: careerMode ? Math.max(0, CAREER_STAGES.indexOf(leagueId)) : null,
    careerWon: false,
    season: 1,
    round: 0, // מספר המחזורים שהושלמו בעונה הנוכחית
    budget: SETTINGS.STARTING_BUDGET,
    squad,
    fixtures,
    table,
    teamRosters,
    playerStats: {},
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
