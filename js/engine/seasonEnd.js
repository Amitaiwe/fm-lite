// טיפול בסיום עונה: פרסים, התחייבויות, שכר, אינפלציה, בדיקת פשיטת רגל,
// ופתיחת עונה חדשה (אותה ליגה וקבוצה, סגל זהה, כושר מתאפס, טבלה ולוח חדשים).

import { SETTINGS } from "../data/settings.js";
import { sortedTable, initTable } from "./table.js";
import { processSeasonEndEconomy, emptySeasonFinance, ledgerBudgetChange } from "./economy.js";
import { applySeasonFitnessSwing, resetAbilityToBase } from "./squad.js";
import { generateFixtures } from "./fixtures.js";
import { nextCareerLeagueId, resolveStageTeams, careerMoneyMultiplier } from "./career.js";
import { assignSeasonRosters, topTwoScorers } from "./playerStats.js";

/**
 * מבצע את כל שלבי סיום העונה. מחזיר { state, summary, bankrupt, championTeamId,
 * finalPosition, careerAdvanced, careerNewLeagueId, careerWon }.
 * אם bankrupt=true, state.gameOver מוגדר ואין לפתוח עונה חדשה.
 * teamIds הוא רשימת 14 הקבוצות של השלב שהסתיים כרגע (ראו career.js) -
 * אם זה מסלול קריירה ואלופים, מתעלמים ממנה וממשיכים לשלב הבא.
 * allPlayers נדרש כדי להגריל סגלים סטטיסטיים טריים ל"מלך שערי העונה"
 * (ראו playerStats.js) לעונה הבאה.
 */
export function endSeason(state, teamIds, allPlayers, rng) {
  const finalTableSorted = sortedTable(state.table);
  const finalPosition = finalTableSorted.findIndex((r) => r.teamId === state.teamId) + 1;
  const championTeamId = finalTableSorted[0]?.teamId ?? null;

  // סיכום תוצאות המשחקים של הקבוצה שלנו בעונה הזו (ניצחונות/תיקו/הפסדים) -
  // חייבים לקרוא את זה *לפני* איפוס הטבלה לעונה הבאה בהמשך הפונקציה.
  // משמש מסך סיכום העונה להציג את בונוסי המשחקים בנפרד משוק ההעברות.
  const userRow = state.table[state.teamId];
  const matchRecord = userRow
    ? { won: userRow.won, drawn: userRow.drawn, lost: userRow.lost }
    : { won: 0, drawn: 0, lost: 0 };

  // בונוס מלך השערים וסגנו - משולם רק אם הם שחקני הסגל של המשתמש.
  // מחושב לפני הכלכלה כדי שייכנס לבדיקת פשיטת הרגל. הסטטיסטיקה עוד לא אופסה.
  const scorerMult = careerMoneyMultiplier(state);
  const scorerBonusAmounts = [SETTINGS.TOP_SCORER_BONUS, SETTINGS.RUNNER_UP_SCORER_BONUS];
  const topScorers = topTwoScorers(state.playerStats).map((r, i) => ({
    rank: i + 1,
    playerId: r.playerId,
    goals: r.goals,
    teamId: r.teamId,
    isUser: r.teamId === state.teamId,
    bonus: r.teamId === state.teamId ? Math.round(scorerBonusAmounts[i] * scorerMult) : 0,
  }));
  let stateForEconomy = state;
  for (const t of topScorers) {
    if (t.bonus > 0) stateForEconomy = ledgerBudgetChange(stateForEconomy, t.bonus, "scorerBonuses", false);
  }

  const { state: afterEconomy, summary: economySummary, bankrupt } = processSeasonEndEconomy(stateForEconomy, finalPosition);
  const summary = { ...economySummary, matchRecord, topScorers };

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
      careerAdvanced: false,
      careerNewLeagueId: null,
      careerWon: false,
    };
  }

  // מסלול "ממתחיל לאגדה": אם אלופים, עוברים לליגה הבאה במסלול (הקבוצה
  // המטיילת מצטרפת אליה במקום החלשה ביותר שם - ראו career.js). אם לא
  // אלופים, פשוט נשארים לנסות שוב באותו שלב בעונה הבאה. אם כבר בשלב
  // האחרון (ליגת האלופות) ואלופים - "אגדה", ממשיכים לשחק שם הלאה.
  const isCareerChampion = state.careerMode && championTeamId === state.teamId;
  let newLeagueId = state.leagueId;
  let newCareerStageIndex = state.careerStageIndex;
  let careerAdvanced = false;
  let careerWon = false;
  let effectiveTeamIds = teamIds;

  if (isCareerChampion) {
    const next = nextCareerLeagueId(state.leagueId);
    if (next) {
      newLeagueId = next;
      newCareerStageIndex = (state.careerStageIndex ?? 0) + 1;
      careerAdvanced = true;
      effectiveTeamIds = resolveStageTeams(newLeagueId, state.teamId).map((t) => t.id);
    } else {
      careerWon = true;
    }
  }

  // פתיחת עונה חדשה: אותה קבוצה, סגל זהה (כושר זז ±SEASON_FITNESS_SWING
  // מהרמה שהייתה בסוף העונה הקודמת - לא איפוס/הגרלה מאפס), טבלה ולוח חדשים
  // (לליגה החדשה אם הייתה עלייה, אחרת לאותה ליגה כמו קודם).
  // יכולת כל שחקן חוזרת ל-baseAbility שלו - כל עלייה/ירידה מאירועים
  // הייתה זמנית לעונה אחת בלבד, כדי ששוק ההעברות יישאר רלוונטי.
  const squadWithResetAbility = resetAbilityToBase(afterEconomy.squad);
  const refreshedSquad = applySeasonFitnessSwing(squadWithResetAbility, rng);
  const newFixtures = generateFixtures(effectiveTeamIds, rng);
  const newTable = initTable(effectiveTeamIds);
  // "מלך שערי העונה/הבישולים" - הגרלת סגלים סטטיסטיים טריים ואיפוס
  // הסטטיסטיקה בכל עונה חדשה (ראו playerStats.js), בדיוק כמו שהלוח
  // והטבלה מתאפסים - כולל במעבר שלב במסלול הקריירה (effectiveTeamIds
  // כבר מעודכן לרשימת הקבוצות של השלב הבא אם הייתה עלייה).
  const newTeamRosters = assignSeasonRosters(effectiveTeamIds, state.teamId, refreshedSquad, allPlayers, rng);

  const newState = {
    ...afterEconomy,
    squad: refreshedSquad,
    leagueId: newLeagueId,
    careerStageIndex: newCareerStageIndex,
    careerWon: state.careerWon || careerWon,
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
    teamRosters: newTeamRosters,
    playerStats: {},
  };

  return {
    state: newState,
    summary,
    bankrupt: false,
    championTeamId,
    finalPosition,
    careerAdvanced,
    careerNewLeagueId: careerAdvanced ? newLeagueId : null,
    careerWon,
  };
}
