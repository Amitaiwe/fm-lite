// המערכת הכלכלית: רישום הכנסות/הוצאות עונתיות, שכר, פרסים, בונוסים/
// קנסות, התחייבויות נדחות, ובדיקת פשיטת רגל.

import { SETTINGS } from "../data/settings.js";

/** מחזיר אובייקט כספים ריק לעונה חדשה. */
export function emptySeasonFinance() {
  return {
    income: { matchBonuses: 0, sponsorships: 0, eventIncome: 0, prizes: 0 },
    expenses: { matchPenalties: 0, salaries: 0, eventExpense: 0, transfersNet: 0 },
  };
}

function round(n) {
  return Math.round(n);
}

/** מוסיף/מפחית תקציב ורושם בקטגוריית ההכנסה/הוצאה המתאימה. */
export function ledgerBudgetChange(state, amount, category, isExpenseBucket) {
  const newBudget = state.budget + amount;
  const finance = structuredClone(state.finance);
  if (isExpenseBucket) {
    finance.expenses[category] = (finance.expenses[category] || 0) + Math.abs(amount);
  } else {
    finance.income[category] = (finance.income[category] || 0) + Math.abs(amount);
  }
  return { ...state, budget: newBudget, finance };
}

/** מחיל בונוס/קנס על תוצאת המשחק של קבוצת השחקן (מיד לאחר כל משחק). */
export function applyMatchBonusPenalty(state, outcome) {
  // outcome: "win" | "draw" | "loss"
  if (outcome === "win") {
    return ledgerBudgetChange(state, SETTINGS.BONUS_WIN, "matchBonuses", false);
  }
  if (outcome === "draw") {
    return ledgerBudgetChange(state, SETTINGS.BONUS_DRAW, "matchBonuses", false);
  }
  return ledgerBudgetChange(state, -SETTINGS.PENALTY_LOSS, "matchPenalties", true);
}

/** בודק האם פעולה יזומה (רכישה, תשלום באירוע) מותרת מבחינת תקציב. */
export function canAfford(state, cost) {
  return cost <= state.budget;
}

/** מוסיף התחייבות כספית עתידית (תשולם/תתקבל בסוף העונה). */
export function addCommitment(state, { amount, description, category, isExpenseBucket }) {
  const commitments = state.commitments.slice();
  commitments.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount,
    description,
    category,
    isExpenseBucket,
    season: state.season,
  });
  return { ...state, commitments };
}

/** מחשב סכום שכר עונתי כולל של כל שחקני הסגל. */
export function totalSquadSalary(squad) {
  return squad.reduce((sum, s) => sum + s.salary, 0);
}

/**
 * מעבד את שלב הכלכלה בסוף העונה, לפי הסדר מהמסמך:
 * פרסים -> התחייבויות נדחות -> שכר -> אינפלציה (על שכר עתידי) -> בדיקת פשיטת רגל.
 * מחזיר { state, summary, bankrupt }.
 */
export function processSeasonEndEconomy(state, finalPosition) {
  let s = { ...state };
  const summary = { prize: 0, commitmentsApplied: [], salaries: 0, inflationApplied: 0 };

  // 1. פרס מיקום בטבלה
  const prize = SETTINGS.SEASON_PRIZES[finalPosition] || 0;
  if (prize > 0) {
    s = ledgerBudgetChange(s, prize, "prizes", false);
    summary.prize = prize;
  }

  // 2. התחייבויות נדחות שנצברו העונה (חסויות, בקשות שכר שהתקבלו וכו')
  const thisSeasonCommitments = s.commitments.filter((c) => c.season === state.season);
  for (const c of thisSeasonCommitments) {
    s = ledgerBudgetChange(s, c.amount, c.category, c.isExpenseBucket);
    summary.commitmentsApplied.push(c);
  }
  s = { ...s, commitments: s.commitments.filter((c) => c.season !== state.season) };

  // 3. תשלום שכר עונתי (פעם אחת בלבד)
  const salaryTotal = totalSquadSalary(s.squad);
  if (salaryTotal > 0) {
    s = ledgerBudgetChange(s, -salaryTotal, "salaries", true);
    summary.salaries = salaryTotal;
  }

  // 4. אינפלציה - מעלה את השכר העתידי של כל שחקני הסגל ב-2%, מעוגל ל-10,000 הקרובים
  const newSquad = s.squad.map((slot) => {
    const raised = slot.salary * (1 + SETTINGS.SALARY_INFLATION_RATE);
    const rounded = Math.round(raised / SETTINGS.SALARY_ROUNDING) * SETTINGS.SALARY_ROUNDING;
    return { ...slot, salary: rounded };
  });
  summary.inflationApplied = SETTINGS.SALARY_INFLATION_RATE;
  s = { ...s, squad: newSquad };

  // 5. בדיקת פשיטת רגל - יתרה אפס או שלילית לאחר חיובים אוטומטיים
  const bankrupt = s.budget <= 0;

  return { state: s, summary, bankrupt };
}
