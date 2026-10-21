// מנוע האירועים המיוחדים: בחירת אירוע, בניית הקשר (שחקן/סכומים),
// והחלת ההשפעות (מיידיות או נדחות לסוף העונה).
//
// כל אירוע הוא מבוסס-בחירה. לכל אופציה יש effects[] שעשויים לכלול
// גם "random_outcome" - הימור עם כמה תוצאות אפשריות, שכל אחת עם
// probability (אחוז סיכוי אמיתי שמוצג למשתמש) ו-effects משלה.
// ה-UI (js/ui/render.js) מציג את "summaryLines" ו-"gamble" של כל
// אופציה *לפני* שהמשתמש בוחר, כדי שתמיד יהיה ברור מה כל בחירה נותנת
// או עולה. אחרי הבחירה, state.lastEventOutcome מכיל את תוצאת ההימור
// בפועל (אם הייתה אחת) כדי שה-UI יוכל להציג אנימציית חשיפה.

import { EVENTS, getEventById } from "../data/events.js";
import { SETTINGS, POSITION_LABELS_HE } from "../data/settings.js";
import { pickRandom, randInt } from "./rng.js";
import { findById } from "./playersRepo.js";
import { getSlotByPosition, clampFitness, clampAbility } from "./squad.js";
import { ledgerBudgetChange, addCommitment } from "./economy.js";

// --- הגרלת טווחים סביב המספרים הקבועים שמוגדרים באירועים (events.js) ---
//
// כל מספר "קבוע" באירוע (סכום כסף / שינוי יכולת / שינוי כושר) מוגרל
// פעם אחת, מחדש בכל אירוע, לטווח קטן סביב הערך המקורי שבקובץ הנתונים:
//  - יכולת/כושר: ±2 (בקפיצות של 1)
//  - כסף: ±500,000€ (בקפיצות של 250,000€)
// בשני המקרים הטווח "נדחס" כך שלעולם לא יחצה אפס ולא יהפוך סימן (למשל
// עלות של -200,000€ לעולם לא תצא כרווח) - מרחק מינימלי מאפס הוא קפיצה
// אחת (1 ליכולת/כושר, 250,000€ לכסף), בדיוק כמו ש"+1" הוא המינימום
// לשינויי יכולת/כושר קטנים.
//
// ההגרלה מתבצעת פעם אחת בלבד לכל אירוע (ב-triggerEvent), והתוצאה
// המוגרלת היא מה שמוצג למשתמש *לפני* הבחירה ומה שבאמת מוחל אם יבחר
// באופציה הזו - אין הגרלה חוזרת בזמן הבחירה עצמה.
const MONEY_STEP = 250_000;
const DELTA_STEP = 1;

function clampSameSign(value, base, step) {
  if (base > 0) return Math.max(step, value);
  if (base < 0) return Math.min(-step, value);
  return value;
}

function randomizeAroundBase(rng, base, step) {
  if (typeof base !== "number") return base;
  const k = randInt(rng, -2, 2);
  const raw = base + k * step;
  return clampSameSign(raw, base, step);
}

/** מגריל (פעם אחת) effect בודד אם מדובר במספר קבוע בר-הגרלה; משכפל אחרת. */
function randomizeEffect(eff, rng) {
  if (eff.kind === "budget" && !eff.amountFormula && typeof eff.amount === "number") {
    return { ...eff, amount: randomizeAroundBase(rng, eff.amount, MONEY_STEP) };
  }
  if (eff.kind === "salary_commitment" && !eff.amountFormula && typeof eff.amount === "number") {
    return { ...eff, amount: randomizeAroundBase(rng, eff.amount, MONEY_STEP) };
  }
  if ((eff.kind === "ability" || eff.kind === "fitness") && typeof eff.amount === "number") {
    return { ...eff, amount: randomizeAroundBase(rng, eff.amount, DELTA_STEP) };
  }
  if (eff.kind === "random_outcome") {
    const branches = (eff.branches || []).map((b) => ({ ...b, effects: resolveEffectsRandomization(b.effects, rng) }));
    return { ...eff, branches: keepBranchOrder(eff.branches || [], branches) };
  }
  return { ...eff };
}

