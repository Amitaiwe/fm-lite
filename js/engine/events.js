// מנוע האירועים המיוחדים: בחירת אירוע, בניית הקשר (שחקן/סכומים),
// והחלת ההשפעות (מיידיות או נדחות לסוף העונה).

import { EVENTS, getEventById } from "../data/events.js";
import { SETTINGS } from "../data/settings.js";
import { pickRandom } from "./rng.js";
import { findById } from "./playersRepo.js";
import { getSlotByPosition, replacePlayerInPosition, clampFitness, clampAbility } from "./squad.js";
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
    case "sponsorship_offer":
      ctx.amount = 2_500_000;
      break;
    case "end_of_season_salary_request":
      ctx.amount = 1_000_000;
      break;
    case "medical_treatment":
      ctx.cost = 500_000;
      break;
    case "equipment_upgrade":
      ctx.cost = 400_000;
      break;
    case "investment_matured":
      ctx.amount = 750_000;
      break;
    case "fan_fundraiser":
      ctx.amount = 300_000;
      break;
    case "disciplinary_fine":
      ctx.amount = 200_000;
      break;
    default:
      break;
  }
  return ctx;
}

function formatText(template, ctx) {
  return template
    .replaceAll("{playerName}", ctx.player ? ctx.player.name_he : "השחקן")
    .replaceAll("{amount}", fmt(ctx.amount))
    .replaceAll("{cost}", fmt(ctx.cost));
}

function applyEffect(state, allPlayers, eff, ctx, rng) {
  switch (eff.kind) {
    case "none":
      return state;

    case "budget": {
      const bucket = eff.amount < 0 ? "eventExpense" : "eventIncome";
      if (eff.timing === "immediate") {
        return ledgerBudgetChange(state, eff.amount, bucket, eff.amount < 0);
      }
      // end_of_season - נרשם כהתחייבות נדחית
      return addCommitment(state, {
        amount: eff.amount,
        description: "אירוע מיוחד",
        category: bucket,
        isExpenseBucket: eff.amount < 0,
      });
    }

    case "fitness": {
      const amount = eff.amount;
      let squad;
      if (eff.target === "all") {
        squad = state.squad.map((s) => ({ ...s, fitness: clampFitness(s.fitness + amount) }));
      } else {
        // event_player
        if (!ctx.slot) return state;
        squad = state.squad.map((s) =>
          s.playerId === ctx.slot.playerId ? { ...s, fitness: clampFitness(s.fitness + amount) } : s
        );
      }
      return { ...state, squad };
    }

    case "ability": {
      if (!ctx.slot) return state;
      const squad = state.squad.map((s) =>
        s.playerId === ctx.slot.playerId
          ? { ...s, currentAbility: clampAbility(s.currentAbility + eff.amount) }
          : s
      );
      return { ...state, squad };
    }

    case "salary_commitment": {
      if (!ctx.slot || eff.amountFormula !== "raiseAmount") return state;
      const squad = state.squad.map((s) =>
        s.playerId === ctx.slot.playerId ? { ...s, salary: s.salary + ctx.raiseAmount } : s
      );
      return { ...state, squad };
    }

    case "player_leave_chance": {
      if (!ctx.position) return state;
      if (rng() < eff.probability) {
        const newSquad = replacePlayerInPosition(state.squad, allPlayers, ctx.position, rng);
        return { ...state, squad: newSquad, lastDeparture: { position: ctx.position } };
      }
      return state;
    }

    default:
      return state;
  }
}

function applyEffects(state, allPlayers, effects, ctx, rng) {
  let s = state;
  for (const eff of effects) {
    s = applyEffect(s, allPlayers, eff, ctx, rng);
  }
  return s;
}

/**
 * מפעיל אירוע חדש: אם אוטומטי, מיישם את ההשפעות מיד ומחזיר לוג.
 * אם מבוסס-בחירה, שומר pendingEvent במצב וממתין לקריאה ל-resolveEventChoice.
 */
export function triggerEvent(state, allPlayers, rng) {
  const def = pickEventDefinition(rng, state.lastEventId);
  const ctx = buildEventContext(def, state, allPlayers, rng);
  const description = formatText(def.description_he, ctx);

  if (def.type === "automatic") {
    const newState = applyEffects(state, allPlayers, def.effects, ctx, rng);
    return {
      ...newState,
      lastEventId: def.id,
      eventLog: [...(state.eventLog || []), { id: def.id, title: def.title_he, description }],
    };
  }

  const pendingEvent = {
    eventId: def.id,
    title: def.title_he,
    description,
    options: def.options.map((o) => ({ id: o.id, label: formatText(o.label_he, ctx) })),
    ctx,
  };
  return { ...state, pendingEvent, lastEventId: def.id };
}

/** פותר אירוע מבוסס-בחירה לפי בחירת המשתמש. */
export function resolveEventChoice(state, allPlayers, optionId, rng) {
  if (!state.pendingEvent) return state;
  const def = getEventById(state.pendingEvent.eventId);
  const option = def.options.find((o) => o.id === optionId);
  if (!option) return state;

  const ctx = state.pendingEvent.ctx;
  let newState = applyEffects(state, allPlayers, option.effects, ctx, rng);
  newState = {
    ...newState,
    eventLog: [
      ...(state.eventLog || []),
      { id: def.id, title: def.title_he, description: state.pendingEvent.description, choice: option.id },
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
