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
import { pickRandom } from "./rng.js";
import { findById } from "./playersRepo.js";
import { getSlotByPosition, clampFitness, clampAbility } from "./squad.js";
import { ledgerBudgetChange, addCommitment } from "./economy.js";

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

function formatText(template, ctx) {
  return template
    .replaceAll("{playerName}", ctx.player ? ctx.player.name_he : "השחקן")
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

/** מחלץ מידע הימור (אם יש) מתוך רצף effects, לתצוגת אחוזים לפני הבחירה. */
function extractGamble(effects, ctx) {
  const randEff = (effects || []).find((e) => e.kind === "random_outcome");
  if (!randEff) return null;
  return {
    branches: randEff.branches.map((b) => ({
      probability: b.probability,
      label: b.label_he,
      lines: describeEffects(b.effects, ctx),
      tone: branchTone(b.effects, ctx),
    })),
  };
}

/**
 * מפעיל אירוע חדש: תמיד מבוסס-בחירה. בונה pendingEvent עם options
 * שכל אחת מהן נושאת summaryLines (השלכות ודאיות) ו-gamble (אם יש
 * הימור באופציה הזו) - כך שהמשתמש רואה הכל *לפני* שהוא בוחר.
 */
export function triggerEvent(state, allPlayers, rng) {
  const def = pickEventDefinition(rng, state.lastEventId);
  const ctx = buildEventContext(def, state, allPlayers, rng);
  const description = formatText(def.description_he, ctx);

  const pendingEvent = {
    eventId: def.id,
    title: def.title_he ? formatText(def.title_he, ctx) : description,
    description,
    options: def.options.map((o) => ({
      id: o.id,
      label: formatText(o.label_he, ctx),
      summaryLines: describeEffects(o.effects, ctx),
      gamble: extractGamble(o.effects, ctx),
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
  const option = def.options.find((o) => o.id === optionId);
  if (!option) return state;

  const ctx = state.pendingEvent.ctx;
  const { state: appliedState, notes, randomOutcome } = applyEffects(state, allPlayers, option.effects, ctx, rng);

  const lastEventOutcome = {
    eventId: def.id,
    title: state.pendingEvent.title,
    description: state.pendingEvent.description,
    optionId: option.id,
    optionLabel: state.pendingEvent.options.find((o) => o.id === optionId)?.label || optionId,
    gamble: state.pendingEvent.options.find((o) => o.id === optionId)?.gamble || null,
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
