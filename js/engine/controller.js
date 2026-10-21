// בקר מרכזי: עוטף את כל פעולות המשחק (יצירת משחק, רכישה, הכרעת
// אירוע, התקדמות מחזור) ודואג לשמור אוטומטית אחרי כל פעולה שמשנה מצב.

import { createNewGame } from "./newGame.js";
import { playNextRound as advanceRound, closeTransferWindow as closeWindow } from "./round.js";
import { executeTransfer } from "./transferMarket.js";
import { resolveEventChoice } from "./events.js";
import { saveGame, loadGame, clearSavedGame, hasSavedGame } from "./save.js";
import { defaultRng } from "./rng.js";
import { draftCandidatePairs } from "./squad.js";
import { resolveStageTeams, CAREER_STAGES } from "./career.js";
import { assignSeasonRosters } from "./playerStats.js";

/**
 * מעדכן שמירה שנטענה מהמכשיר למבנה/לכללים הנוכחיים, בלי לגעת בהתקדמות:
 * 1. משחק חופשי בוטל - שמירה במצב חופשי (careerMode=false, או בלי השדה
 *    בכלל כמו בשמירות מוקדמות) הופכת למסלול "ממתחיל לאגדה", כשהשלב הוא
 *    הליגה שבה השמירה נמצאת כרגע. מאותו רגע חלים עליה כללי הקריירה
 *    (עליית שלב באליפות, מכפיל כספי שלב).
 * 2. שמירות מלפני פיצ'ר "מלך שערי העונה" חסרות teamRosters - בונים אותו
 *    מחדש, אחרת "שחק מחזור הבא" קורס (ראו playerStats.js).
 */
function migrateLoadedState(state, allPlayers, rng) {
  let s = state;
  if (!s.careerMode) {
    s = {
      ...s,
      careerMode: true,
      careerStageIndex: Math.max(0, CAREER_STAGES.indexOf(s.leagueId)),
      careerWon: !!s.careerWon,
    };
  }
  if (!s.teamRosters) {
    const teamIds = resolveStageTeams(s.leagueId, s.teamId).map((t) => t.id);
    s = { ...s, teamRosters: assignSeasonRosters(teamIds, s.teamId, s.squad, allPlayers, rng) };
  }
  if (!s.playerStats) s = { ...s, playerStats: {} };
  return s;
}

export class GameController {
  constructor(allPlayers, rng = defaultRng) {
    this.allPlayers = allPlayers;
    this.rng = rng;
    this.state = null;
  }

  hasSavedGame() {
    return hasSavedGame();
  }

  loadSavedGame() {
    const state = loadGame();
    if (state) {
      this.state = migrateLoadedState(state, this.allPlayers, this.rng);
      // שומרים מיד את המצב הממוגר, כדי שהשמירה במכשיר תהיה תקינה גם אם
      // המשתמש לא יבצע שום פעולה אחרי הטעינה.
      saveGame(this.state);
    }
    return this.state;
  }

  startNewGame(leagueId, teamId = null, chosenPlayerIds = null, careerMode = true) {
    this.state = createNewGame(leagueId, this.allPlayers, this.rng, teamId, chosenPlayerIds, careerMode);
    saveGame(this.state);
    return this.state;
  }

  draftCandidatePairs() {
    return draftCandidatePairs(this.allPlayers, this.rng);
  }

  playNextRound() {
    const result = advanceRound(this.state, this.allPlayers, this.rng);
    if (result.ok) {
      this.state = result.state;
      saveGame(this.state);
    }
    return result;
  }

  buyPlayer(playerId) {
    const result = executeTransfer(this.state, this.allPlayers, playerId, this.rng);
    if (result.ok) {
      this.state = result.state;
      saveGame(this.state);
    }
    return result;
  }

  closeTransferWindow() {
    this.state = closeWindow(this.state);
    saveGame(this.state);
    return this.state;
  }

  resolveEvent(optionId) {
    this.state = resolveEventChoice(this.state, this.allPlayers, optionId, this.rng);
    saveGame(this.state);
    return this.state;
  }

  deleteSave() {
    clearSavedGame();
    this.state = null;
  }
}
