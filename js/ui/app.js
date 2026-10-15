// בקר ה-UI הראשי: מחבר בין GameController (מצב המשחק האמיתי) לבין
// מסכי הרינדור. מנהל גם מצב תצוגה זמני (איזה מסך מוצג, תור בין-מסכים
// אחרי מחזור, הודעות toast) שלא נשמר ב-localStorage.

import { GameController } from "../engine/controller.js";
import { loadPlayersFromFile } from "../engine/loadPlayers.js";
import { defaultRng } from "../engine/rng.js";
import {
  renderStartScreen,
  renderLeaguePick,
  renderHome,
  renderTable,
  renderFinances,
  renderTransferWindow,
  renderEvent,
  renderEventOutcome,
  renderRoundResult,
  renderSeasonEnd,
  renderGameOver,
} from "./render.js";

const appEl = document.getElementById("app");

let controller = null;
let allPlayers = null;

// מצב תצוגה זמני (לא נשמר)
const ui = {
  screen: "loading", // loading | start | leaguePick | home | table | finances | transferWindow | event | eventOutcome | roundResult | seasonEnd | gameOver
  confirmOverwrite: false,
  transferFeedback: null,
  screenQueue: [], // תור מסכים להצגה אחרי playNextRound (roundResult -> seasonEnd/gameOver/event)
  lastRoundSummary: null,
  lastFitnessDiffs: null,
  lastSeasonEndData: null,
  lastEventOutcome: null,
  toast: null,
};

function showToast(message, type = "success") {
  ui.toast = { message, type };
  render();
  setTimeout(() => {
    ui.toast = null;
    render();
  }, 2600);
}

function computeFitnessDiffs(beforeSquad, afterSquad) {
  const diffs = {};
  for (const after of afterSquad) {
    const before = beforeSquad.find((s) => s.playerId === after.playerId);
    diffs[after.playerId] = before ? after.fitness - before.fitness : 0;
  }
  return diffs;
}

function render() {
  let html = "";
  switch (ui.screen) {
    case "loading":
      html = `<div class="screen center-col"><div class="spinner"></div><p>טוען...</p></div>`;
      break;
    case "start":
      html = renderStartScreen({ hasSave: controller.hasSavedGame() });
      break;
    case "leaguePick":
      html = renderLeaguePick({ confirmOverwrite: ui.confirmOverwrite });
      break;
    case "home":
      html = renderHome({ state: controller.state, allPlayers });
      break;
    case "table":
      html = renderTable({ state: controller.state });
      break;
    case "finances":
      html = renderFinances({ state: controller.state });
      break;
    case "transferWindow":
      html = renderTransferWindow({ state: controller.state, allPlayers, feedback: ui.transferFeedback });
      break;
    case "event":
      html = renderEvent({ state: controller.state });
      break;
    case "eventOutcome":
      html = renderEventOutcome({ outcome: ui.lastEventOutcome });
      break;
    case "roundResult":
      html = renderRoundResult({
        state: controller.state,
        allPlayers,
        roundSummary: ui.lastRoundSummary,
        fitnessDiffs: ui.lastFitnessDiffs,
      });
      break;
    case "seasonEnd":
      html = renderSeasonEnd({
        state: controller.state,
        leagueId: controller.state.leagueId,
        teamId: controller.state.teamId,
        ...ui.lastSeasonEndData,
      });
      break;
    case "gameOver":
      html = renderGameOver({ state: controller.state, leagueId: controller.state.leagueId });
      break;
    default:
      html = `<div class="screen"><p>מסך לא ידוע: ${ui.screen}</p></div>`;
  }

  appEl.innerHTML = html + (ui.toast ? `<div class="toast ${ui.toast.type}">${ui.toast.message}</div>` : "");
  // תמיד גוללים לראש המסך במעבר בין מסכים, כדי שתוצאת המחזור/האירוע
  // החדש תהיה מיד גלויה בלי שהמשתמש יצטרך לגלול ידנית.
  window.scrollTo(0, 0);
}

function advanceScreenQueue() {
  if (ui.screenQueue.length === 0) {
    ui.screen = controller.state.gameOver ? "gameOver" : "home";
    render();
    return;
  }
  const next = ui.screenQueue.shift();
  ui.screen = next;
  render();
}

