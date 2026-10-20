// עטיפת מספרים אקראיים - מאפשרת הזרקת rng חלופי לבדיקות (seedable),
// ובברירת מחדל משתמשת ב-Math.random בייצור.

export function defaultRng() {
  return Math.random();
}

// Mulberry32 - גנרטור פסאודו-אקראי קטן, דטרמיניסטי לפי seed, לבדיקות בלבד.
export function createSeededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  // כולל min וכולל max
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickRandom(rng, array) {
  if (!array || array.length === 0) return undefined;
  return array[Math.floor(rng() * array.length)];
}

/** מערבב מערך (Fisher-Yates) ומחזיר עותק חדש - לא נוגע במקור. */
export function shuffle(rng, array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// בוחר N פריטים שונים (ללא חזרות) ממערך
export function pickRandomN(rng, array, n) {
  const pool = array.slice();
  const result = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}
