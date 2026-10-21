// סמלי קבוצות: תמונת הסמל האמיתי מ-img/crests/ בשם הקובץ המקורי ממאגר
// football-logos (למשל "West Ham United.png"), ואם הקובץ חסר או נכשל בטעינה -
// מגן SVG גנרי כגיבוי.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// עבור מזהה אחד (eng_new - ניוקאסל) ראשי התיבות האוטומטיים יוצאים
// "NEW", שנראה בטעות כמו תגית "חדש" באנגלית ולא כסמל קבוצה - לכן יש
// לו חריגה ידנית לראשי התיבות המקובלים (NUFC). שאר הקבוצות משתמשות
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
function generatedCrestSvg(teamId, size = 26, extra = "") {
  const hash = hashString(teamId);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 35) % 360;
  const initials = teamInitials(teamId);
  const fontSize = initials.length > 3 ? 11 : 15;
  const gradId = `crestGrad_${teamId}`;
  return `
    <svg class="crest" ${extra} width="${size}" height="${size}" viewBox="0 0 48 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

// מיפוי ממזהה קבוצה לשמות הקבצים המקוריים במאגר football-logos
// (github.com/luukhopman/football-logos), לפי שמות הקבצים בענפי logos/ ו-history/.
// המשתמש מוריד את הקבצים ומעלה אותם כשמם (בלי שינוי שם) לתיקייה img/crests/.
// הערך הראשון הוא השם הנפוץ/העדכני ביותר (logos/ או רוב עונות history/); שמות
// נוספים הם חלופות מעונות קודמות של history/ (למשל "West Ham.png" מ-2021-22).
// כך ההעלאה עובדת בין אם הקובץ הורד מ-logos/ ובין אם מ-history/.
const CREST_FILES = {
  eng_ars: ["Arsenal FC.png", "Arsenal.png"],
  eng_avl: ["Aston Villa.png"],
  eng_bha: ["Brighton & Hove Albion.png", "Brighton.png"],
  eng_che: ["Chelsea FC.png", "Chelsea.png"],
  eng_cry: ["Crystal Palace.png"],
  eng_eve: ["Everton FC.png"],
  eng_ful: ["Fulham FC.png"],
  eng_liv: ["Liverpool FC.png"],
  eng_mci: ["Manchester City.png"],
  eng_mun: ["Manchester United.png"],
  eng_new: ["Newcastle United.png"],
  eng_tot: ["Tottenham Hotspur.png"],
  eng_whu: ["West Ham United.png", "West Ham.png"],
  eng_wol: ["Wolverhampton Wanderers.png"],
  esp_ath: ["Athletic Bilbao.png"],
  esp_atm: ["Atlético de Madrid.png"],
  esp_bar: ["FC Barcelona.png", "Barcelona.png"],
  esp_bet: ["Real Betis Balompié.png"],
  esp_cel: ["Celta de Vigo.png"],
  esp_gir: ["Girona FC.png"],
  esp_mal: ["RCD Mallorca.png"],
  esp_osa: ["CA Osasuna.png"],
  esp_ray: ["Rayo Vallecano.png"],
  esp_rma: ["Real Madrid.png"],
  esp_rso: ["Real Sociedad.png"],
  esp_sev: ["Sevilla FC.png"],
  esp_val: ["Valencia CF.png", "Valencia.png"],
  esp_vil: ["Villarreal CF.png"],
  fra_asm: ["AS Monaco.png"],
  fra_bre: ["Stade Brestois 29.png"],
  fra_fcn: ["FC Nantes.png"],
  fra_lil: ["LOSC Lille.png"],
  fra_mtp: ["Montpellier HSC.png", "Montpellier.png"],
  fra_ogn: ["OGC Nice.png"],
  fra_ol: ["Olympique Lyon.png"],
  fra_om: ["Olympique Marseille.png", "Marseille.png"],
  fra_psg: ["Paris Saint-Germain.png"],
  fra_rcl: ["RC Lens.png"],
  fra_rcs: ["RC Strasbourg Alsace.png"],
  fra_rei: ["Stade Reims.png"],
  fra_ren: ["Stade Rennais FC.png", "Stade Rennais.png"],
  fra_tfc: ["FC Toulouse.png"],
  ger_b04: ["Bayer 04 Leverkusen.png"],
  ger_bay: ["Bayern Munich.png"],
  ger_bmg: ["Borussia Mönchengladbach.png"],
  ger_bvb: ["Borussia Dortmund.png"],
  ger_fca: ["FC Augsburg.png"],
  ger_fcu: ["1.FC Union Berlin.png"],
  ger_m05: ["1.FSV Mainz 05.png"],
  ger_rbl: ["RB Leipzig.png"],
  ger_scf: ["SC Freiburg.png"],
  ger_sge: ["Eintracht Frankfurt.png"],
  ger_svw: ["SV Werder Bremen.png"],
  ger_tsg: ["TSG 1899 Hoffenheim.png"],
  ger_vfb: ["VfB Stuttgart.png"],
  ger_wob: ["VfL Wolfsburg.png"],
  ita_ata: ["Atalanta BC.png"],
  ita_bol: ["Bologna FC 1909.png"],
  ita_fio: ["ACF Fiorentina.png"],
  ita_gen: ["Genoa CFC.png"],
  ita_hve: ["Hellas Verona.png"],
  ita_int: ["Inter Milan.png"],
  ita_juv: ["Juventus FC.png", "Juventus.png"],
  ita_laz: ["SS Lazio.png", "Lazio.png"],
  ita_mil: ["AC Milan.png"],
  ita_nap: ["SSC Napoli.png"],
  ita_rom: ["AS Roma.png"],
  ita_sas: ["US Sassuolo.png", "Sassuolo.png"],
  ita_tor: ["Torino FC.png"],
  ita_udi: ["Udinese Calcio.png"],
};

/**
 * סמל קבוצה: תמונת הסמל האמיתי מ-img/crests/<שם הקובץ המקורי>. שם הקובץ
 * מקודד ב-encodeURIComponent כדי לטפל ברווחים ובאותיות מאויטרות (למשל
 * "Borussia Mönchengladbach.png"). אם הקובץ חסר, מנסים את שמות החלופה לפי
 * הסדר, ואם כולם נכשלים מוצג המגן הגנרי (SVG) כגיבוי.
 */
export function teamCrestSvg(teamId, size = 26) {
  const files = CREST_FILES[teamId];
  if (!files || files.length === 0) {
    return `<span class="crest-wrap" style="display:inline-flex;flex-shrink:0">${generatedCrestSvg(teamId, size)}</span>`;
  }
  const fallback = generatedCrestSvg(teamId, size, 'style="display:none"');
  const [first, ...rest] = files;
  const src = `img/crests/${encodeURIComponent(first)}`;
  const restJson = JSON.stringify(rest);
  return `<span class="crest-wrap" style="display:inline-flex;flex-shrink:0"><img class="crest crest-img" src="${src}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" style="object-fit:contain" data-candidates='${restJson}' onerror="const c=JSON.parse(this.dataset.candidates||'[]');const f=c.shift();if(f){this.dataset.candidates=JSON.stringify(c);this.src='img/crests/'+encodeURIComponent(f)}else{this.nextElementSibling.style.display='block';this.remove()}" />${fallback}</span>`;
}