function handlePlayNextRoundResult(res) {
  if (!res.ok) {
    if (res.needsAction === "transferWindow") {
      ui.screen = "transferWindow";
      ui.transferFeedback = null;
      render();
      return;
    }
    showToast(res.reason, "error");
    return;
  }

  if (res.needsAction === "transferWindow") {
    ui.screen = "transferWindow";
    ui.transferFeedback = null;
    render();
    return;
  }

  // התקדמות מחזור בוצעה בהצלחה
  const squadBefore = ui.preRoundSquad || controller.state.squad;
  ui.lastRoundSummary = res.roundSummary;
  ui.lastFitnessDiffs = computeFitnessDiffs(squadBefore, res.state.squad);

  ui.screenQueue = ["roundResult"];
  if (res.seasonEnded) {
    if (res.bankrupt) {
      ui.screenQueue.push("gameOver");
    } else {
      ui.lastSeasonEndData = {
        summary: res.seasonEndSummary,
        championTeamId: res.championTeamId,
        finalPosition: res.finalPosition,
        bankrupt: false,
      };
      ui.screenQueue.push("seasonEnd");
    }
  } else if (res.state.pendingEvent) {
    ui.screenQueue.push("event");
  }

  advanceScreenQueue();
}

function onPlayNextRound() {
  ui.preRoundSquad = controller.state.squad;
  const res = controller.playNextRound();
  handlePlayNextRoundResult(res);
}

function onBuyPlayer(playerId) {
  const res = controller.buyPlayer(playerId);
  if (res.ok) {
    ui.transferFeedback = { ok: true, message: "הרכישה בוצעה בהצלחה!" };
  } else {
    ui.transferFeedback = { ok: false, message: res.reason };
  }
  render();
}

function onCloseTransferWindow() {
  controller.closeTransferWindow();
  ui.transferFeedback = null;
  ui.screen = "home";
  render();
}

function onResolveEvent(optionId) {
  controller.resolveEvent(optionId);
  ui.lastEventOutcome = controller.state.lastEventOutcome || null;
  ui.screen = "eventOutcome";
  render();
}

function onContinueAfterEventOutcome() {
  ui.lastEventOutcome = null;
  advanceScreenQueue();
}

async function onStartNewGame(leagueId) {
  controller.startNewGame(leagueId);
  ui.confirmOverwrite = false;
  ui.screen = "home";
  render();
}

function wireEvents() {
  appEl.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      case "goto-new-game":
        ui.confirmOverwrite = controller.hasSavedGame();
        ui.screen = "leaguePick";
        render();
        break;
      case "continue-game": {
        const loaded = controller.loadSavedGame();
        if (loaded) {
          ui.screen = loaded.gameOver ? "gameOver" : "home";
          render();
        } else {
          showToast("לא נמצא משחק שמור", "error");
        }
        break;
      }
      case "confirm-new-game":
        ui.confirmOverwrite = false;
        render();
        break;
      case "cancel-new-game":
        ui.screen = "start";
        render();
        break;
      case "back-to-start":
        ui.screen = "start";
        render();
        break;
      case "pick-league":
        onStartNewGame(el.dataset.league);
        break;
      case "tab":
        ui.screen = el.dataset.tab;
        render();
        break;
      case "play-round":
        onPlayNextRound();
        break;
      case "buy-player":
        onBuyPlayer(Number(el.dataset.player));
        break;
      case "close-transfer-window":
        onCloseTransferWindow();
        break;
      case "resolve-event":
        onResolveEvent(el.dataset.option);
        break;
      case "continue-event-outcome":
        onContinueAfterEventOutcome();
        break;
      case "continue-flow":
        advanceScreenQueue();
        break;
      default:
        break;
    }
  });
}

async function init() {
  wireEvents();
  render();
  try {
    allPlayers = await loadPlayersFromFile("players.json");
  } catch (err) {
    appEl.innerHTML = `
      <div class="screen">
        <div class="card">
          <h2>שגיאה בטעינת מאגר השחקנים</h2>
          <p>${err.message}</p>
          <p class="muted">ודא שקובץ players.json נמצא באותה תיקייה ושהוא תקין.</p>
        </div>
      </div>`;
    return;
  }

  controller = new GameController(allPlayers, defaultRng);
  // תמיד מתחילים במסך הפתיחה: "משחק חדש" או "המשך משחק שמור" (אם קיים),
  // בהתאם לדרישה שהבחירה תוצג למשתמש ולא תיטען אוטומטית.
  ui.screen = "start";
  render();
}

init();
