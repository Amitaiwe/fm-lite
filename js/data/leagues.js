// נתוני הליגות והקבוצות - 5 ליגות, 11 קבוצות אמיתיות בכל ליגה.
// baseStrength: דירוג כוח בסיסי לקבוצה (65-95), משמש לסימולציית משחקים
// של קבוצות שאינן בניהול השחקן (ולחישוב קושי בבחירת הקבוצה המוגרלת).

export const LEAGUES = {
  england: {
    id: "england",
    name_he: "אנגליה - פרמייר ליג",
    name_en: "England - Premier League",
    teams: [
      { id: "eng_ars", name_he: "ארסנל", name_en: "Arsenal", baseStrength: 90 },
      { id: "eng_mci", name_he: "מנצ'סטר סיטי", name_en: "Manchester City", baseStrength: 93 },
      { id: "eng_liv", name_he: "ליברפול", name_en: "Liverpool", baseStrength: 91 },
      { id: "eng_che", name_he: "צ'לסי", name_en: "Chelsea", baseStrength: 85 },
      { id: "eng_tot", name_he: "טוטנהאם", name_en: "Tottenham", baseStrength: 84 },
      { id: "eng_mun", name_he: "מנצ'סטר יונייטד", name_en: "Manchester United", baseStrength: 82 },
      { id: "eng_new", name_he: "ניוקאסל", name_en: "Newcastle United", baseStrength: 83 },
      { id: "eng_avl", name_he: "אסטון וילה", name_en: "Aston Villa", baseStrength: 80 },
      { id: "eng_whu", name_he: "ווסט האם", name_en: "West Ham United", baseStrength: 76 },
      { id: "eng_bha", name_he: "ברייטון", name_en: "Brighton", baseStrength: 78 },
      { id: "eng_eve", name_he: "אברטון", name_en: "Everton", baseStrength: 73 },
    ],
  },
  spain: {
    id: "spain",
    name_he: "ספרד - לה ליגה",
    name_en: "Spain - La Liga",
    teams: [
      { id: "esp_rma", name_he: "ריאל מדריד", name_en: "Real Madrid", baseStrength: 94 },
      { id: "esp_bar", name_he: "ברצלונה", name_en: "Barcelona", baseStrength: 92 },
      { id: "esp_atm", name_he: "אתלטיקו מדריד", name_en: "Atlético Madrid", baseStrength: 87 },
      { id: "esp_sev", name_he: "סביליה", name_en: "Sevilla", baseStrength: 78 },
      { id: "esp_rso", name_he: "ריאל סוסיאדד", name_en: "Real Sociedad", baseStrength: 80 },
      { id: "esp_bet", name_he: "ריאל בטיס", name_en: "Real Betis", baseStrength: 79 },
      { id: "esp_vil", name_he: "ויאריאל", name_en: "Villarreal", baseStrength: 81 },
      { id: "esp_ath", name_he: "אתלטיק בילבאו", name_en: "Athletic Bilbao", baseStrength: 82 },
      { id: "esp_val", name_he: "ולנסיה", name_en: "Valencia", baseStrength: 75 },
      { id: "esp_cel", name_he: "סלטה ויגו", name_en: "Celta Vigo", baseStrength: 73 },
      { id: "esp_osa", name_he: "אוססונה", name_en: "Osasuna", baseStrength: 72 },
    ],
  },
  germany: {
    id: "germany",
    name_he: "גרמניה - בונדסליגה",
    name_en: "Germany - Bundesliga",
    teams: [
      { id: "ger_bay", name_he: "באיירן מינכן", name_en: "Bayern Munich", baseStrength: 94 },
      { id: "ger_bvb", name_he: "בורוסיה דורטמונד", name_en: "Borussia Dortmund", baseStrength: 86 },
      { id: "ger_rbl", name_he: "RB לייפציג", name_en: "RB Leipzig", baseStrength: 85 },
      { id: "ger_b04", name_he: "באייר לברקוזן", name_en: "Bayer Leverkusen", baseStrength: 87 },
      { id: "ger_sge", name_he: "איינטרכט פרנקפורט", name_en: "Eintracht Frankfurt", baseStrength: 78 },
      { id: "ger_wob", name_he: "וולפסבורג", name_en: "Wolfsburg", baseStrength: 75 },
      { id: "ger_bmg", name_he: "בורוסיה מנשנגלדבאך", name_en: "Borussia Mönchengladbach", baseStrength: 74 },
      { id: "ger_scf", name_he: "פרייבורג", name_en: "Freiburg", baseStrength: 76 },
      { id: "ger_fcu", name_he: "יוניון ברלין", name_en: "Union Berlin", baseStrength: 74 },
      { id: "ger_m05", name_he: "מיינץ", name_en: "Mainz 05", baseStrength: 71 },
      { id: "ger_vfb", name_he: "שטוטגרט", name_en: "Stuttgart", baseStrength: 79 },
    ],
  },
  italy: {
    id: "italy",
    name_he: "איטליה - סרייה A",
    name_en: "Italy - Serie A",
    teams: [
      { id: "ita_juv", name_he: "יובנטוס", name_en: "Juventus", baseStrength: 86 },
      { id: "ita_int", name_he: "אינטר מילאן", name_en: "Inter Milan", baseStrength: 92 },
      { id: "ita_mil", name_he: "מילאן", name_en: "AC Milan", baseStrength: 85 },
      { id: "ita_nap", name_he: "נאפולי", name_en: "Napoli", baseStrength: 87 },
      { id: "ita_rom", name_he: "רומא", name_en: "Roma", baseStrength: 81 },
      { id: "ita_laz", name_he: "לאציו", name_en: "Lazio", baseStrength: 80 },
      { id: "ita_ata", name_he: "אטאלנטה", name_en: "Atalanta", baseStrength: 84 },
      { id: "ita_fio", name_he: "פיורנטינה", name_en: "Fiorentina", baseStrength: 77 },
      { id: "ita_tor", name_he: "טורינו", name_en: "Torino", baseStrength: 73 },
      { id: "ita_bol", name_he: "בולוניה", name_en: "Bologna", baseStrength: 78 },
      { id: "ita_udi", name_he: "אודינזה", name_en: "Udinese", baseStrength: 70 },
    ],
  },
  france: {
    id: "france",
    name_he: "צרפת - ליג 1",
    name_en: "France - Ligue 1",
    teams: [
      { id: "fra_psg", name_he: "פריז סן ז'רמן", name_en: "Paris Saint-Germain", baseStrength: 93 },
      { id: "fra_om", name_he: "מארסיי", name_en: "Marseille", baseStrength: 80 },
      { id: "fra_ol", name_he: "ליון", name_en: "Lyon", baseStrength: 78 },
      { id: "fra_asm", name_he: "מונאקו", name_en: "Monaco", baseStrength: 82 },
      { id: "fra_lil", name_he: "ליל", name_en: "Lille", baseStrength: 79 },
      { id: "fra_ren", name_he: "רן", name_en: "Rennes", baseStrength: 75 },
      { id: "fra_ogn", name_he: "ניס", name_en: "Nice", baseStrength: 76 },
      { id: "fra_rcl", name_he: "לאנס", name_en: "Lens", baseStrength: 77 },
      { id: "fra_rcs", name_he: "סטרסבור", name_en: "Strasbourg", baseStrength: 71 },
      { id: "fra_fcn", name_he: "נאנט", name_en: "Nantes", baseStrength: 70 },
      { id: "fra_tfc", name_he: "טולוז", name_en: "Toulouse", baseStrength: 69 },
    ],
  },
};

export function getLeagueList() {
  return Object.values(LEAGUES).map((l) => ({ id: l.id, name_he: l.name_he, name_en: l.name_en }));
}

export function getLeague(leagueId) {
  return LEAGUES[leagueId];
}

export function getTeam(leagueId, teamId) {
  const league = LEAGUES[leagueId];
  if (!league) return null;
  return league.teams.find((t) => t.id === teamId) || null;
}
