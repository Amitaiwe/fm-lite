// בקר ה-UI הראשי: מחבר בין GameController (מצב המשחק האמיתי) לבין
// מסכי הרינדור. מנהל גם מצב תצוגה זמני (איזה מסך מוצג, תור בין-מסכים
// אחרי מחזור, הודעות toast) שלא נשמר ב-localStorage.

import { GameController } from "../engine/controller.js";
import { loadPlayersFromFile } from "../engine/loadPlayers.js";
import { defaultRng } from "../engine/rng.js";
import { needsTransferWindow } from "../engine/round.js";
import { findTeamMatch } from "../engine/fixtures.js";
import { CAREER_STAGES } from "../engine/career.js";
import { SETTINGS } from "../data/settings.js";
import { getNameLang, setNameLang } from "./format.js";
import {
  renderStartScreen,
  renderLeaguePick,
  renderTeamPick,
  renderSquadDraft,
  renderHome,
  renderTable,
  renderPlayerStats,
  renderFinances,
  renderTransferWindow,
  renderEvent,
  renderEventSpin,
  renderEventOutcome,
  renderScouting,
  renderRoundResult,
  renderSeasonEnd,
  renderGameOver,
} from "./render.js";

const appEl = document.getElementById("app");

let controller = null;
let allPlayers = null;