// כל branch מוגרל בנפרד, ולכן התוצאה ה"רעה" יכלה לצאת גבוהה מה"טובה"
// (למשל +600,000 מול +400,000). כאן משמרים את הסדר המקורי של הנתונים:
// הערכים המוגרלים ממוינים ומוצמדים מחדש לפי הדירוג המקורי, ובמקרה של
// שוויון מוסיפים קפיצה אחת כך שהתוצאה הטובה תמיד גבוהה ממש מהחלשה.
function keepBranchOrder(origBranches, newBranches) {
  const single = (b) =>
    b.effects && b.effects.length === 1 && b.effects[0].kind === "budget" && typeof b.effects[0].amount === "number";
  if (newBranches.length < 2 || !origBranches.every(single) || !newBranches.every(single)) return newBranches;
  const order = origBranches.map((b, i) => i).sort((a, b) => origBranches[a].effects[0].amount - origBranches[b].effects[0].amount);
  const values = newBranches.map((b) => b.effects[0].amount).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) values[i] = values[i - 1] + MONEY_STEP;
  }
  const out = newBranches.map((b) => ({ ...b, effects: [{ ...b.effects[0] }] }));
  order.forEach((idx, rank) => {
    out[idx].effects[0].amount = values[rank];
  });
  return out;
}

/** מגריל (פעם אחת) רצף effects שלם - כולל branches מקוננים של random_outcome. */
function resolveEffectsRandomization(effects, rng) {
  return (effects || []).map((e) => randomizeEffect(e, rng));
}

function pickEventDefinition(rng, lastEventId) {
  const pool = lastEventId ? EVENTS.filter((e) => e.id !== lastEventId) : EVENTS;
  return pickRandom(rng, pool.length ? pool : EVENTS);
}

function resolveTargetPosition(eventDef, rng) {
  if (!eventDef.targetPosition) return null;
  if (eventDef.targetPosition === "random") {
    return pickRandom(rng, SETTINGS.SQUAD_POSITIONS);
  }
  return eventDef.targetPosition;
}

function fmt(n) {
  return n != null ? n.toLocaleString("he-IL") : "";
}

function fmtSigned(n) {
  if (n == null) return "";
  return (n > 0 ? "+" : "") + fmt(n);
}

function buildEventContext(eventDef, state, allPlayers, rng) {
  const position = resolveTargetPosition(eventDef, rng);
  let slot = null;
  let player = null;
  if (position) {
    slot = getSlotByPosition(state.squad, position);
    player = slot ? findById(allPlayers, slot.playerId) : null;
  }

  const ctx = { position, player, slot, amount: null, cost: null, raiseAmount: null };

  switch (eventDef.id) {
    case "salary_raise_request": {
      const base = slot ? slot.salary : SETTINGS.SALARY_BASE;
      const pct = 0.1 + rng() * 0.1; // 10%-20%
      ctx.raiseAmount = Math.max(10_000, Math.round((base * pct) / 10_000) * 10_000);
      ctx.amount = ctx.raiseAmount;
      break;
    }
    case "medical_treatment":
      ctx.cost = 500_000;
      break;
    default:
      break;
  }
  return ctx;
}

function formatText(template, ctx, lang = "he") {
  // lang שולט רק בשם השחקן שמושתל בטקסט: "he" משתמש ב-name_he ו-"en"
  // ב-name_en (עם נפילה חזרה לעברית אם חסר). שאר המשפט נשאר בעברית -
  // ממשק המשחק עצמו עברי, רק שמות השחקנים מתחלפים.
  const playerName = ctx.player
    ? lang === "en" && ctx.player.name_en
      ? ctx.player.name_en
      : ctx.player.name_he
    : lang === "en"
      ? "the player"
      : "השחקן";
  return template
    .replaceAll("{playerName}", playerName)
    .replaceAll("{positionLabel}", ctx.position ? POSITION_LABELS_HE[ctx.position] || ctx.position : "")
    .replaceAll("{amount}", fmt(ctx.amount))
    .replaceAll("{cost}", fmt(ctx.cost));
}

/** מחזיר את סכום ה-budget effect, כולל תמיכה ב-amountFormula+sign (לדוגמה raiseAmount). */
function resolveBudgetAmount(eff, ctx) {
  if (eff.amountFormula === "raiseAmount") {
    return ctx.raiseAmount * (eff.sign || 1);
  }
  return eff.amount;
}

