import { POSITION_LABELS_HE } from "../data/settings.js";

export function formatMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  return `${sign}€${abs.toLocaleString("he-IL")}`;
}

/** פורמט כסף מקוצר לכרטיסים צפופים (למשל €45M, €850K). */
export function formatMoneyShort(amount) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs)}`;
}

export function positionLabel(position) {
  return POSITION_LABELS_HE[position] || position;
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// --- שפת שמות השחקנים (עברית / English) ---
// ההעדפה נשמרת ב-localStorage בנפרד משמירת המשחק, כדי שהיא תשרוד גם
// מחיקת משחק שמור ותחול על כל משחק חדש. ברירת מחדל: עברית.

const NAME_LANG_KEY = "fm_lite_name_lang_v1";

export function getNameLang() {
  try {
    return window.localStorage.getItem(NAME_LANG_KEY) === "en" ? "en" : "he";
  } catch {
    return "he";
  }
}

export function setNameLang(lang) {
  try {
    window.localStorage.setItem(NAME_LANG_KEY, lang === "en" ? "en" : "he");
  } catch {
    /* localStorage לא זמין - נשארים עם ברירת המחדל */
  }
}

/** שם השחקן לתצוגה, לפי שפת השמות הנוכחית (נופל חזרה לעברית אם חסר name_en). */
export function playerDisplayName(player) {
  if (!player) return "";
  return getNameLang() === "en" && player.name_en ? player.name_en : player.name_he;
}
