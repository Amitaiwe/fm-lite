// ניהול הסגל: טיוטת סגל התחלתי, חישוב שכר, החלפת שחקן, רענון כושר עונתי.

import { SETTINGS } from "../data/settings.js";
import { byPosition, excludeIds, findById } from "./playersRepo.js";
import { randInt, pickRandom } from "./rng.js";

/** מחשב שכר עונתי התחלתי לפי יכולת, לפי הנוסחה המרכזית. */
export function calcSalary(ability) {
  return SETTINGS.SALARY_BASE + ability * SETTINGS.SALARY_PER_ABILITY_POINT;
}

/** מגריל כושר התחלתי בטווח המוגדר. */
export function randomFitness(rng) {
  return randInt(rng, SETTINGS.FITNESS_MIN, SETTINGS.FITNESS_MAX);
}

/** בונה שורת סגל חדשה משחקן מהמאגר. */
export function buildSquadSlot(playerRecord, rng) {
  return {
    playerId: playerRecord.id,
    position: playerRecord.position,
    currentAbility: playerRecord.ability,
    fitness: randomFitness(rng),
    salary: calcSalary(playerRecord.ability),
  };
}

/**
 * מגריל סגל התחלתי: שחקן אחד אקראי מכל עמדה מתוך מאגר 250 השחקנים,
 * ללא כפילויות (ממילא לא אפשרי כי הגרלה מכל עמדה בנפרד).
 */
export function draftInitialSquad(allPlayers, rng) {
  const squad = [];
  for (const position of SETTINGS.SQUAD_POSITIONS) {
    const candidates = byPosition(allPlayers, position);
    const chosen = pickRandom(rng, candidates);
    squad.push(buildSquadSlot(chosen, rng));
  }
  return squad;
}

/**
 * בוחר, לכל עמדה, זוג שחקנים (רשומות מאגר, לא slot) עם הפרש יכולת
 * מינימלי - עד נקודה אחת כשאפשר - כדי שהבחירה בין השניים תהיה אמיתית
 * (שניהם ברמה דומה) ולא "מובנת מאליה". ממוין לפי יכולת, ואז נבחר זוג
 * שכנים אקראי מתוך כל הזוגות עם הפרש <= 1; אם אין כזה (לא אמור לקרות
 * במאגר של 250 שחקנים), נופלים חזרה לזוג עם ההפרש הקטן ביותר שקיים.
 * משמש למסך "בחירת סגל" בתחילת משחק חדש בלבד (לא בתחילת כל עונה).
 */
export function draftCandidatePairs(allPlayers, rng) {
  const result = {};
  for (const position of SETTINGS.SQUAD_POSITIONS) {
    const pool = byPosition(allPlayers, position)
      .slice()
      .sort((a, b) => a.ability - b.ability);

    const closePairs = [];
    for (let i = 0; i < pool.length - 1; i++) {
      if (Math.abs(pool[i + 1].ability - pool[i].ability) <= 1) {
        closePairs.push([pool[i], pool[i + 1]]);
      }
    }

    let pair;
    if (closePairs.length > 0) {
      pair = pickRandom(rng, closePairs);
    } else {
      let best = null;
      let bestDiff = Infinity;
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const diff = Math.abs(pool[i].ability - pool[j].ability);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = [pool[i], pool[j]];
          }
        }
      }
      pair = best;
    }

    // מערבבים מי מוצג ראשון/שני, כדי שהצד הימני לא יהיה תמיד החזק יותר
    result[position] = rng() < 0.5 ? [pair[1], pair[0]] : pair;
  }
  return result;
}

/** בונה סגל מתוך בחירות מפורשות של המשתמש (מזהה שחקן לכל עמדה), ממסך בחירת הסגל. */
export function buildSquadFromChoices(allPlayers, rng, chosenPlayerIds) {
  return SETTINGS.SQUAD_POSITIONS.map((position) => {
    const playerId = chosenPlayerIds[position];
    const record = findById(allPlayers, playerId);
    return buildSquadSlot(record, rng);
  });
}