/**
 * מחיל effect בודד. מחזיר { state, note, branchHit, subNotes } -
 * note הוא תיאור טקסטואלי קצר למה שקרה בפועל (ל-eventLog/outcome),
 * branchHit (רק עבור random_outcome) הוא ה-branch שנבחר בפועל בהגרלה.
 */
function applyEffect(state, allPlayers, eff, ctx, rng) {
  switch (eff.kind) {
    case "none":
      return { state, note: null };

    case "budget": {
      const amount = resolveBudgetAmount(eff, ctx);
      const bucket = amount < 0 ? "eventExpense" : "eventIncome";
      const note = `${fmtSigned(amount)}€${eff.timing === "end_of_season" ? " (בסוף העונה)" : " (מיידי)"}`;
      if (eff.timing === "immediate") {
        return { state: ledgerBudgetChange(state, amount, bucket, amount < 0), note };
      }
      return {
        state: addCommitment(state, {
          amount,
          description: "אירוע מיוחד",
          category: bucket,
          isExpenseBucket: amount < 0,
        }),
        note,
      };
    }

    case "fitness": {
      const amount = eff.amount;
      const note = `כושר ${eff.target === "all" ? "כל הסגל" : "השחקן"} ${fmtSigned(amount)}`;
      let squad;
      if (eff.target === "all") {
        squad = state.squad.map((s) => {
          const newFitness = clampFitness(s.fitness + amount);
          return { ...s, fitness: newFitness, lastFitnessDelta: newFitness - s.fitness };
        });
      } else {
        if (!ctx.slot) return { state, note: null };
        squad = state.squad.map((s) => {
          if (s.playerId !== ctx.slot.playerId) return s;
          const newFitness = clampFitness(s.fitness + amount);
          return { ...s, fitness: newFitness, lastFitnessDelta: newFitness - s.fitness };
        });
      }
      return { state: { ...state, squad }, note };
    }

    case "ability": {
      if (!ctx.slot) return { state, note: null };
      const squad = state.squad.map((s) => {
        if (s.playerId !== ctx.slot.playerId) return s;
        const newAbility = clampAbility(s.currentAbility + eff.amount);
        return { ...s, currentAbility: newAbility, lastAbilityDelta: newAbility - s.currentAbility };
      });
      return { state: { ...state, squad }, note: `יכולת השחקן ${fmtSigned(eff.amount)}` };
    }

    case "salary_commitment": {
      if (!ctx.slot) return { state, note: null };
      const raise = eff.amountFormula === "raiseAmount" ? ctx.raiseAmount : eff.amount || 0;
      const squad = state.squad.map((s) =>
        s.playerId === ctx.slot.playerId ? { ...s, salary: s.salary + raise } : s
      );
      return { state: { ...state, squad }, note: `שכר השחקן ${fmtSigned(raise)}€ לעונה` };
    }

    case "random_outcome": {
      const r = rng();
      let cumulative = 0;
      let chosen = eff.branches[eff.branches.length - 1];
      for (const b of eff.branches) {
        cumulative += b.probability;
        if (r < cumulative) {
          chosen = b;
          break;
        }
      }
      const sub = applyEffects(state, allPlayers, chosen.effects, ctx, rng);
      return {
        state: sub.state,
        note: chosen.label_he,
        branchHit: {
          label: chosen.label_he,
          probability: chosen.probability,
          tone: branchTone(chosen.effects, ctx),
        },
        subNotes: sub.notes,
      };
    }

    default:
      return { state, note: null };
  }
}

/** מחיל רצף effects. מחזיר { state, notes, randomOutcome }. */
function applyEffects(state, allPlayers, effects, ctx, rng) {
  let s = state;
  const notes = [];
  let randomOutcome = null;
  for (const eff of effects || []) {
    const result = applyEffect(s, allPlayers, eff, ctx, rng);
    s = result.state;
    if (result.note) notes.push(result.note);
    if (result.branchHit) {
      randomOutcome = {
        label: result.branchHit.label,
        probability: result.branchHit.probability,
        tone: result.branchHit.tone,
        subNotes: result.subNotes || [],
      };
    }
  }
  return { state: s, notes, randomOutcome };
}

