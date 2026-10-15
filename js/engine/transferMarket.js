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
 * netPrice יכול להיות שלילי - זה המקרה של שינמוך עמדה (קניית שחקן
 * זול יותר מהנוכחי): ההפרש חוזר לתקציב כרווח, לפי בקשת המשתמש.
 */
export function calcNetPrice(squad, allPlayers, newPlayer) {
  const currentSlot = getSlotByPosition(squad, newPlayer.position);
  const currentPlayer = currentSlot ? findById(allPlayers, currentSlot.playerId) : null;
  const currentPlayerValue = currentPlayer ? currentPlayer.market_value : 0;
  const netPrice = newPlayer.market_value - currentPlayerValue;
  return { netPrice, currentPlayerValue };
}

/**
 * מבצע רכישה: בודק תקציב (רק כשצריך לשלם), מחליף את השחקן בעמדה,
 * ומעדכן את התקציב לפי המחיר נטו - אם הוא שלילי (שינמוך עמדה),
 * התקציב עולה בהפרש במקום לרדת.
 *
 * מוגבל לרכישה אחת לכל עמדה בכל חלון העברות (state.transferWindow.
 * purchasedPositions) - בלי ההגבלה הזו, מאז שהוספנו רווח על שינמוך
 * עמדה, אפשר היה "למכור" את אותה עמדה שוב ושוב בתוך חלון אחד (למשל
 * 5 חלוצים ברצף) ולהרוויח קיזוז על כל החלפה בנפרד - מנגנון לא ריאליסטי
 * שהופך את הכלכלה לחסרת משמעות.
 *
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
  const purchasedPositions = state.transferWindow ? state.transferWindow.purchasedPositions || [] : [];
  if (purchasedPositions.includes(newPlayer.position)) {
    return { ok: false, reason: "כבר בוצעה רכישה לעמדה הזו בחלון הנוכחי" };
  }
  const { netPrice } = calcNetPrice(state.squad, allPlayers, newPlayer);
  if (netPrice > 0 && !canAfford(state, netPrice)) {
    return { ok: false, reason: "אין מספיק כסף לרכישה זו" };
  }

  const newSquad = setPlayerInPosition(state.squad, newPlayer, rng);
  let newState = {
    ...state,
    squad: newSquad,
    transferWindow: state.transferWindow
      ? { ...state.transferWindow, purchasedPositions: [...purchasedPositions, newPlayer.position] }
      : state.transferWindow,
  };
  if (netPrice !== 0) {
    // netPrice חיובי = הוצאה (תשלום), netPrice שלילי = הכנסה (רווח משינמוך)
    newState = ledgerBudgetChange(newState, -netPrice, "transfersNet", netPrice > 0);
  }
  return { ok: true, state: newState, netPrice };
}
