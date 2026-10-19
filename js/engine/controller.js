// בקר מרכזי: עוטף את כל פעולות המשחק (יצירת משחק, רכישה, הכרעת
// אירוע, התקדמות מחזור) ודואג לשמור אוטומטית אחרי כל פעולה שמשנה מצב.

import { createNewGame } from "./newGame.js";
import { playNextRound as advanceRound, closeTransferWindow as closeWindow } from "./round.js";
import { executeTransfer } from "./transferMarket.js";
import { resolveEventChoice } from "./events.js";
import { saveGame, loadGame, clearSavedGame, hasSavedGame } from "./save.js";
import { defaultRng } from "./rng.js";
import { draftCandidatePairs } from "./squad.js";

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
    if (state) this.state = state;
    return state;
  }

  startNewGame(leagueId, teamId = null, chosenPlayerIds = null, careerMode = false) {
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