/** מתאר effect בודד כטקסט "לפני בחירה", לתצוגה ב-UI (בלי להגריל כלום). */
function describeEffect(eff, ctx) {
  switch (eff.kind) {
    case "budget": {
      const amount = resolveBudgetAmount(eff, ctx);
      return `${fmtSigned(amount)}€${eff.timing === "end_of_season" ? " (בסוף העונה)" : ""}`;
    }
    case "fitness":
      return `כושר ${eff.target === "all" ? "כל הסגל" : "השחקן"} ${fmtSigned(eff.amount)}`;
    case "ability":
      return `יכולת השחקן ${fmtSigned(eff.amount)}`;
    case "salary_commitment": {
      const raise = eff.amountFormula === "raiseAmount" ? ctx.raiseAmount : eff.amount || 0;
      return `שכר השחקן ${fmtSigned(raise)}€ לעונה`;
    }
    case "none":
      return null;
    default:
      return null;
  }
}

/** מתאר רצף effects כמערך שורות קריאות (מדלג על random_outcome - מתואר בנפרד). */
function describeEffects(effects, ctx) {
  return (effects || [])
    .filter((e) => e.kind !== "random_outcome")
    .map((e) => describeEffect(e, ctx))
    .filter(Boolean);
}

/** מסווג branch כ"positive"/"negative"/"mixed"/"neutral" לפי effects שלו, לצביעת מד האחוזים. */
function branchTone(effects, ctx) {
  let hasNeg = false;
  let hasPos = false;
  for (const e of effects || []) {
    if (e.kind === "none") continue;
    const amt = e.kind === "budget" ? resolveBudgetAmount(e, ctx) : e.amount;
    if (amt < 0) hasNeg = true;
    else if (amt > 0) hasPos = true;
  }
  if (hasNeg && hasPos) return "mixed";
  if (hasNeg) return "negative";
  if (hasPos) return "positive";
  return "neutral";
}

/**
 * מסכם את הערכים המספריים של רצף effects לפי סוג (כסף / יכולת / כושר).
 * משמש לחישוב הטון של תוצאות הימור (ראו gambleBranchTone).
 */
function sumEffectsByKind(effects, ctx) {
  const sums = { money: 0, ability: 0, fitness: 0, hasMoney: false, hasAbility: false, hasFitness: false };
  for (const e of effects || []) {
    if (e.kind === "budget") {
      sums.money += resolveBudgetAmount(e, ctx) || 0;
      sums.hasMoney = true;
    } else if (e.kind === "ability" && typeof e.amount === "number") {
      sums.ability += e.amount;
      sums.hasAbility = true;
    } else if (e.kind === "fitness" && typeof e.amount === "number") {
      sums.fitness += e.amount;
      sums.hasFitness = true;
    }
  }
  return sums;
}

/**
 * מסווג תוצאת הימור (branch) לצביעת מד האחוזים/הגלגל/המקרא:
 *  - לכל סוג משאב שהתוצאה נוגעת בו (כסף/יכולת/כושר) נבדק הסכום הנטו
 *    *מאותו סוג* - כולל ההשפעות הקבועות של האופציה. כך תוצאה שהיא
 *    הפסד כספי נטו (למשל עלות 200,000€ מול רווח אפשרי של 100,000€)
 *    תצבע אדום ולא ירוק רק כי הרווח עצמו חיובי.
 *  - סוג שהתוצאה לא נוגעת בו בכלל (למשל עלות כספית קבועה לצד הימור על
 *    יכולת) לא משפיע על הצבע - העלות כבר מוצגת כטקסט מעל מד האחוזים.
 * סימן מעורב בין סוגים שונים (למשל עלות כספית + עליית יכולת באותה
 * תוצאה) מסווג "mixed" (זהב).
 */
function gambleBranchTone(sureEffects, branchEffects, ctx) {
  const sure = sumEffectsByKind(sureEffects, ctx);
  const br = sumEffectsByKind(branchEffects, ctx);
  let hasNeg = false;
  let hasPos = false;
  for (const [sum, has] of [
    [sure.money + br.money, br.hasMoney],
    [sure.ability + br.ability, br.hasAbility],
    [sure.fitness + br.fitness, br.hasFitness],
  ]) {
    if (!has) continue;
    if (sum < 0) hasNeg = true;
    else if (sum > 0) hasPos = true;
  }
  if (hasNeg && hasPos) return "mixed";
  if (hasNeg) return "negative";
  if (hasPos) return "positive";
  return "neutral";
}