// מצב תצוגה זמני (לא נשמר)
const ui = {
  screen: "loading", // loading | start | leaguePick | teamPick | squadDraft | home | table | finances | transferWindow | scouting | event | eventSpin | eventOutcome | roundResult | seasonEnd | gameOver
  confirmOverwrite: false,
  pickedLeagueId: null,
  transferFeedback: null,
  draftLeagueId: null,
  draftTeamId: null,
  draftCandidates: null, // { [position]: [playerRecord, playerRecord] } - מוגרל פעם אחת בתחילת הבחירה
  draftPositions: null,
  draftStepIndex: 0,
  draftChoices: null, // { [position]: playerId }
  screenQueue: [], // תור מסכים להצגה אחרי playNextRound (roundResult -> seasonEnd/gameOver/event)
  lastRoundSummary: null,
  lastFitnessDiffs: null,
  lastSeasonEndData: null,
  lastEventOutcome: null,
  spinData: null, // { title, optionLabel, branches, winningLabel } - להגרלת eventSpin
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
    case "teamPick":
      html = renderTeamPick({ leagueId: ui.pickedLeagueId });
      break;
    case "squadDraft": {
      const position = ui.draftPositions[ui.draftStepIndex];
      html = renderSquadDraft({
        position,
        candidates: ui.draftCandidates[position],
        stepIndex: ui.draftStepIndex,
        totalSteps: ui.draftPositions.length,
      });
      break;
    }
    case "home":
      html = renderHome({ state: controller.state, allPlayers });
      break;
    case "table":
      html = renderTable({ state: controller.state });
      break;
    case "finances":
      html = renderFinances({ state: controller.state });
      break;
    case "stats":
      html = renderPlayerStats({ state: controller.state, allPlayers });
      break;
    case "transferWindow":
      html = renderTransferWindow({ state: controller.state, allPlayers, feedback: ui.transferFeedback });
      break;
    case "scouting":
      html = renderScouting({ state: controller.state });
      break;
    case "event":
      html = renderEvent({ state: controller.state });
      break;
    case "eventSpin":
      html = renderEventSpin(ui.spinData);
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

  // שורת החלפת שפת שמות השחקנים - מוצגת מעל כל מסך (כולל פתיחה,
  // בחירת סגל ואירועים), כך שההחלפה זמינה תמיד והבחירה נשמרת
  // ב-localStorage (ראו format.js).
  const nameLang = getNameLang();
  const langBarHtml = `<div class="name-lang-bar"><button class="name-lang-toggle" data-action="toggle-name-lang">🌐 ${nameLang === "en" ? "שמות שחקנים: English" : "שמות שחקנים: עברית"}</button></div>`;

  appEl.innerHTML = langBarHtml + html + (ui.toast ? `<div class="toast ${ui.toast.type}">${ui.toast.message}</div>` : "");
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
        leagueId: res.seasonLeagueId,
        summary: res.seasonEndSummary,
        championTeamId: res.championTeamId,
        finalPosition: res.finalPosition,
        bankrupt: false,
        careerAdvanced: res.careerAdvanced,
        careerNewLeagueId: res.careerNewLeagueId,
        careerWon: res.careerWon,
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

/**
 * נלחץ על "שחק מחזור הבא" בבית: אם המחזור הבא הוא משחק אמיתי של
 * הקבוצה שלנו (לא מחזור מנוחה, ואין חלון העברות/אירוע שצריך להיפתח
 * קודם) - מציגים קודם מסך סקאוטינג על היריבה, ורק בלחיצה על "התחל
 * משחק" שם מריצים בפועל את playNextRound. במחזור מנוחה (אין יריב
 * לסקאוט) ממשיכים ישר כמו קודם.
 */
function onPlayRoundClicked() {
  const state = controller.state;
  if (!state.pendingEvent && !state.transferWindow && !needsTransferWindow(state)) {
    const round = state.fixtures[state.round];
    const match = round ? findTeamMatch(round, state.teamId) : null;
    if (match) {
      ui.screen = "scouting";
      render();
      return;
    }
  }
  onPlayNextRound();
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

/**
 * מפעיל את אנימציית ה"הגרלה" (סרט פלחים שזז ונעצר) על מסך eventSpin:
 * הפוקוס האמיתי (RNG) כבר הוכרע בשלב onResolveEvent, כך שהאנימציה כאן
 * היא ויזואלית בלבד - 3 שניות, מתחילה מהר ומאטה לקראת הסוף (סגנון
 * מחוג רולטה), ונעצרת בדיוק על הפריט האחרון בסרט (שהוא תמיד תוצאת
 * הניצחון בפועל - ראו buildReelItems ב-render.js). דורשת מדידת DOM
 * אמיתית (offsetLeft/clientWidth), ולכן מופעלת רק אחרי שהמסך צויר.
 */
function startEventSpin() {
  const track = document.getElementById("reel-track");
  const viewport = document.getElementById("reel-viewport");
  if (!track || !viewport || !track.lastElementChild) {
    ui.screen = "eventOutcome";
    render();
    return;
  }
  const target = track.lastElementChild;
  track.style.transition = "none";
  track.style.transform = "translateX(0px)";
  // "זריקת" reflow כדי שהדפדפן יקליט את מצב ההתחלה לפני שמתחילים לאנימץ
  void track.offsetWidth;
  const targetCenter = target.offsetLeft + target.offsetWidth / 2;
  const viewportCenter = viewport.clientWidth / 2;
  const offset = targetCenter - viewportCenter;
  requestAnimationFrame(() => {
    track.style.transition = "transform 3s cubic-bezier(0.1, 0.72, 0.16, 1)";
    track.style.transform = `translateX(${-offset}px)`;
  });
  setTimeout(() => {
    ui.screen = "eventOutcome";
    render();
  }, 3150);
}

function onResolveEvent(optionId) {
  // חייבים לשמור את מידע ה-gamble (אחוזים) של האופציה *לפני* הפתרון,
  // כי pendingEvent נמחק מה-state ברגע שהאירוע נפתר.
  const pendingOption = controller.state.pendingEvent?.options.find((o) => o.id === optionId);
  controller.resolveEvent(optionId);
  ui.lastEventOutcome = controller.state.lastEventOutcome || null;

  const gamble = pendingOption?.gamble;
  const randomOutcome = ui.lastEventOutcome?.randomOutcome;
  if (gamble && randomOutcome) {
    const spinIsEn = getNameLang() === "en";
    ui.spinData = {
      title: spinIsEn && ui.lastEventOutcome.titleEn ? ui.lastEventOutcome.titleEn : ui.lastEventOutcome.title,
      optionLabel:
        spinIsEn && ui.lastEventOutcome.optionLabelEn
          ? ui.lastEventOutcome.optionLabelEn
          : ui.lastEventOutcome.optionLabel,
      branches: gamble.branches,
      winningLabel: randomOutcome.label,
    };
    ui.screen = "eventSpin";
    render();
    startEventSpin();
  } else {
    ui.screen = "eventOutcome";
    render();
  }
}

function onContinueAfterEventOutcome() {
  ui.lastEventOutcome = null;
  ui.spinData = null;
  advanceScreenQueue();
}

async function onStartNewGame(leagueId, teamId = null, chosenPlayerIds = null, careerMode = false) {
  controller.startNewGame(leagueId, teamId, chosenPlayerIds, careerMode);
  ui.confirmOverwrite = false;
  ui.pickedLeagueId = null;
  ui.draftLeagueId = null;
  ui.draftTeamId = null;
  ui.draftCandidates = null;
  ui.draftPositions = null;
  ui.draftStepIndex = 0;
  ui.draftChoices = null;
  ui.screen = "home";
  render();
}

/**
 * מתחיל את זרימת "בחירת סגל" לאחר שהמשתמש בחר ליגה+קבוצה (או הגרלה
 * אקראית): מגריל זוגות מועמדים לכל עמדה פעם אחת, ואז מציג את העמדה
 * הראשונה. קורה רק פה - פעם אחת בפתיחת משחק חדש, לא בתחילת כל עונה.
 */
function onStartSquadDraft(leagueId, teamId) {
  ui.draftLeagueId = leagueId;
  ui.draftTeamId = teamId;
  ui.draftCandidates = controller.draftCandidatePairs();
  ui.draftPositions = SETTINGS.SQUAD_POSITIONS;
  ui.draftStepIndex = 0;
  ui.draftChoices = {};
  ui.screen = "squadDraft";
  render();
}

function onPickDraftPlayer(playerId) {
  const position = ui.draftPositions[ui.draftStepIndex];
  ui.draftChoices[position] = Number(playerId);
  if (ui.draftStepIndex < ui.draftPositions.length - 1) {
    ui.draftStepIndex += 1;
    render();
  } else {
    // מסלול "ממתחיל לאגדה" (מצב המשחק היחיד) תמיד מתחיל בפועל בליגה
    // הצרפתית (השלב הראשון), גם אם הקבוצה שנבחרה "מגוייסת" מליגה אחרת
    // (ui.draftLeagueId שימש רק כדי לדפדף/לבחור ממנה קבוצה).
    onStartNewGame(CAREER_STAGES[0], ui.draftTeamId, ui.draftChoices, true);
  }
}

function wireEvents() {
  appEl.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      case "goto-new-game":
        // משחק חדש = תמיד מסלול "ממתחיל לאגדה" (המשחק החופשי בוטל).
        ui.confirmOverwrite = controller.hasSavedGame();
        ui.screen = "leaguePick";
        render();
        break;
      case "back-to-leagues":
        // חזרה ממסך בחירת הקבוצה למסך הליגות בלי לגעת ב-confirmOverwrite
        // (בניגוד ל-"goto-new-game", שלא מתאים לניווט פנימי אחורה).
        ui.screen = "leaguePick";
        render();
        break;
      case "continue-game": {
        const loaded = controller.loadSavedGame();
        if (loaded) {
          // אם יש אירוע ממתין או חלון העברות פתוח, חוזרים ישר למסך
          // הרלוונטי - אחרת "המשך משחק שמור" היה תקוע על מסך הבית בלי
          // דרך להגיע לאירוע/לחלון שחוסם את ההתקדמות.
          ui.screen = loaded.gameOver
            ? "gameOver"
            : loaded.pendingEvent
              ? "event"
              : loaded.transferWindow
                ? "transferWindow"
                : "home";
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
        // הליגה הנבחרת משמשת רק לדפדוף ולבחור ממנה קבוצה - מסלול
        // "ממתחיל לאגדה" עצמו תמיד מתחיל בצרפת (השלב הראשון).
        ui.pickedLeagueId = el.dataset.league;
        ui.screen = "teamPick";
        render();
        break;
      case "pick-team":
        onStartSquadDraft(el.dataset.league, el.dataset.team);
        break;
      case "pick-team-random":
        onStartSquadDraft(el.dataset.league, null);
        break;
      case "pick-draft-player":
        onPickDraftPlayer(el.dataset.player);
        break;
      case "tab":
        ui.screen = el.dataset.tab;
        render();
        break;
      case "toggle-name-lang":
        // מחליף את שפת שמות השחקנים (עברית <-> English) ושומר את הבחירה;
        // render() מצייר מחדש את המסך הנוכחי כבר בשפה החדשה.
        setNameLang(getNameLang() === "en" ? "he" : "en");
        render();
        break;
      case "play-round":
        onPlayRoundClicked();
        break;
      case "start-scouted-match":
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
