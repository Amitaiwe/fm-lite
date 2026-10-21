import { getLeague, getTeam, getLeagueList } from "../data/leagues.js";
import { findById } from "../engine/playersRepo.js";
import { calcNetPrice } from "../engine/transferMarket.js";
import { getSlotByPosition } from "../engine/squad.js";
import { totalSquadSalary } from "../engine/economy.js";
import { findTeamMatch } from "../engine/fixtures.js";
import { sortedTable } from "../engine/table.js";
import { computeManagedTeamStrength, estimateMatchProbabilities } from "../engine/simulate.js";
import { SETTINGS, POSITION_LABELS_HE } from "../data/settings.js";
import { formatMoney, formatMoneyShort, positionLabel, escapeHtml, getNameLang, playerDisplayName } from "./format.js";
import { teamCrestSvg } from "./crest.js";
import { CAREER_STAGES } from "../engine/career.js";

function teamName(leagueId, teamId) {
  const t = getTeam(leagueId, teamId);
  return t ? t.name_he : teamId;
}

/** ממיר קוד מדינה (ISO 3166-1 alpha-2, לדוגמה "fr") לאימוג'י דגל, ע"י הזזת כל אות לתו "אינדיקטור אזורי" (Regional Indicator Symbol). */
function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = [...countryCode.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/** שם שחקן + דגל המדינה שלו (אם יש), לתצוגה אחידה בכל מקום שמציג שם שחקן. */
function playerNameWithFlag(player) {
  if (!player) return "";
  const flag = flagEmoji(player.nationality);
  return `${flag ? `<span class="player-flag">${flag}</span> ` : ""}${escapeHtml(playerDisplayName(player))}`;
}

/**
 * כפתורי הניווט העליונים. כאשר חלון העברות פתוח (state.transferWindow),
 * מוסיפים לו טאב "🔄 שוק" כדי שאפשר יהיה לקפוץ אליו ובחזרה מכל מסך
 * (סגל/טבלה/כספים) כמה פעמים שרוצים, בלי לסגור את החלון - הסגירה
 * בפועל קורית רק בלחיצה על הכפתור הייעודי במסך השוק עצמו.
 */
function navTabsHtml(active, { hasTransferWindow = false } = {}) {
  const tabs = [
    { id: "home", label: "סגל" },
    { id: "table", label: "טבלה" },
    { id: "finances", label: "כספים" },
    { id: "stats", label: "⚽ שערים" },
  ];
  if (hasTransferWindow) tabs.push({ id: "transferWindow", label: "🔄 שוק" });
  return `
    <div class="nav-tabs">
      ${tabs
        .map(
          (t) =>
            `<button class="${t.id === active ? "active" : ""}" data-action="tab" data-tab="${t.id}">${t.label}</button>`
        )
        .join("")}
    </div>
  `;
}

/** תג קטן +/-N לשינוי אחרון (כושר אחרי משחק, יכולת אחרי אירוע) - נשאר מוצג עד השינוי הבא. */
function deltaBadgeHtml(diff) {
  if (!diff) return "";
  const cls = diff > 0 ? "delta-up" : "delta-down";
  const sign = diff > 0 ? "+" : "";
  return `<span class="delta-badge ${cls}">${sign}${diff}</span>`;
}

export function renderStartScreen({ hasSave }) {
  return `
    <div class="screen">
      <div class="brand">
        <div class="logo">Football <span>Manager</span> Lite</div>
        <div class="tagline">משחק ניהול כדורגל - בחר, נהל, נצח</div>
      </div>
      <div class="card center-col">
        <button class="btn" data-action="goto-new-game">🏆 ממתחיל לאגדה</button>
        <button class="btn btn-secondary" data-action="continue-game" ${hasSave ? "" : "disabled"}>
          המשך משחק שמור
        </button>
        ${
          !hasSave
            ? `<div class="muted" style="text-align:right; line-height:1.6; margin-top:10px">
                 <b>איך משחקים?</b><br>
                 בוחרים קבוצה ומתחילים מהליגה הצרפתית. משחקים מחזור אחר מחזור,
                 קונים ומוכרים שחקנים ומנהלים את התקציב. זוכים באליפות כדי לעלות
                 ליגה: גרמניה, איטליה, אנגליה, ספרד, הליגה האירופית וליגת האלופות.
                 מנצחים את כל 7 השלבים - והופכים לאגדה 👑
               </div>`
            : ""
        }
      </div>
    </div>
  `;
}

export function renderLeaguePick({ confirmOverwrite }) {
  // מסך זה משמש רק לבחירת *מאיזו ליגה* לדפדף כדי לבחור קבוצה (ראו
  // renderTeamPick) - מסלול "ממתחיל לאגדה" (מצב המשחק היחיד) תמיד מתחיל
  // בפועל בליגה הצרפתית (השלב הראשון ב-CAREER_STAGES), לא בליגה שנבחרה
  // כאן. לכן מציגים רק את 5 הליגות הבסיסיות (לא "אירופה"/"אלופות" - אלו
  // שלבים שעולים אליהם במהלך המסלול, לא נקודות דפדוף לקבוצה) - ראו career.js.
  const leagues = getLeagueList().filter((l) => CAREER_STAGES.slice(0, 5).includes(l.id));
  return `
    <div class="screen">
      <div class="brand">
        <div class="logo">בחירת <span>ליגה</span></div>
        <div class="tagline">
          מסלול "ממתחיל לאגדה" תמיד מתחיל בליגה הצרפתית - אבל אפשר לבחור את הקבוצה שתנהל מכל אחת מ-5 הליגות. באיזו ליגה לבחור ממנה קבוצה?
        </div>
      </div>
      ${
        confirmOverwrite
          ? `<div class="card" style="border-color:var(--red)">
               <p>קיים משחק שמור. התחלת משחק חדש תמחק אותו. להמשיך?</p>
               <div class="btn-row">
                 <button class="btn btn-danger" data-action="confirm-new-game">כן, התחל משחק חדש</button>
                 <button class="btn btn-secondary" data-action="cancel-new-game">ביטול</button>
               </div>
             </div>`
          : `<div class="league-pick-grid">
              ${leagues
                .map(
                  (l) => `<div class="league-pick" data-action="pick-league" data-league="${l.id}">${l.name_he}</div>`
                )
                .join("")}
            </div>
            <button class="btn btn-secondary" data-action="back-to-start">חזרה</button>`
      }
    </div>
  `;
}

export function renderTeamPick({ leagueId }) {
  const league = getLeague(leagueId);
  // ממוינות לפי כוח בסיס יורד, כדי שתהיה תחושה ברורה של "מי הכי חזקה"
  const teams = [...league.teams].sort((a, b) => b.baseStrength - a.baseStrength);
  return `
    <div class="screen">
      <div class="brand">
        <div class="logo">בחירת <span>קבוצה</span></div>
        <div class="tagline">
          ${league.name_he} - באיזו קבוצה תרצה לנהל?
          <br><b>מסלול "ממתחיל לאגדה"</b>: הקבוצה שתבחר תטייל איתך בין 7 הליגות ככל שתעלה.
        </div>
      </div>
      <div class="team-pick-grid">
        ${teams
          .map(
            (t) => `
          <div class="team-pick" data-action="pick-team" data-league="${leagueId}" data-team="${t.id}">
            ${teamCrestSvg(t.id, 40)}
            <span class="team-pick-name">${t.name_he}</span>
            <span class="team-pick-strength">כוח ${t.baseStrength}</span>
          </div>`
          )
          .join("")}
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" data-action="pick-team-random" data-league="${leagueId}">הגרל לי קבוצה</button>
        <button class="btn btn-secondary" data-action="back-to-leagues">חזרה לליגות</button>
      </div>
    </div>
  `;
}

const POSITION_TITLES_HE = {
  goalkeeper: "בחר שוער",
  defender: "בחר מגן",
  midfielder: "בחר קשר",
  striker: "בחר חלוץ",
};

/**
 * מסך "בחירת סגל" בתחילת משחק חדש: מציג עמדה אחת בכל פעם, עם שני
 * שחקנים מועמדים ברמה דומה (הפרש יכולת עד נקודה אחת) לבחירה - כרטיסיות
 * גדולות (fut-card-lg). stepIndex/totalSteps משמשים למד-התקדמות.
 */
export function renderSquadDraft({ position, candidates, stepIndex, totalSteps }) {
  return `
    <div class="screen">
      <div class="brand">
        <div class="logo">${POSITION_TITLES_HE[position] || "בחר שחקן"}</div>
        <div class="tagline">שלב ${stepIndex + 1} מתוך ${totalSteps} - בחר את השחקן שינהל את העמדה הזו בסגל שלך</div>
      </div>
      <div class="squad-draft-grid">
        ${candidates
          .map(
            (p) => `
          <div class="squad-draft-option" data-action="pick-draft-player" data-player="${p.id}">
            ${futCardHtml({
              rating: p.ability,
              position: p.position,
              name: playerDisplayName(p),
              nationality: p.nationality,
              size: "lg",
              statLines: [
                { icon: "💰", value: formatMoneyShort(p.market_value) },
              ],
            })}
          </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * כרטיס שחקן בסגנון "אולטימייט טים" (FUT): מגן זהב/כחול עם דירוג
 * גדול, עמדה, שם, ושורת סטטים עם אייקונים. משמש גם לסגל (עם כושר)
 * וגם להצעות שוק ההעברות (בלי כושר - עוד לא בסגל).
 */
function futCardHtml({ rating, ratingDelta, position, name, nationality, statLines, size = "md" }) {
  const flag = flagEmoji(nationality);
  return `
    <div class="fut-card fut-card-${size}">
      <div class="fut-rating">${rating}${ratingDelta ? deltaBadgeHtml(ratingDelta) : ""}</div>
      <div class="fut-pos">${positionLabel(position)}</div>
      <div class="fut-name">${flag ? `<span class="player-flag">${flag}</span> ` : ""}${escapeHtml(name)}</div>
      <div class="fut-stats">
        ${statLines.map((s) => `<span class="fut-stat"><span class="fut-stat-icon">${s.icon}</span>${s.value}</span>`).join("")}
      </div>
    </div>`;
}

/**
 * כרטיס שחקן בסגל (תצוגת "מגרש" בבית): מציג גם את שינוי הכושר האחרון
 * (אחרי כל משחק, ±MATCH_FITNESS_SWING אקראי) וגם שינוי יכולת אחרון
 * (רק דרך אירוע) - נשארים מוצגים עד השינוי הבא, כדי שתמיד יהיה ברור
 * מה קרה לאחרונה לכל שחקן.
 */
function pitchPlayerCardHtml(slot, allPlayers) {
  const player = findById(allPlayers, slot.playerId);
  return futCardHtml({
    rating: slot.currentAbility,
    ratingDelta: slot.lastAbilityDelta,
    position: slot.position,
    name: playerDisplayName(player),
    nationality: player.nationality,
    size: "sm",
    statLines: [
      { icon: "💪", value: `${slot.fitness}${deltaBadgeHtml(slot.lastFitnessDelta)}` },
      { icon: "💰", value: formatMoneyShort(player.market_value) },
    ],
  });
}

/**
 * מציג את הסגל כ"מגרש" 2x2 קומפקטי: שוער+מגן למעלה (ליד השער שלנו),
 * קשר+חלוץ למטה (ליד שער היריבה) - תואם כדורגל אמיתי, וקטן משמעותית
 * מה-grid המלא שהיה קודם.
 */
function squadPitchHtml(state, allPlayers) {
  const bySlot = (pos) => state.squad.find((s) => s.position === pos);
  const gk = bySlot("goalkeeper");
  const df = bySlot("defender");
  const mf = bySlot("midfielder");
  const st = bySlot("striker");
  return `
    <div class="pitch">
      <div class="pitch-line"></div>
      <div class="pitch-circle"></div>
      <div class="pitch-goal-label top">השער שלנו</div>
      <div class="pitch-row">
        ${gk ? pitchPlayerCardHtml(gk, allPlayers) : ""}
        ${df ? pitchPlayerCardHtml(df, allPlayers) : ""}
      </div>
      <div class="pitch-row">
        ${mf ? pitchPlayerCardHtml(mf, allPlayers) : ""}
        ${st ? pitchPlayerCardHtml(st, allPlayers) : ""}
      </div>
      <div class="pitch-goal-label bottom">שער היריבה</div>
    </div>
  `;
}

function nextOpponentHtml(state) {
  const roundsTotal = state.fixtures.length;
  if (state.round >= roundsTotal) return "";
  const round = state.fixtures[state.round];
  const match = findTeamMatch(round, state.teamId);
  if (!match) {
    return `<div class="card-flat next-opponent"><span class="muted">המחזור הבא: קבוצתכם נחה</span></div>`;
  }
  const standings = sortedTable(state.table);
  const idx = standings.findIndex((r) => r.teamId === match.opponent);
  const position = idx === -1 ? null : idx + 1;
  return `
    <div class="card-flat next-opponent">
      <span class="muted">היריב הבא (${match.isHome ? "בית" : "חוץ"}):</span>
      ${teamCrestSvg(match.opponent, 22)}
      <span class="next-opponent-name">${teamName(state.leagueId, match.opponent)}</span>
      ${position ? `<span class="badge">מקום ${position}</span>` : ""}
    </div>
  `;
}

function difficultyLabel(diff) {
  if (diff >= 8) return { text: "היריבה חלשה משמעותית מכם 💪", tone: "positive" };
  if (diff >= 3) return { text: "היריבה חלשה מכם", tone: "positive" };
  if (diff > -3) return { text: "קבוצות דומות בעוצמתן - עשוי להיות משחק צמוד", tone: "neutral" };
  if (diff > -8) return { text: "היריבה חזקה מכם", tone: "negative" };
  return { text: "היריבה חזקה משמעותית מכם ⚠️", tone: "negative" };
}

/**
 * מסך "סקאוטינג" לפני תחילת המשחק הבא: אין נתוני שחקנים בודדים
 * ליריבות (רק דירוג baseStrength כללי לקבוצה - ראו leagues.js), אז
 * המסך מתמקד בהשוואת עוצמת הסגל שלנו (כולל כושר נוכחי!) מול דירוג
 * היריבה, ובהערכת סיכויי ניצחון/תיקו/הפסד המבוססת על אותה נוסחה
 * שמשמשת בפועל את מנוע הסימולציה (simulate.js) - אך בלי רכיב ה-swing
 * האקראי, כי כאן רוצים "ממוצע צפוי" יציב ולא דגימה חד-פעמית.
 */
export function renderScouting({ state }) {
  const round = state.fixtures[state.round];
  const match = round ? findTeamMatch(round, state.teamId) : null;
  if (!match) {
    return `
      <div class="screen">
        <div class="card center-col">
          <p>אין משחק במחזור הבא.</p>
          <button class="btn" data-action="start-scouted-match">המשך</button>
        </div>
      </div>`;
  }

  const myStrength = computeManagedTeamStrength(state.squad);
  const oppStrength = getTeam(state.leagueId, match.opponent).baseStrength;
  const diffInfo = difficultyLabel(myStrength - oppStrength);
  const probs = estimateMatchProbabilities(myStrength, oppStrength);

  const standings = sortedTable(state.table);
  const idx = standings.findIndex((r) => r.teamId === match.opponent);
  const position = idx === -1 ? null : idx + 1;

  const maxBar = Math.max(myStrength, oppStrength, 1);
  const myPct = Math.round((myStrength / maxBar) * 100);
  const oppPct = Math.round((oppStrength / maxBar) * 100);

  return `
    <div class="screen">
      <div class="card center-col">
        <div style="font-size:1.8rem">🔍</div>
        <h2>סקאוטינג: המשחק הבא</h2>
        <div class="teams-crests">
          ${teamCrestSvg(state.teamId, 36)}
          <span class="teams">${teamName(state.leagueId, state.teamId)} נגד ${teamName(state.leagueId, match.opponent)}</span>
          ${teamCrestSvg(match.opponent, 36)}
        </div>
        <p class="muted">${match.isHome ? "משחק בית" : "משחק חוץ"}${position ? ` · מקום ${position} בטבלה` : ""}</p>
      </div>

      <div class="card">
        <h3 style="margin-top:0">רמת קושי</h3>
        <div class="scout-row">
          <span class="scout-label">הקבוצה שלכם (לפי הסגל והכושר הנוכחי)</span>
          <span class="scout-value">${myStrength.toFixed(1)}</span>
        </div>
        <div class="scout-bar-track"><div class="scout-bar-fill mine" style="width:${myPct}%"></div></div>
        <div class="scout-row" style="margin-top:8px">
          <span class="scout-label">${teamName(state.leagueId, match.opponent)}</span>
          <span class="scout-value">${oppStrength.toFixed(1)}</span>
        </div>
        <div class="scout-bar-track"><div class="scout-bar-fill opp" style="width:${oppPct}%"></div></div>
        <p class="scout-difficulty tone-${diffInfo.tone}">${diffInfo.text}</p>
      </div>

      <div class="card">
        <h3 style="margin-top:0">הערכת סיכויים למשחק</h3>
        <div class="odds-bar">
          <div class="odds-seg tone-positive" style="width:${(probs.win * 100).toFixed(0)}%"><span>${(probs.win * 100).toFixed(0)}%</span></div>
          <div class="odds-seg tone-neutral" style="width:${(probs.draw * 100).toFixed(0)}%"><span>${(probs.draw * 100).toFixed(0)}%</span></div>
          <div class="odds-seg tone-negative" style="width:${(probs.loss * 100).toFixed(0)}%"><span>${(probs.loss * 100).toFixed(0)}%</span></div>
        </div>
        <div class="odds-legend">
          <div class="odds-legend-item"><span class="odds-dot tone-positive"></span><span>ניצחון</span></div>
          <div class="odds-legend-item"><span class="odds-dot tone-neutral"></span><span>תיקו</span></div>
          <div class="odds-legend-item"><span class="odds-dot tone-negative"></span><span>הפסד</span></div>
        </div>
        <p class="muted" style="font-size:0.72rem;margin-top:6px">הערכה משוערת בלבד - התוצאה בפועל תלויה גם ברכיב אקראי שיש בכל משחק.</p>
      </div>

      <button class="btn" style="margin-top:6px" data-action="start-scouted-match">⚽ התחל משחק</button>
    </div>
  `;
}

export function renderHome({ state, allPlayers }) {
  const league = getLeague(state.leagueId);
  const roundsTotal = state.fixtures.length;
  return `
    <div class="screen">
      <div class="top-bar">
        <div class="team-identity">
          ${teamCrestSvg(state.teamId, 38)}
          <div>
            <div class="team-name">${teamName(state.leagueId, state.teamId)}</div>
            <div class="league-name">
              ${league.name_he}
              ${state.careerMode ? ` · שלב ${(state.careerStageIndex ?? 0) + 1}/${CAREER_STAGES.length}` : ""}
            </div>
          </div>
        </div>
        <div class="season-round">
          <div>עונה ${state.season}</div>
          <div>מחזור ${Math.min(state.round + 1, roundsTotal)} מתוך ${roundsTotal}</div>
        </div>
      </div>

      <div class="card row">
        <span>יתרת תקציב</span>
        <span class="budget-display">${formatMoney(state.budget)}</span>
      </div>

      ${navTabsHtml("home", { hasTransferWindow: !!state.transferWindow })}

      <h2>הסגל שלך</h2>
      ${squadPitchHtml(state, allPlayers)}

      ${nextOpponentHtml(state)}

      <div style="margin-top:18px">
        <button class="btn" data-action="play-round">⚽ שחק מחזור הבא</button>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-secondary" data-action="goto-new-game">התחלת משחק חדש</button>
      </div>
    </div>
  `;
}

export function renderTable({ state }) {
  const league = getLeague(state.leagueId);
  const rows = Object.values(state.table)
    .map((r) => ({
      ...r,
      points: r.won * SETTINGS.POINTS_WIN + r.drawn * SETTINGS.POINTS_DRAW,
      goalDiff: r.goalsFor - r.goalsAgainst,
    }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);

  return `
    <div class="screen">
      <div class="top-bar">
        <h2>טבלת ${league.name_he}</h2>
      </div>
      ${navTabsHtml("table", { hasTransferWindow: !!state.transferWindow })}
      <div class="card" style="overflow-x:auto">
        <table class="league-table">
          <thead>
            <tr>
              <th>#</th><th>קבוצה</th><th>מש'</th><th>נ</th><th>ת</th><th>פ</th>
              <th>ז</th><th>ח</th><th>הפרש</th><th>נק'</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r, i) => `
              <tr class="${r.teamId === state.teamId ? "user-row" : ""}">
                <td>${i + 1}</td>
                <td class="team-cell"><span class="team-cell-inner">${teamCrestSvg(r.teamId, 18)}${teamName(state.leagueId, r.teamId)}</span></td>
                <td>${r.played}</td>
                <td>${r.won}</td>
                <td>${r.drawn}</td>
                <td>${r.lost}</td>
                <td>${r.goalsFor}</td>
                <td>${r.goalsAgainst}</td>
                <td>${r.goalDiff > 0 ? "+" : ""}${r.goalDiff}</td>
                <td><b>${r.points}</b></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * מסך "⚽ מלך שערי העונה / מלך הבישולים" - טבלת כובשים ומבשלים לכל
 * הליגה הנוכחית (לא רק הסגל שלך - ראו playerStats.js), ממוינת מהגבוה
 * לנמוך. מתאפסת כל עונה חדשה (אין היסטוריה חוצת-עונות).
 */
export function renderPlayerStats({ state, allPlayers }) {
  const league = getLeague(state.leagueId);
  const statsRows = Object.entries(state.playerStats || {}).map(([playerIdStr, s]) => {
    const player = findById(allPlayers, Number(playerIdStr));
    return {
      name: player ? playerDisplayName(player) : "?",
      nationality: player ? player.nationality : null,
      teamId: s.teamId,
      goals: s.goals || 0,
      assists: s.assists || 0,
    };
  });

  const topScorers = statsRows
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, 20);
  const topAssisters = statsRows
    .filter((r) => r.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, 20);

  const rowHtml = (r, valueKey) => `
    <tr class="${r.teamId === state.teamId ? "user-row" : ""}">
      <td class="team-cell"><span class="team-cell-inner">${r.nationality ? `<span class="player-flag">${flagEmoji(r.nationality)}</span>` : ""}${escapeHtml(r.name)}</span></td>
      <td class="team-cell"><span class="team-cell-inner">${teamCrestSvg(r.teamId, 18)}${teamName(state.leagueId, r.teamId)}</span></td>
      <td><b>${r[valueKey]}</b></td>
    </tr>`;

  const tableHtml = (rows, valueKey, valueLabel, emptyText) =>
    rows.length
      ? `
      <div class="card" style="overflow-x:auto">
        <table class="league-table">
          <thead><tr><th>שחקן</th><th>קבוצה</th><th>${valueLabel}</th></tr></thead>
          <tbody>${rows.map((r) => rowHtml(r, valueKey)).join("")}</tbody>
        </table>
      </div>`
      : `<p class="muted">${emptyText}</p>`;

  return `
    <div class="screen">
      <div class="top-bar">
        <h2>⚽ מלך שערי העונה - ${league.name_he}</h2>
      </div>
      ${navTabsHtml("stats", { hasTransferWindow: !!state.transferWindow })}

      <h3>מלך שערי העונה</h3>
      ${tableHtml(topScorers, "goals", "שערים", "עדיין לא נקלעו שערים העונה.")}

      <h3 style="margin-top:18px">מלך הבישולים</h3>
      ${tableHtml(topAssisters, "assists", "בישולים", "עדיין לא נרשמו בישולים העונה.")}
    </div>
  `;
}

export function renderFinances({ state }) {
  const f = state.finance;
  const incomeTotal = Object.values(f.income).reduce((a, b) => a + b, 0);
  const expenseTotal = Object.values(f.expenses).reduce((a, b) => a + b, 0);
  const incomeLabels = {
    matchBonuses: "בונוסים על ניצחון/תיקו",
    scorerBonuses: "בונוס מלך שערים",
    sponsorships: "חסויות",
    eventIncome: "הכנסות מאירועים",
    prizes: "פרסים",
  };
  const expenseLabels = {
    matchPenalties: "קנסות על הפסדים",
    salaries: "שכר שחקנים",
    eventExpense: "הוצאות מאירועים",
    transfersNet: "רכישות שחקנים (נטו)",
  };
  const pendingCommitments = state.commitments.filter((c) => c.season === state.season);

  return `
    <div class="screen">
      <div class="top-bar">
        <h2>מצב כספי - עונה ${state.season}</h2>
      </div>
      ${navTabsHtml("finances", { hasTransferWindow: !!state.transferWindow })}

      <div class="card row">
        <span>יתרה נוכחית</span>
        <span class="budget-display">${formatMoney(state.budget)}</span>
      </div>

      <div class="finance-grid">
        <div class="card">
          <h3>הכנסות העונה</h3>
          ${Object.entries(f.income)
            .map(
              ([k, v]) =>
                `<div class="finance-line"><span>${incomeLabels[k] || k}</span><span class="income-amount">+${formatMoney(v)}</span></div>`
            )
            .join("")}
          <div class="finance-line"><span><b>סה"כ הכנסות</b></span><span class="income-amount"><b>+${formatMoney(incomeTotal)}</b></span></div>
        </div>
        <div class="card">
          <h3>הוצאות העונה</h3>
          ${Object.entries(f.expenses)
            .map(
              ([k, v]) =>
                `<div class="finance-line"><span>${expenseLabels[k] || k}</span><span class="expense-amount">-${formatMoney(v)}</span></div>`
            )
            .join("")}
          <div class="finance-line"><span><b>סה"כ הוצאות</b></span><span class="expense-amount"><b>-${formatMoney(expenseTotal)}</b></span></div>
        </div>
      </div>

      ${
        pendingCommitments.length
          ? `<div class="card">
              <h3>התחייבויות עתידיות (יחולו בסוף העונה)</h3>
              ${pendingCommitments
                .map(
                  (c) =>
                    `<div class="finance-line"><span>${escapeHtml(c.description)}</span><span class="${c.isExpenseBucket ? "expense-amount" : "income-amount"}">${c.isExpenseBucket ? "-" : "+"}${formatMoney(Math.abs(c.amount))}</span></div>`
                )
                .join("")}
            </div>`
          : ""
      }

      <div class="card">
        <h3>שכר שחקנים עונתי נוכחי</h3>
        <div class="finance-line"><span>סה"כ שכר לתשלום בסוף העונה</span><b>${formatMoney(totalSquadSalary(state.squad))}</b></div>
      </div>
    </div>
  `;
}

export function renderTransferWindow({ state, allPlayers, feedback }) {
  const league = getLeague(state.leagueId);
  // ממוינים לפי סדר העמדות הקבוע (שוער -> מגן -> קשר -> חלוץ), כדי שיהיה
  // קל יותר לסרוק את 7 ההצעות - לא לפי סדר הגרלה אקראי כמו קודם.
  const offers = state.transferWindow.players
    .map((id) => findById(allPlayers, id))
    .sort((a, b) => SETTINGS.SQUAD_POSITIONS.indexOf(a.position) - SETTINGS.SQUAD_POSITIONS.indexOf(b.position));

  return `
    <div class="screen">
      <div class="top-bar">
        <h2>🔄 חלון העברות</h2>
        <span class="budget-display">${formatMoney(state.budget)}</span>
      </div>
      ${navTabsHtml("transferWindow", { hasTransferWindow: true })}
      <p>${state.transferWindow.atRound === 0 ? "חלון ההעברות הראשון של העונה" : "חלון ההעברות השני של העונה"} - 7 שחקנים זמינים, ממוינים לפי עמדה. ניתן לבצע רכישה אחת לכל עמדה בחלון הזה, כל עוד יש מספיק תקציב. אפשר לקפוץ לסגל/טבלה/כספים ולחזור לשוק כמה פעמים שרוצים - הקניות נשמרות, החלון נסגר רק בלחיצה על הכפתור בתחתית.</p>

      ${feedback ? `<div class="card-flat" style="margin-bottom:12px;border-color:${feedback.ok ? "var(--accent)" : "var(--red)"}">${escapeHtml(feedback.message)}</div>` : ""}

      <div class="col-stack">
        ${offers
          .map((p) => {
            const currentSlot = getSlotByPosition(state.squad, p.position);
            const currentPlayer = currentSlot ? findById(allPlayers, currentSlot.playerId) : null;
            const { netPrice } = calcNetPrice(state.squad, allPlayers, p);
            const alreadyOwned = currentSlot && currentSlot.playerId === p.id;
            const positionUsed = (state.transferWindow.purchasedPositions || []).includes(p.position);
            const affordable = netPrice <= state.budget;
            const isProfit = netPrice < 0;
            const priceLabel = isProfit
              ? `רווח משינמוך: +${formatMoney(Math.abs(netPrice))}`
              : netPrice === 0
                ? "מחיר נטו: חינם"
                : `מחיר נטו: ${formatMoney(netPrice)}`;
            return `
            <div class="transfer-card">
              <div class="row" style="align-items:flex-start">
                ${futCardHtml({
                  rating: p.ability,
                  position: p.position,
                  name: playerDisplayName(p),
                  nationality: p.nationality,
                  size: "sm",
                  statLines: [{ icon: "💰", value: formatMoneyShort(p.market_value) }],
                })}
                <div style="text-align:left;flex:1">
                  <div class="muted" style="margin-bottom:4px">שחקן נוכחי בעמדה:</div>
                  <div>${currentPlayer ? playerNameWithFlag(currentPlayer) + " (" + formatMoneyShort(currentPlayer.market_value) + ")" : "-"}</div>
                </div>
              </div>
              <div class="divider"></div>
              <div class="row" style="margin-top:8px">
                <span class="net-price ${netPrice <= 0 ? "free" : ""}">${priceLabel}</span>
                <button class="btn" style="width:auto" data-action="buy-player" data-player="${p.id}"
                  ${alreadyOwned || !affordable || positionUsed ? "disabled" : ""}>
                  ${alreadyOwned ? "כבר בסגל" : positionUsed ? "כבר בוצעה רכישה לעמדה זו" : !affordable ? "אין מספיק כסף" : isProfit ? "קנה ותרוויח" : "קנה"}
                </button>
              </div>
            </div>`;
          })
          .join("")}
      </div>

      <button class="btn btn-secondary" style="margin-top:16px" data-action="close-transfer-window">סיום קניות - המשך למחזור</button>
    </div>
  `;
}

function oddsBarHtml(branches) {
  return `
    <div class="odds-bar">
      ${branches
        .map(
          (b) =>
            `<div class="odds-seg tone-${b.tone}${b.hit ? " hit" : ""}" style="width:${(b.probability * 100).toFixed(0)}%">
              <span>${(b.probability * 100).toFixed(0)}%</span>
            </div>`
        )
        .join("")}
    </div>
    <div class="odds-legend">
      ${branches
        .map(
          (b) =>
            `<div class="odds-legend-item${b.hit ? " hit" : ""}">
              <span class="odds-dot tone-${b.tone}"></span>
              <span>${escapeHtml(b.label)}${b.lines.length ? " · " + b.lines.map(escapeHtml).join(", ") : ""}</span>
            </div>`
        )
        .join("")}
    </div>
  `;
}

export function renderEvent({ state }) {
  const ev = state.pendingEvent;
  // שפת שמות השחקנים הנוכחית: לאירועים נשמרות שתי גרסאות מוכנות של
  // הטקסטים (he/en) כבר ב-triggerEvent, כי הם "נאפים" פעם אחת עם שם
  // השחקן בתוכם - כאן רק בוחרים איזו גרסה להציג.
  const isEn = getNameLang() === "en";
  const evTitle = isEn && ev.titleEn ? ev.titleEn : ev.title;
  const evDescription = isEn && ev.descriptionEn ? ev.descriptionEn : ev.description;
  return `
    <div class="screen">
      <div class="card">
        <div class="center-col" style="padding-top:0;padding-bottom:8px">
          <div style="font-size:2rem">📣</div>
          <h2>${escapeHtml(evTitle)}</h2>
          <p>${escapeHtml(evDescription)}</p>
        </div>
        <div class="col-stack">
          ${ev.options
            .map((o, i) => {
              const sureLines = o.summaryLines.length
                ? `<div class="event-option-lines">${o.summaryLines.map((l) => `<span class="event-line">${escapeHtml(l)}</span>`).join("")}</div>`
                : o.gamble
                  ? ""
                  : `<div class="event-option-lines"><span class="event-line">ללא השפעה</span></div>`;
              const gambleHtml = o.gamble
                ? `<div class="gamble-box">${oddsBarHtml(o.gamble.branches)}</div>`
                : "";
              return `
                <div class="card-flat event-option">
                  <div class="row" style="align-items:flex-start">
                    <div style="flex:1">
                      <div class="event-option-label">${escapeHtml(isEn && o.labelEn ? o.labelEn : o.label)}</div>
                      ${sureLines}
                      ${gambleHtml}
                    </div>
                  </div>
                  <button class="btn ${i === 0 ? "" : "btn-secondary"}" style="margin-top:10px" data-action="resolve-event" data-option="${o.id}">לבחור באופציה זו</button>
                </div>`;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * גלגל המזל של ההגרלה: צבעי הפלחים על הגלגל לפי ה-tone של כל branch,
 * כך שהשטח של כל פלח משקף את ההסתברות האמיתית. הפלחים מסודרים
 * עם השעון החל מזווית 0 (למעלה), בדיוק כמו conic-gradient.
 */
const WHEEL_TONE_COLORS = {
  positive: "#1f8a52",
  negative: "#8e2f42",
  neutral: "#8a6d1f",
  mixed: "#8a6d1f",
};

const WHEEL_TONE_VARS = {
  positive: "var(--accent)",
  negative: "var(--red)",
  neutral: "var(--gold)",
  mixed: "var(--gold)",
};

/**
 * מחשב את גאומטריית הגלגל: גבולות הפלחים (במעלות, עם השעון מ-0=למעלה)
 * וזווית הסיבוב הסופית שתנחית את המחוג בתוך פלח הזכייה. התוצאה עצמה
 * כבר הוכרעה במנוע (winningLabel) - כאן רק בוחרים נקודת נחיתה אקראית
 * בטווח 60% המרכזיים של הפלח הזוכה, כדי שהמחוג לא יעצור על קו גבול.
 */
function wheelGeometry(branches, winningLabel) {
  let acc = 0;
  const segs = branches.map((b) => {
    const start = acc;
    acc += b.probability;
    return { branch: b, startDeg: start * 360, endDeg: acc * 360 };
  });
  const win = segs.find((s) => s.branch.label === winningLabel) || segs[0];
  const width = win.endDeg - win.startDeg;
  const mid = (win.startDeg + win.endDeg) / 2;
  const jitter = (Math.random() - 0.5) * 0.6 * width;
  const landAngle = mid + jitter;
  const TURNS = 4;
  const rotation = 360 * TURNS - landAngle;
  return { segs, win, rotation };
}

/**
 * מסך "מגרילים..." - גלגל מזל שמסתובב ~2 שניות ונעצר כשהמחוג על הפלח
 * של התוצאה שכבר הוכרעה בפועל במנוע (לא כאן - רק האנימציה מוצגת כאן).
 * זווית העצירה מוטבעת ב-data-rotation, ו-startEventSpin (ב-app.js)
 * מפעיל את ה-transform מיד אחרי שהמסך צויר. אי אפשר לדעת את התוצאה
 * לפני העצירה: פריט המקרא המסומן מודגש רק כשמתווספת הקלאס landed.
 */
export function renderEventSpin({ title, optionLabel, branches, winningLabel }) {
  const { segs, win, rotation } = wheelGeometry(branches, winningLabel);
  const stops = segs
    .map(
      (s) =>
        `${WHEEL_TONE_COLORS[s.branch.tone] || WHEEL_TONE_COLORS.neutral} ${s.startDeg.toFixed(1)}deg ${s.endDeg.toFixed(1)}deg`
    )
    .join(", ");
  return `
    <div class="screen">
      <div class="card center-col">
        <div style="font-size:2rem">🎡</div>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">בחרת: ${escapeHtml(optionLabel)} · מגרילים...</p>
        <div class="wheel-stage" id="wheel-stage" style="--win-color:${WHEEL_TONE_VARS[win.branch.tone] || WHEEL_TONE_VARS.neutral}">
          <div class="wheel-pointer"></div>
          <div class="spin-wheel" id="spin-wheel" data-rotation="${rotation.toFixed(1)}" style="background:conic-gradient(${stops})">
            ${segs
              .map((s) => {
                const mid = ((s.startDeg + s.endDeg) / 2).toFixed(1);
                return `<div class="wheel-pct" style="transform:translate(-50%,-50%) rotate(${mid}deg) translateY(-64px)">${(s.branch.probability * 100).toFixed(0)}%</div>`;
              })
              .join("")}
            <div class="wheel-hub">⚽</div>
          </div>
          <div class="wheel-win-ring"></div>
        </div>
        <div class="odds-legend">
          ${branches
            .map(
              (b) =>
                `<div class="odds-legend-item" data-hit="${b.label === winningLabel}">
                  <span class="odds-dot tone-${b.tone}"></span>
                  <span>${escapeHtml(b.label)}</span>
                </div>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

export function renderEventOutcome({ outcome }) {
  const ro = outcome.randomOutcome;
  const isEn = getNameLang() === "en";
  const outcomeTitle = isEn && outcome.titleEn ? outcome.titleEn : outcome.title;
  const outcomeOptionLabel = isEn && outcome.optionLabelEn ? outcome.optionLabelEn : outcome.optionLabel;
  return `
    <div class="screen">
      <div class="card center-col">
        <div style="font-size:2rem">${ro ? "🎲" : "✅"}</div>
        <h2>${escapeHtml(outcomeTitle)}</h2>
        <p class="muted">בחרת: ${escapeHtml(outcomeOptionLabel)}</p>

        ${
          ro
            ? `
          <div class="gamble-box reveal" style="width:100%">
            ${oddsBarHtml(
              outcome.gamble
                ? outcome.gamble.branches.map((b) => ({ ...b, hit: b.label === ro.label }))
                : [{ probability: 1, tone: ro.tone, label: ro.label, lines: ro.subNotes || [] }]
            )}
            <div class="odds-result tone-${ro.tone}">🎯 ${escapeHtml(ro.label)} (${(ro.probability * 100).toFixed(0)}% סיכוי)</div>
          </div>`
            : ""
        }

        <div class="event-outcome-lines">
          ${(outcome.notes || [])
            .filter((n) => n !== ro?.label)
            .map((n) => `<div class="event-line result">${escapeHtml(n)}</div>`)
            .join("")}
          ${ro && (ro.subNotes || []).length ? ro.subNotes.map((n) => `<div class="event-line result">${escapeHtml(n)}</div>`).join("") : ""}
          ${!(outcome.notes || []).length && !ro ? `<div class="event-line result">ללא השפעה</div>` : ""}
        </div>

        <button class="btn" style="width:100%;margin-top:10px" data-action="continue-event-outcome">המשך</button>
      </div>
    </div>
  `;
}

function positionDeltaHtml(delta) {
  if (!delta) return `<span class="pos-delta same">–</span>`;
  if (delta > 0) return `<span class="pos-delta up">▲${delta}</span>`;
  return `<span class="pos-delta down">▼${Math.abs(delta)}</span>`;
}

/** טבלת סיכום כובשים (כמו סיכום משחק אמיתי) מתחת לתוצאה. */
function matchScorersHtml(state, allPlayers, um, goals) {
  if (!um || !goals || !goals.some((g) => g.teamId === state.teamId)) return "";
  const lines = (teamId) => {
    const byPlayer = new Map();
    for (const g of goals.filter((x) => x.teamId === teamId)) {
      const key = g.playerId ?? "?";
      if (!byPlayer.has(key)) byPlayer.set(key, { playerId: g.playerId, minutes: [] });
      byPlayer.get(key).minutes.push(g.minute);
    }
    return [...byPlayer.values()]
      .sort((a, b) => a.minutes[0] - b.minutes[0])
      .map((p) => {
        const player = p.playerId != null ? findById(allPlayers, p.playerId) : null;
        const name = player ? escapeHtml(playerDisplayName(player)) : "שחקן";
        return `<div class="scorer-line"><span class="scorer-ball">⚽</span><span class="scorer-name">${name}</span><span class="scorer-min" dir="ltr">${p.minutes.map((m) => `${m}'`).join(" ")}</span></div>`;
      })
      .join("");
  };
  const col = (teamId) => `<div class="scorers-col"><div class="scorers-team">${teamCrestSvg(teamId, 16)}<span>${teamName(state.leagueId, teamId)}</span></div>${lines(teamId) || '<div class="scorer-line muted">-</div>'}</div>`;
  // רק הכובשים של הקבוצה של המשתמש
  // כותרת התוצאה תמיד מציגה את הקבוצה של המשתמש ראשונה (ימין ב-RTL), בין אם בית ובין אם חוץ,
  // ולכן הבלוק תמיד בצד ההתחלה (ימין), חצי רוחב.
  return `<div class="match-scorers">${col(state.teamId)}</div>`;
}

export function renderRoundResult({ state, allPlayers, roundSummary, fitnessDiffs }) {
  const league = getLeague(state.leagueId);
  const um = roundSummary.userMatch;
  let heroHtml;
  if (!um) {
    heroHtml = `<div class="match-result-hero"><div class="teams">הקבוצה שלך נחה במחזור זה</div></div>`;
  } else {
    const isHome = um.homeTeam === state.teamId;
    const myGoals = isHome ? um.homeGoals : um.awayGoals;
    const oppGoals = isHome ? um.awayGoals : um.homeGoals;
    const oppTeam = isHome ? um.awayTeam : um.homeTeam;
    const outcomeClass =
      roundSummary.userOutcome === "win" ? "outcome-win" : roundSummary.userOutcome === "loss" ? "outcome-loss" : "outcome-draw";
    const outcomeLabel =
      roundSummary.userOutcome === "win" ? "ניצחון!" : roundSummary.userOutcome === "loss" ? "הפסד" : "תיקו";
    heroHtml = `
      <div class="match-result-hero">
        <div class="badge ${outcomeClass}" style="background:transparent">${outcomeLabel}</div>
        <div class="teams-crests">${teamCrestSvg(state.teamId, 34)}<span class="teams">${teamName(state.leagueId, state.teamId)} נגד ${teamName(state.leagueId, oppTeam)}</span>${teamCrestSvg(oppTeam, 34)}</div>
        <div class="score score-reveal ${outcomeClass}">${myGoals} - ${oppGoals}</div>
        ${matchScorersHtml(state, allPlayers, um, roundSummary.userMatchGoals)}
      </div>
    `;
  }

  // חלון טבלה מצומצם: הקבוצה שלנו ± 2 שורות, כדי שרואים את ההשפעה על
  // המיקום בלי להציג את כל הקבוצות בליגה (שם הסיבה העיקרית לגלילה הארוכה).
  const standings = roundSummary.standings;
  const userIdx = standings.findIndex((r) => r.teamId === state.teamId);
  const windowStart = Math.max(0, Math.min(userIdx - 2, standings.length - 5));
  const windowEnd = Math.min(standings.length, windowStart + 5);
  const windowedStandings = standings.slice(windowStart, windowEnd).map((r, i) => ({ row: r, rank: windowStart + i + 1 }));

  const fitnessLines = state.squad
    .map((slot) => {
      const player = findById(allPlayers, slot.playerId);
      const diff = fitnessDiffs ? fitnessDiffs[slot.playerId] || 0 : 0;
      if (!diff) return null;
      return `<div class="fitness-change-line"><span>${positionLabel(slot.position)} · ${playerNameWithFlag(player)}</span><span class="${diff > 0 ? "income-amount" : "expense-amount"}">${diff > 0 ? "+" : ""}${diff} כושר</span></div>`;
    })
    .filter(Boolean)
    .join("");

  return `
    <div class="screen">
      <div class="card">${heroHtml}</div>

      <h2>טבלת ${league.name_he} ${windowStart > 0 || windowEnd < standings.length ? '<span class="muted" style="font-size:0.75rem">(סביב מיקומכם)</span>' : ""}</h2>
      <div class="card" style="overflow-x:auto">
        <table class="league-table">
          <thead>
            <tr><th>#</th><th>קבוצה</th><th>מש'</th><th>נק'</th><th>שינוי</th></tr>
          </thead>
          <tbody>
            ${windowedStandings
              .map(
                ({ row: r, rank }) => `
              <tr class="${r.teamId === state.teamId ? "user-row" : ""}">
                <td>${rank}</td>
                <td class="team-cell"><span class="team-cell-inner">${teamCrestSvg(r.teamId, 18)}${teamName(state.leagueId, r.teamId)}</span></td>
                <td>${r.played}</td>
                <td><b>${r.points}</b></td>
                <td>${positionDeltaHtml(roundSummary.positionDeltas ? roundSummary.positionDeltas[r.teamId] : 0)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      ${fitnessLines ? `<div class="card-flat"><h3 style="margin-top:0">שינויי כושר מהמחזור</h3>${fitnessLines}</div>` : ""}

      <button class="btn" style="margin-top:16px" data-action="continue-flow">המשך</button>
    </div>
  `;
}

export function renderSeasonEnd({
  state,
  leagueId,
  teamId,
  summary,
  championTeamId,
  finalPosition,
  bankrupt,
  careerAdvanced = false,
  careerNewLeagueId = null,
  careerWon = false,
  allPlayers = [],
}) {
  const league = getLeague(leagueId);
  const isChampion = championTeamId === teamId;

  let careerBannerHtml = "";
  if (careerWon) {
    // state.season כבר קודם לעונה הבאה בשלב הזה (ראו seasonEnd.js) - העונה
    // שבה בפועל זכו ב"אגדה" היא אחת פחות מזה.
    const seasonsTaken = Math.max(1, state.season - 1);
    const shareText = `הפכתי קבוצת כדורגל לאגדה תוך ${seasonsTaken} עונות, נסו גם אתם: https://fm-lite-ecru.vercel.app`;
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    careerBannerHtml = `
      <h2 style="color:var(--gold)">אגדה! 👑 סיימת את כל מסלול "ממתחיל לאגדה"!</h2>
      <p class="muted">עשית את זה תוך ${seasonsTaken} עונות.</p>
      <a class="btn" style="background:#25D366; color:#fff; display:inline-block; text-decoration:none; margin-top:8px"
         href="${shareUrl}" target="_blank" rel="noopener">שתף בווטסאפ 📲</a>
    `;
  } else if (careerAdvanced) {
    const nextLeague = getLeague(careerNewLeagueId);
    careerBannerHtml = `<h3 style="color:var(--gold)">עלית לשלב הבא: ${nextLeague.name_he}! 🚀</h3>`;
  } else if (state.careerMode) {
    careerBannerHtml = `<p class="muted">נשארת ב${league.name_he} - תנסה שוב לזכות באליפות בעונה הבאה כדי לעלות.</p>`;
  }

  // פירוט תוצאות המשחקים (לא כולל שוק העברות) - כמות ניצחונות/תיקו/הפסדים
  // בעונה שהסתיימה כפול הבונוס/הקנס הקבוע לכל אחד, לפי settings.js.
  const record = summary.matchRecord || { won: 0, drawn: 0, lost: 0 };
  // moneyMultiplier משקף את מכפיל שלב הקריירה שהיה בתוקף בעונה שהסתיימה
  // (ראו careerMoneyMultiplier ב-career.js) - חייב להתבסס על הערך
  // שחזר מהחישוב בפועל (summary), לא לחשב מחדש מ-state.careerStageIndex
  // כאן, כי הוא כבר עשוי להיות מעודכן לשלב הבא אם הייתה עלייה.
  const mult = summary.moneyMultiplier ?? 1;
  const winTotal = Math.round(record.won * SETTINGS.BONUS_WIN * mult);
  const drawTotal = Math.round(record.drawn * SETTINGS.BONUS_DRAW * mult);
  const lossTotal = record.lost * SETTINGS.PENALTY_LOSS;

  // "רווח/הפסד נטו לעונה" מחושב כאן רק מסכום השורות שמוצגות בכרטיס -
  // משחקים, פרס, חסות, שכר, והתחייבויות מאירועים - ובכוונה לא כולל את
  // תנועות שוק ההעברות (קניות/מכירות שחקנים), כדי שהמספר ישקף רק את
  // הכלכלה "השוטפת" של הקבוצה ולא יתערבב עם החלטות שוק נקודתיות.
  const commitmentsNet = summary.commitmentsApplied.reduce((sum, c) => sum + c.amount, 0);
  const topScorers = summary.topScorers || [];
  const scorerBonusTotal = topScorers.reduce((sum, t) => sum + t.bonus, 0);
  const netChange = scorerBonusTotal + winTotal + drawTotal - lossTotal + summary.prize + (summary.baseIncome || 0) - summary.salaries + commitmentsNet;
  const netClass = netChange > 0 ? "income-amount" : netChange < 0 ? "expense-amount" : "";
  const netSign = netChange > 0 ? "+" : netChange < 0 ? "-" : "";

  return `
    <div class="screen">
      <div class="card center-col">
        <div class="trophy">${isChampion ? "🏆" : "🏁"}</div>
        <h1>סוף העונה - ${league.name_he}</h1>
        ${isChampion ? `<h2 style="color:var(--gold)">אלופים! 🎉</h2>` : `<p>סיימתם במקום ${finalPosition} מתוך ${league.teams.length}</p>`}
        <p>האלופה: <b>${teamName(leagueId, championTeamId)}</b></p>
        ${careerBannerHtml}
      </div>

      <div class="card">
        <h3>סיכום כלכלי</h3>
        <p class="muted" style="margin-top:-4px">משחקים ובונוסי סוף עונה בלבד - לא כולל שוק העברות.</p>
        <div class="finance-line"><span>${record.won} ניצחונות</span><span class="income-amount">+${formatMoney(winTotal)}</span></div>
        <div class="finance-line"><span>${record.drawn} תיקו</span><span class="income-amount">+${formatMoney(drawTotal)}</span></div>
        <div class="finance-line"><span>${record.lost} הפסדים</span><span class="expense-amount">-${formatMoney(lossTotal)}</span></div>
        ${topScorers
          .filter((t) => t.isUser)
          .map((t) => {
            const p = findById(allPlayers, t.playerId);
            const title = t.rank === 1 ? "👑 מלך השערים" : "🥈 סגן מלך השערים";
            const who = `${p ? escapeHtml(playerDisplayName(p)) : "?"} (${t.goals} שערים, ${teamName(leagueId, t.teamId)})`;
            return `<div class="finance-line"><span>${title}: ${who}</span>${t.bonus > 0 ? `<span class="income-amount">+${formatMoney(t.bonus)}</span>` : ""}</div>`;
          })
          .join("")}
        <div class="finance-line"><span>פרס מיקום בטבלה</span><span class="income-amount">+${formatMoney(summary.prize)}</span></div>
        <div class="finance-line"><span>הכנסת חסות/שידור קבועה</span><span class="income-amount">+${formatMoney(summary.baseIncome || 0)}</span></div>
        <div class="finance-line"><span>שכר ששולם</span><span class="expense-amount">-${formatMoney(summary.salaries)}</span></div>
        ${summary.commitmentsApplied
          .map(
            (c) =>
              `<div class="finance-line"><span>${escapeHtml(c.description)}</span><span class="${c.isExpenseBucket ? "expense-amount" : "income-amount"}">${c.isExpenseBucket ? "-" : "+"}${formatMoney(Math.abs(c.amount))}</span></div>`
          )
          .join("")}
        <div class="finance-line" style="border-top:1px solid var(--border); margin-top:6px; padding-top:10px;">
          <span><b>רווח/הפסד נטו לעונה</b></span>
          <b class="${netClass}">${netSign}${formatMoney(Math.abs(netChange))}</b>
        </div>
        <p class="muted">יתרת התקציב בפועל (כולל שוק העברות): ${formatMoney(state.budget)}. שכר השחקנים עודכן באינפלציה של 2% לקראת העונה הבאה.</p>
      </div>

      <button class="btn" data-action="continue-flow">תחילת עונה ${state.season}</button>
    </div>
  `;
}

export function renderGameOver({ state, leagueId }) {
  const league = getLeague(leagueId);
  return `
    <div class="screen">
      <div class="card center-col">
        <div class="trophy">💸</div>
        <h1>המשחק הסתיים - פשיטת רגל</h1>
        <p>הקבוצה שלך ב${league.name_he} נקלעה לפשיטת רגל בעונה ${state.gameOver.atSeason}.</p>
        <p class="muted">היתרה ירדה לאפס או מתחת בעקבות חיוב אוטומטי (שכר/התחייבות).</p>
        <button class="btn" data-action="goto-new-game">משחק חדש</button>
      </div>
    </div>
  `;
}
