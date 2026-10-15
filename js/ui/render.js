import { getLeague, getTeam, getLeagueList } from "../data/leagues.js";
import { findById } from "../engine/playersRepo.js";
import { calcNetPrice } from "../engine/transferMarket.js";
import { getSlotByPosition } from "../engine/squad.js";
import { totalSquadSalary } from "../engine/economy.js";
import { SETTINGS, POSITION_LABELS_HE } from "../data/settings.js";
import { formatMoney, positionLabel, escapeHtml } from "./format.js";

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

function fitnessArrowHtml(diff) {
  if (diff > 0) return `<span class="fit-arrow-up">▲</span>`;
  if (diff < 0) return `<span class="fit-arrow-down">▼</span>`;
  return "";
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

function squadGridHtml(state, allPlayers, fitnessDiffs) {
  return `
    <div class="squad-grid">
      ${state.squad
        .map((slot) => {
          const player = findById(allPlayers, slot.playerId);
          const diff = fitnessDiffs ? fitnessDiffs[slot.playerId] || 0 : 0;
          return `
          <div class="player-card">
            <div class="pos-label">${positionLabel(slot.position)}</div>
            <div class="p-name">${escapeHtml(player.name_he)}</div>
            <div class="stat-line"><span>יכולת</span><b>${slot.currentAbility}</b></div>
            <div class="stat-line"><span>כושר</span><b>${slot.fitness} ${fitnessArrowHtml(diff)}</b></div>
            <div class="fitness-bar-track"><div class="fitness-bar-fill" style="width:${slot.fitness}%"></div></div>
            <div class="stat-line" style="margin-top:6px"><span>שכר עונתי</span><b>${formatMoney(slot.salary)}</b></div>
          </div>`;
        })
        .join("")}
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
          <div class="team-name">${teamName(state.leagueId, state.teamId)}</div>
          <div class="league-name">${league.name_he}</div>
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
      ${squadGridHtml(state, allPlayers)}

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
                <td class="team-cell">${teamName(state.leagueId, r.teamId)}</td>
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
      <p>${state.transferWindow.atRound === 0 ? "חלון ההעברות הראשון של העונה" : "חלון ההעברות השני של העונה"} - 7 שחקנים זמינים. ניתן לבצע כמה רכישות שתרצה, כל עוד יש מספיק תקציב.</p>

      ${feedback ? `<div class="card-flat" style="margin-bottom:12px;border-color:${feedback.ok ? "var(--accent)" : "var(--red)"}">${escapeHtml(feedback.message)}</div>` : ""}

      <div class="col-stack">
        ${offers
          .map((p) => {
            const currentSlot = getSlotByPosition(state.squad, p.position);
            const currentPlayer = currentSlot ? findById(allPlayers, currentSlot.playerId) : null;
            const { netPrice } = calcNetPrice(state.squad, allPlayers, p);
            const alreadyOwned = currentSlot && currentSlot.playerId === p.id;
            const affordable = netPrice <= state.budget;
            return `
            <div class="transfer-card">
              <div class="row">
                <div>
                  <div class="pos-label">${positionLabel(p.position)}</div>
                  <div class="p-name">${escapeHtml(p.name_he)}</div>
                </div>
                <div style="text-align:left">
                  <div class="stat-line"><span>יכולת&nbsp;</span><b>${p.ability}</b></div>
                  <div class="stat-line"><span>שווי שוק&nbsp;</span><b>${formatMoney(p.market_value)}</b></div>
                </div>
              </div>
              <div class="divider"></div>
              <div class="row">
                <span class="muted">שחקן נוכחי בעמדה: ${currentPlayer ? escapeHtml(currentPlayer.name_he) + " (" + formatMoney(currentPlayer.market_value) + ")" : "-"}</span>
              </div>
              <div class="row" style="margin-top:8px">
                <span class="net-price ${netPrice === 0 ? "free" : ""}">מחיר נטו: ${formatMoney(netPrice)}</span>
                <button class="btn" style="width:auto" data-action="buy-player" data-player="${p.id}"
                  ${alreadyOwned || !affordable ? "disabled" : ""}>
                  ${alreadyOwned ? "כבר בסגל" : affordable ? "קנה" : "אין מספיק כסף"}
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
        <div class="teams">${teamName(state.leagueId, state.teamId)} נגד ${teamName(state.leagueId, oppTeam)}</div>
        <div class="score ${outcomeClass}">${myGoals} - ${oppGoals}</div>
      </div>
    `;
  }

  return `
    <div class="screen">
      <div class="card">${heroHtml}</div>
      <h2>טבלת ${league.name_he}</h2>
      <div class="card" style="overflow-x:auto">
        <table class="league-table">
          <thead>
            <tr><th>#</th><th>קבוצה</th><th>מש'</th><th>נק'</th></tr>
          </thead>
          <tbody>
            ${roundSummary.standings
              .map(
                (r, i) => `
              <tr class="${r.teamId === state.teamId ? "user-row" : ""}">
                <td>${i + 1}</td>
                <td class="team-cell">${teamName(state.leagueId, r.teamId)}</td>
                <td>${r.played}</td>
                <td><b>${r.points}</b></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <h2>מצב הסגל</h2>
      ${squadGridHtml(state, allPlayers, fitnessDiffs)}

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
