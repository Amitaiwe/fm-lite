// טיפול בסיום עונה: פרסים, התחייבויות, שכר, אינפלציה, בדיקת פשיטת רגל,
// ופתיחת עונה חדשה (אותה ליגה וקבוצה, סגל זהה, כושר מתאפס, טבלה ולוח חדשים).

import { sortedTable, initTable } from "./table.js";
import { processSeasonEndEconomy, emptySeasonFinance } from "./economy.js";
import { applySeasonFitnessSwing, resetAbilityToBase } from "./squad.js";
import { generateFixtures } from "./fixtures.js";

/**
 * מבצע את כל שלבי סיום העונה. מחזיר { state, summary, bankrupt, championTeamId, finalTable }.
 * אם bankrupt=true, state.gameOver מוגדר ואין לפתוח עונה חדשה.
 */
export function endSeason(state, teamIds, rng) {
  const finalTableSorted = sortedTable(state.table);
  const finalPosition = finalTableSorted.findIndex((r) => r.teamId === state.teamId) + 1;
  const championTeamId = finalTableSorted[0]?.teamId ?? null;

  const { state: afterEconomy, summary, bankrupt } = processSeasonEndEconomy(state, finalPosition);

  const financeHistory = [
    ...state.financeHistory,
    {
      season: state.season,
      finalPosition,
      finance: state.finance,
      prize: summary.prize,
      endingBudget: afterEconomy.budget,
      champion: championTeamId === state.teamId,
    },
  ];

  if (bankrupt) {
    return {
      state: {
        ...afterEconomy,
        financeHistory,
        gameOver: {
          reason: "bankruptcy",
          atSeason: state.season,
          finalPosition,
        },
      },
      summary,
      bankrupt: true,
      championTeamId,
      finalPosition,
    };
  }

  // פתיחת עונה חדשה: אותה ליגה וקבוצה, סגל זהה (כושר זז ±SEASON_FITNESS_SWING
  // מהרמה שהייתה בסוף העונה הקודמת - לא איפוס/הגרלה מאפס), טבלה ולוח חדשים.
  // יכולת כל שחקן חוזרת ל-baseAbility שלו - כל עלייה/ירידה מאירועים
  // הייתה זמנית לעונה אחת בלבד, כדי ששוק ההעברות יישאר רלוונטי.
  const squadWithResetAbility = resetAbilityToBase(afterEconomy.squad);
  const refreshedSquad = applySeasonFitnessSwing(squadWithResetAbility, rng);
  const newFixtures = generateFixtures(teamIds);
  const newTable = initTable(teamIds);

  const newState = {
    ...afterEconomy,
    squad: refreshedSquad,
    season: state.season + 1,
    round: 0,
    fixtures: newFixtures,
    table: newTable,
    matchResultsByRound: {},
    finance: emptySeasonFinance(),
    financeHistory,
    transferWindow: null,
    resolvedTransferWindows: [],
    lastRoundSummary: null,
  };

  return { state: newState, summary, bankrupt: false, championTeamId, finalPosition };
}
