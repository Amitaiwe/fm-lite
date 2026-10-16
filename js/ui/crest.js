// סמלי קבוצות מקוריים (לא לוגואים אמיתיים/מסחריים): מגן SVG צבעוני
// עם ראשי התיבות של הקבוצה (מהחלק השני של מזהה הקבוצה, למשל
// "eng_ars" -> "ARS"), בצבע שנגזר באופן דטרמיניסטי ממזהה הקבוצה כך
// שלכל קבוצה יש סמל קבוע וייחודי משלה לאורך כל המשחק.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// עבור מזהה אחד (eng_new - ניוקאסל) ראשי התיבות האוטומטיים יוצאים
// "NEW", שנראה בטעות כמו תגית "חדש" באנגלית ולא כסמל קבוצה - לכן יש
// לו חריגה ידנית לראשי התיבות המקובלים (NUFC). שאר 54 הקבוצות משתמשות
// בחילוץ האוטומטי מתוך מזהה הקבוצה.
const INITIALS_OVERRIDES = {
  eng_new: "NUFC",
};

function teamInitials(teamId) {
  if (INITIALS_OVERRIDES[teamId]) return INITIALS_OVERRIDES[teamId];
  const parts = teamId.split("_");
  const code = parts.length > 1 ? parts[1] : teamId;
  return code.slice(0, 3).toUpperCase();
}

/** מחזיר מחרוזת SVG (מגן + ראשי תיבות) לקבוצה נתונה, בגודל נתון בפיקסלים. */
export function teamCrestSvg(teamId, size = 26) {
  const hash = hashString(teamId);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 35) % 360;
  const initials = teamInitials(teamId);
  const fontSize = initials.length > 3 ? 11 : 15;
  const gradId = `crestGrad_${teamId}`;
  return `
    <svg class="crest" width="${size}" height="${size}" viewBox="0 0 48 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hue1},72%,46%)" />
          <stop offset="100%" stop-color="hsl(${hue2},60%,24%)" />
        </linearGradient>
      </defs>
      <path d="M24 2 L44 8 L44 27 C44 41 36 49 24 54 C12 49 4 41 4 27 L4 8 Z"
            fill="url(#${gradId})" stroke="rgba(255,255,255,0.55)" stroke-width="2" />
      <text x="24" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800"
            font-size="${fontSize}" fill="#fff">${initials}</text>
    </svg>`;
}
