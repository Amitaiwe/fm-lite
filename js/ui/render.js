import { getLeague, getTeam, getLeagueList } from "../data/leagues.js";
import { findById } from "../engine/playersRepo.js";
import { calcNetPrice } from "../engine/transferMarket.js";
import { getSlotByPosition } from "../engine/squad.js";
import { totalSquadSalary } from "../engine/economy.js";
import { findTeamMatch } from "../engine/fixtures.js";
import { sortedTable } from "../engine/table.js";
import { computeManagedTeamStrength, estimateMatchProbabilities } from "../engine/simulate.js";
import { SETTINGS, POSITION_LABELS_HE } from "../data/settings.js";
import { formatMoney, formatMoneyShort, positionLabel, escapeHtml } from "./format.js";
import { teamCrestSvg } from "./crest.js";

function teamName(leagueId, teamId) {
  const t = getTeam(leagueId, teamId);
  return t ? t.name_he : teamId;
}

function navTabsHtml(active) {
  const tabs = [
    { id: "home", label: "סגל" },
    { id: "table", label: "טבלה" },
    { id: "finances", label: "כספים" },
  ];
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
        <button class="btn" data-action="goto-new-game">משחק חדש</button>
        <button class="btn btn-secondary" data-action="continue-game" ${hasSave ? "" : "disabled"}>
          המשך משחק שמור
        </button>
        ${!hasSave ? '<p class="muted">אין משחק שמור כרגע</p>' : ""}
      </div>
    </div>
  `;
}

export function renderLeaguePick({ confirmOverwrite }) {
  const leagues = getLeagueList();
  return `
    <div class="screen">
      <div class="brand">
        <div class="logo">בחירת <span>ליגה</span></div>
        <div class="tagline">הקבוצה שתנהל תוגרל אוטומטית מתוך 11 הקבוצות בליגה שתבחר</div>
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

/**
 * כרטיס שחקן בסגנון "אולטימייט טים" (FUT): מגן זהב/כחול עם דירוג
 * גדול, עמדה, שם, ושורת סטטים עם אייקונים. משמש גם לסגל (עם כושר)
 * וגם להצעות שוק ההעברות (בלי כושר - עוד לא בסגל).
 */
function futCardHtml({ rating, ratingDelta, position, name, statLines, size = "md" }) {
  return `
    <div class="fut-card fut-card-${size}">
      <div class="fut-rating">${rating}${ratingDelta ? deltaBadgeHtml(ratingDelta) : ""}</div>
      <div class="fut-pos">${positionLabel(position)}</div>
      <div class="fut-name">${escapeHtml(name)}</div>
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
    name: player.name_he,
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
            <div class="league-name">${league.name_he}</div>
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

      ${navTabsHtml("home")}

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
      ${navTabsHtml("table")}
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

export function renderFinances({ state }) {
  const f = state.finance;
  const incomeTotal = Object.values(f.income).reduce((a, b) => a + b, 0);
  const expenseTotal = Object.values(f.expenses).reduce((a, b) => a + b, 0);
  const incomeLabels = {
    matchBonuses: "בונוסים על ניצחון/תיקו",
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
      ${navTabsHtml("finances")}

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
  const offers = state.transferWindow.players.map((id) => findById(allPlayers, id));

  return `
    <div class="screen">
      <div class="top-bar">
        <h2>🔄 חלון העברות</h2>
        <span class="budget-display">${formatMoney(state.budget)}</span>
      </div>
      <p>${state.transferWindow.atRound === 0 ? "חלון ההעברות הראשון של העונה" : "חלון ההעברות השני של העונה"} - 7 שחקנים זמינים. ניתן לבצע רכישה אחת לכל עמדה בחלון הזה, כל עוד יש מספיק תקציב.</p>

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
                  name: p.name_he,
                  size: "sm",
                  statLines: [{ icon: "💰", value: formatMoneyShort(p.market_value) }],
                })}
                <div style="text-align:left;flex:1">
                  <div class="muted" style="margin-bottom:4px">שחקן נוכחי בעמדה:</div>
                  <div>${currentPlayer ? escapeHtml(currentPlayer.name_he) + " (" + formatMoneyShort(currentPlayer.market_value) + ")" : "-"}</div>
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
  return `
    <div class="screen">
      <div class="card">
        <div class="center-col" style="padding-top:0;padding-bottom:8px">
          <div style="font-size:2rem">📣</div>
          <h2>${escapeHtml(ev.title)}</h2>
          <p>${escapeHtml(ev.description)}</p>
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
                      <div class="event-option-label">${escapeHtml(o.label)}</div>
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
 * בונה רצף "פלחים" (חוזרים לפי משקל ההסתברות, כדי שתחושת ההגרלה
 * תשקף את האחוזים האמיתיים) לסרט ההגרלה - ואת פלח הניצחון כפריט
 * האחרון ברשימה, שהוא בדיוק מה ש-startEventSpin (ב-app.js) מעצור
 * עליו תחת המחוג המרכזי, אחרי שה-RNG כבר הכריע בפועל במנוע.
 */
function buildReelItems(branches, winningLabel) {
  const LOOPS = 6;
  const weighted = [];
  branches.forEach((b) => {
    const count = Math.max(1, Math.round(b.probability * 10));
    for (let i = 0; i < count; i++) weighted.push(b);
  });
  const items = [];
  for (let l = 0; l < LOOPS; l++) items.push(...weighted);
  const winningBranch = branches.find((b) => b.label === winningLabel) || branches[0];
  items.push(winningBranch);
  return items;
}

function reelChipHtml(branch) {
  return `
    <div class="reel-chip tone-${branch.tone}">
      <div class="reel-chip-pct">${(branch.probability * 100).toFixed(0)}%</div>
      <div class="reel-chip-label">${escapeHtml(branch.label)}</div>
    </div>`;
}

/**
 * מסך "מגרילים..." - סרט אופקי (כמו מכונת סלוט) שזז ונעצר על התוצאה
 * שכבר הוכרעה בפועל במנוע (לא כאן - רק האנימציה מוצגת כאן). האנימציה
 * עצמה (קביעת transform בפועל לאורך 3 שניות) מופעלת מ-app.js מיד
 * אחרי שהמסך הזה מצויר, כי היא דורשת מדידת פיקסלים אמיתית מה-DOM.
 */
export function renderEventSpin({ title, optionLabel, branches, winningLabel }) {
  const items = buildReelItems(branches, winningLabel);
  return `
    <div class="screen">
      <div class="card center-col">
        <div style="font-size:2rem">🎰</div>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">בחרת: ${escapeHtml(optionLabel)} · מגרילים...</p>
        <div class="reel-viewport" id="reel-viewport">
          <div class="reel-pointer"></div>
          <div class="reel-track" id="reel-track">
            ${items.map(reelChipHtml).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderEventOutcome({ outcome }) {
  const ro = outcome.randomOutcome;
  return `
    <div class="screen">
      <div class="card center-col">
        <div style="font-size:2rem">${ro ? "🎲" : "✅"}</div>
        <h2>${escapeHtml(outcome.title)}</h2>
        <p class="muted">בחרת: ${escapeHtml(outcome.optionLabel)}</p>

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
      </div>
    `;
  }

  // חלון טבלה מצומצם: הקבוצה שלנו ± 2 שורות, כדי שרואים את ההשפעה על
  // המיקום בלי להציג את כל 11 הקבוצות (שם הסיבה העיקרית לגלילה הארוכה).
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
      return `<div class="fitness-change-line"><span>${positionLabel(slot.position)} · ${escapeHtml(player.name_he)}</span><span class="${diff > 0 ? "income-amount" : "expense-amount"}">${diff > 0 ? "+" : ""}${diff} כושר</span></div>`;
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

export function renderSeasonEnd({ state, leagueId, teamId, summary, championTeamId, finalPosition, bankrupt }) {
  const league = getLeague(leagueId);
  const isChampion = championTeamId === teamId;
  return `
    <div class="screen">
      <div class="card center-col">
        <div class="trophy">${isChampion ? "🏆" : "🏁"}</div>
        <h1>סוף העונה - ${league.name_he}</h1>
        ${isChampion ? `<h2 style="color:var(--gold)">אלופים! 🎉</h2>` : `<p>סיימתם במקום ${finalPosition} מתוך 11</p>`}
        <p>האלופה: <b>${teamName(leagueId, championTeamId)}</b></p>
      </div>

      <div class="card">
        <h3>סיכום כלכלי</h3>
        <div class="finance-line"><span>פרס מיקום בטבלה</span><span class="income-amount">+${formatMoney(summary.prize)}</span></div>
        <div class="finance-line"><span>הכנסת חסות/שידור קבועה</span><span class="income-amount">+${formatMoney(summary.baseIncome || 0)}</span></div>
        <div class="finance-line"><span>שכר ששולם</span><span class="expense-amount">-${formatMoney(summary.salaries)}</span></div>
        ${summary.commitmentsApplied
          .map(
            (c) =>
              `<div class="finance-line"><span>${escapeHtml(c.description)}</span><span class="${c.isExpenseBucket ? "expense-amount" : "income-amount"}">${c.isExpenseBucket ? "-" : "+"}${formatMoney(Math.abs(c.amount))}</span></div>`
          )
          .join("")}
        <div class="finance-line"><span><b>יתרת תקציב לעונה הבאה</b></span><b>${formatMoney(state.budget)}</b></div>
        <p class="muted">שכר השחקנים עודכן באינפלציה של 2% לקראת העונה הבאה.</p>
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
