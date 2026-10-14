// שמירה וטעינה מ-localStorage. כל פעולה שמשנה את מצב המשחק אמורה
// להסתיים בקריאה ל-saveGame.

const STORAGE_KEY = "fm_lite_save_v1";

export function hasBrowserStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function saveGame(state) {
  if (!hasBrowserStorage()) return { ok: false, reason: "localStorage לא זמין" };
  try {
    const json = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, json);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "שגיאה בשמירת המשחק: " + err.message };
  }
}

export function loadGame() {
  if (!hasBrowserStorage()) return null;
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function hasSavedGame() {
  if (!hasBrowserStorage()) return false;
  try {
    return !!window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function clearSavedGame() {
  if (!hasBrowserStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