/**
 * אם כל התוצאות של אותו הימור יצאו באותו טון (למשל שתי תוצאות "ירוקות"
 * כי שתיהן רווח - אחת גדולה ואחת קטנה), מבדילים ביניהן כדי שהצבע ישקף
 * גם את הטיב *היחסי* בתוך ההימור ולא רק את הסימן המוחלט:
 *  - כולן חיוביות: הטובה ביותר נשארת ירוקה, האחרות הופכות ניטרליות (זהב).
 *  - כולן שליליות: הגרועה ביותר נשארת אדומה, האחרות הופכות ניטרליות.
 *  - כולן מעורבות: הטובה ביותר הופכת ירוקה והגרועה ביותר אדומה.
 * הדירוג לפי סכום ה-effects של ה-branch עצמו (העלות הקבועה של האופציה
 * זהה לכל התוצאות ולכן לא משנה את הדירוג); בשוויון מלא מדרגים לפי סדר
 * התוצאות בנתונים (הטובה מופיעה ראשונה).
 */
function differentiateTiedTones(branches, ctx) {
  if (branches.length < 2) return;
  const tone = branches[0].tone;
  if (tone === "neutral" || !branches.every((b) => b.tone === tone)) return;
  const scores = branches.map((b) => {
    const s = sumEffectsByKind(b.rawEffects, ctx);
    return s.hasMoney ? s.money : s.hasAbility ? s.ability : s.fitness;
  });
  // שוויון מוחלט בערכים (למשל הגרלת טווחים שהשוותה שתי תוצאות): מדרגים
  // לפי הסדר בנתונים - בכל ההימורים התוצאה הטובה מופיעה ראשונה.
  const order = branches.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  const best = order[0];
  const worst = order[order.length - 1];
  branches.forEach((b, i) => {
    if (tone === "positive" && i !== best) b.tone = "neutral";
    else if (tone === "negative" && i !== worst) b.tone = "neutral";
    else if (tone === "mixed") {
      if (i === best) b.tone = "positive";
      else if (i === worst) b.tone = "negative";
    }
  });
}

/** מחלץ מידע הימור (אם יש) מתוך רצף effects, לתצוגת אחוזים לפני הבחירה. */
function extractGamble(effects, ctx) {
  const randEff = (effects || []).find((e) => e.kind === "random_outcome");
  if (!randEff) return null;
  const sureEffects = (effects || []).filter((e) => e.kind !== "random_outcome");
  const branches = randEff.branches.map((b) => ({
    probability: b.probability,
    label: b.label_he,
    lines: describeEffects(b.effects, ctx),
    tone: gambleBranchTone(sureEffects, b.effects, ctx),
    rawEffects: b.effects,
  }));
  differentiateTiedTones(branches, ctx);
  return { branches: branches.map(({ rawEffects, ...rest }) => rest) };
}

/**
 * מפעיל אירוע חדש: תמיד מבוסס-בחירה. בונה pendingEvent עם options
 * שכל אחת מהן נושאת summaryLines (השלכות ודאיות) ו-gamble (אם יש
 * הימור באופציה הזו) - כך שהמשתמש רואה הכל *לפני* שהוא בוחר.
 */
