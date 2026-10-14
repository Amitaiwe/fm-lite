// שוק ההעברות: הגרלת 7 שחקנים לחלון, וחישוב/ביצוע רכישה עם קיזוז
// שווי השחקן הקיים באותה עמדה.

import { SETTINGS } from "../data/settings.js";
import { pickRandomN } from "./rng.js";
import { findById } from "./playersRepo.js";
import { getSlotByPosition, setPlayerInPosition } from "./squad.js";
import { ledgerBudgetChange, canAfford } from "./economy.js";

/** מגריל 7 שחקנים אקראיים מהמאגר (ללא תלות בסגל הנוכחי). */
export function generateTransferWindowPlayers(allPlayers, rng) {
  return pickRandomN(rng, allPlayers, SETTINGS.TRANSFER_WINDOW_PLAYER_COUNT).map((p) => p.id);
}

/**
 * מחשב את מחיר הרכישה נטו לשחקן חדש, לפי העמדה שלו והשחקן הנוכחי
 * באותה עמדה בסגל. הקיזוז תמיד מבוסס על market_value כפי שמוגדר
 * במאגר players.json (ערך קבוע שאינו משתנה גם אם היכולת השתנתה).
 */
export function calcNetPrice(squad, allPlayers, newPlayer) {
  const currentSlot = getSlotByPosition(squad, newPlayer.position);
  const currentPlayer = currentSlot ? findById(allPlayers, currentSlot.playerId) : null;
  const currentPlayerValue = currentPlayer ? currentPlayer.market_value : 0;
  const netPrice = Math.max(0, newPlayer.market_value - currentPlayerValue);
  return { netPrice, currentPlayerValue };
}

/**
 * מבצע רכישה: בודק תקציב, מחליף את השחקן בעמדה, מנכה את המחיר נטו
 * ורושם זאת כהוצאה (ללא רישום הכנסה נפרדת על "מכירת" השחקן הקיים,
 * כדי למנוע ספירה כפולה - הקיזוז כבר כלול במחיר נטו).
 * מחזיר { ok: true, state } או { ok: false, reason }.
 */
export function executeTransfer(state, allPlayers, newPlayerId, rng) {
  const newPlayer = findById(allPlayers, newPlayerId);
  if (!newPlayer) {
    return { ok: false, reason: "שחקן לא נמצא במאגר" };
  }
  const currentSlot = getSlotByPosition(state.squad, newPlayer.position);
  if (currentSlot && currentSlot.playerId === newPlayer.id) {
    return { ok: false, reason: "השחקן הזה כבר נמצא בסגל שלך" };
  }
  const { netPrice } = calcNetPrice(state.squad, allPlayers, newPlayer);
  if (!canAfford(state, netPrice)) {
    return { ok: false, reason: "אין מספיק כסף לרכישה זו" };
  }

  const newSquad = setPlayerInPosition(state.squad, newPlayer, rng);
  let newState = { ...state, squad: newSquad };
  if (netPrice > 0) {
    newState = ledgerBudgetChange(newState, -netPrice, "transfersNet", true);
  }
  return { ok: true, state: newState, netPrice };
}