/** מרענן את הכושר של כל שחקני הסגל בתחילת עונה חדשה (הגרלה מלאה מאפס). */
export function refreshSquadFitness(squad, rng) {
  return squad.map((slot) => ({ ...slot, fitness: randomFitness(rng), lastFitnessDelta: null }));
}

/**
 * מחיל שינוי כושר אקראי "פרה-עונה" (±SEASON_FITNESS_SWING) על הכושר
 * *הקיים* של כל שחקן (לא הגרלה מאפס) - כדי שהמעבר בין סוף עונה לתחילת
 * הבאה יהיה הגיוני (למשל 99 בסוף עונה -> סביב 89-99 בתחילת הבאה, לא
 * קפיצה אקראית לגמרי כמו 61).
 */
export function applySeasonFitnessSwing(squad, rng) {
  const swing = SETTINGS.SEASON_FITNESS_SWING;
  return squad.map((slot) => {
    const delta = randInt(rng, -swing, swing);
    const newFitness = clampFitness(slot.fitness + delta);
    return { ...slot, fitness: newFitness, lastFitnessDelta: null };
  });
}

/**
 * מחיל שינוי כושר אקראי (±MATCH_FITNESS_SWING) על כל שחקן בסגל, אחרי
 * כל משחק שהקבוצה המנוהלת שיחקה בפועל (לא במחזורי מנוחה - ראו round.js).
 * שומר את השינוי בפועל (אחרי הגבלת הטווח) ב-lastFitnessDelta, כדי
 * שה-UI יוכל להציג חץ+מספר קבוע ליד השחקן בתצוגת הסגל.
 */
export function applyMatchFitnessSwing(squad, rng) {
  const swing = SETTINGS.MATCH_FITNESS_SWING;
  return squad.map((slot) => {
    const delta = randInt(rng, -swing, swing);
    const newFitness = clampFitness(slot.fitness + delta);
    return { ...slot, fitness: newFitness, lastFitnessDelta: newFitness - slot.fitness };
  });
}

/**
 * מחליף שחקן בעמדה נתונה בשחקן חדש אקראי מהמאגר, שלא נמצא כבר בסגל.
 * משמש הן להחלפה אוטומטית בעקבות אירוע/עזיבה, והן כבסיס לרכישה בשוק.
 */
export function replacePlayerInPosition(squad, allPlayers, position, rng) {
  const currentIds = squad.map((s) => s.playerId);
  const candidates = excludeIds(byPosition(allPlayers, position), currentIds);
  if (candidates.length === 0) {
    throw new Error(`אין שחקנים זמינים להחלפה בעמדה ${position}`);
  }
  const chosen = pickRandom(rng, candidates);
  const newSlot = buildSquadSlot(chosen, rng);
  return squad.map((s) => (s.position === position ? newSlot : s));
}

/** מחליף שחקן בעמדה בשחקן ספציפי (לשימוש בשוק ההעברות). */
export function setPlayerInPosition(squad, playerRecord, rng) {
  const newSlot = buildSquadSlot(playerRecord, rng);
  return squad.map((s) => (s.position === playerRecord.position ? newSlot : s));
}

export function getSlotByPosition(squad, position) {
  return squad.find((s) => s.position === position) || null;
}

export function squadWithPlayerData(squad, allPlayers) {
  return squad.map((slot) => ({
    ...slot,
    player: findById(allPlayers, slot.playerId),
  }));
}

export function clampFitness(value) {
  return Math.max(SETTINGS.FITNESS_MIN, Math.min(SETTINGS.FITNESS_MAX, value));
}

export function clampAbility(value) {
  return Math.max(SETTINGS.ABILITY_MIN, Math.min(SETTINGS.ABILITY_MAX, value));
}