export function triggerEvent(state, allPlayers, rng) {
  const def = pickEventDefinition(rng, state.lastEventId);
  const ctx = buildEventContext(def, state, allPlayers, rng);

  // מגרילים טווח אקראי פעם אחת לכל מספר קבוע (תקציב/יכולת/כושר) בכל
  // האופציות של האירוע הזה - אותה הגרלה מוצגת למשתמש *לפני* הבחירה
  // ומוחלת בפועל אם הוא יבחר באופציה הזו (ראו resolveEffectsRandomization).
  const resolvedOptionEffects = def.options.map((o) => resolveEffectsRandomization(o.effects, rng));

  // סנכרון {cost} של "טיפול רפואי" עם הסכום שהוגרל בפועל לאופציית "pay",
  // כדי שהטקסט המוצג (description + label) יתאים למה שבאמת יוחל.
  if (def.id === "medical_treatment") {
    const payIdx = def.options.findIndex((o) => o.id === "pay");
    if (payIdx !== -1) {
      const budgetEff = resolvedOptionEffects[payIdx].find((e) => e.kind === "budget");
      if (budgetEff) ctx.cost = Math.abs(budgetEff.amount);
    }
  }

  // מכינים שתי גרסאות מוכנות של הטקסטים (עברית/אנגלית) כבר כאן, כי
  // הטקסט "נאפה" פעם אחת עם שם השחקן בתוכו ונשמר ב-state - כך ה-UI
  // יכול להחליף שפה גם באמצע אירוע בלי לפרמט מחדש.
  const description = formatText(def.description_he, ctx, "he");
  const descriptionEn = formatText(def.description_he, ctx, "en");

  const pendingEvent = {
    eventId: def.id,
    title: def.title_he ? formatText(def.title_he, ctx, "he") : description,
    titleEn: def.title_he ? formatText(def.title_he, ctx, "en") : descriptionEn,
    description,
    descriptionEn,
    options: def.options.map((o, i) => ({
      id: o.id,
      label: formatText(o.label_he, ctx, "he"),
      labelEn: formatText(o.label_he, ctx, "en"),
      summaryLines: describeEffects(resolvedOptionEffects[i], ctx),
      gamble: extractGamble(resolvedOptionEffects[i], ctx),
      effects: resolvedOptionEffects[i],
    })),
    ctx,
  };
  return { ...state, pendingEvent, lastEventId: def.id };
}

/**
 * פותר אירוע מבוסס-בחירה לפי בחירת המשתמש. מחזיר את ה-state החדש,
 * עם state.lastEventOutcome מכיל את תוצאת ההכרעה (כולל תוצאת הימור
 * בפועל אם הייתה) לשימוש ה-UI להצגת אנימציית חשיפה.
 */
export function resolveEventChoice(state, allPlayers, optionId, rng) {
  if (!state.pendingEvent) return state;
  const def = getEventById(state.pendingEvent.eventId);
  // משתמשים בהשפעות שכבר הוגרלו ב-triggerEvent (state.pendingEvent.options),
  // לא בהגדרה הסטטית מ-def - כדי שמה שמוחל יהיה בדיוק מה שהוצג למשתמש.
  const option = state.pendingEvent.options.find((o) => o.id === optionId);
  if (!option) return state;

  const ctx = state.pendingEvent.ctx;
  const { state: appliedState, notes, randomOutcome } = applyEffects(state, allPlayers, option.effects, ctx, rng);

  // מסנכרנים את טון התוצאה שהוגרלה בפועל עם הטון שחושב ל-gamble (נטו
  // כולל עלות האופציה + הבחנה יחסית בין תוצאות באותו טון), כדי שצבע
  // שורת התוצאה יתאים לצבע הפלח בגלגל ובמקרא.
  if (randomOutcome && option.gamble) {
    const hit = option.gamble.branches.find((b) => b.label === randomOutcome.label);
    if (hit) randomOutcome.tone = hit.tone;
  }

  const lastEventOutcome = {
    eventId: def.id,
    title: state.pendingEvent.title,
    titleEn: state.pendingEvent.titleEn,
    description: state.pendingEvent.description,
    descriptionEn: state.pendingEvent.descriptionEn,
    optionId: option.id,
    optionLabel: option.label,
    optionLabelEn: option.labelEn,
    gamble: option.gamble,
    notes,
    randomOutcome,
  };

  let newState = {
    ...appliedState,
    lastEventOutcome,
    eventLog: [
      ...(state.eventLog || []),
      { id: def.id, title: state.pendingEvent.title, description: state.pendingEvent.description, choice: option.id },
    ],
  };
  const { pendingEvent, ...rest } = newState;
  return rest;
}

/** האם צריך להציג אירוע אחרי מספר מחזורים שהושלמו בעונה הנוכחית. */
export function shouldTriggerEvent(roundsCompletedThisSeason) {
  return (
    roundsCompletedThisSeason > 0 &&
    roundsCompletedThisSeason % SETTINGS.EVENT_EVERY_N_ROUNDS === 0
  );
}
