// הגדרות אירועים מיוחדים. כל אירוע הוא תיאור נתונים בלבד - ההיגיון
// לביצוע ההשפעות נמצא ב-js/engine/events.js, כדי שיהיה קל להוסיף
// אירועים חדשים כאן בלי לגעת בלוגיקה.
//
// סוגי effect אפשריים (kind):
//  - "budget"            : שינוי מיידי/נדחה בתקציב. amount חיובי = הכנסה, שלילי = הוצאה.
//  - "fitness"            : שינוי כושר לשחקן (יעד: random/all), בטווח 51-99.
//  - "ability"             : שינוי יכולת לשחקן (יעד: random), בטווח 1-99.
//  - "salary_commitment"   : התחייבות שכר עתידית שתיושם במועד מוגדר.
//  - "player_leave_chance" : סיכוי שהשחקן בעמדה הרלוונטית יעזוב ויוחלף.
//  - "none"                : אין השפעה (אופציה של "לא לעשות כלום").
//
// timing: "immediate" | "end_of_season"

export const EVENTS = [
  {
    id: "salary_raise_request",
    title_he: "שחקן מבקש העלאה בשכר",
    description_he: "{playerName} מבקש העלאה בשכר של {amount} ליורו לעונה. איך תגיב?",
    type: "choice",
    targetPosition: "random", // עמדה אקראית מתוך הסגל
    options: [
      {
        id: "accept",
        label_he: "להסכים",
        effects: [
          { kind: "salary_commitment", amountFormula: "raiseAmount", timing: "immediate_recurring" },
        ],
      },
      {
        id: "decline",
        label_he: "לסרב",
        effects: [
          { kind: "player_leave_chance", probability: 0.35 },
        ],
      },
    ],
  },
  {
    id: "investment_matured",
    title_he: "השקעה שהבשילה",
    description_he: "השקעה פיננסית שביצעת בעבר הבשילה ומניבה רווח.",
    type: "automatic",
    effects: [{ kind: "budget", amount: 750_000, timing: "immediate" }],
  },
  {
    id: "medical_treatment",
    title_he: "טיפול רפואי מיוחד",
    description_he: "{playerName} סובל מירידת כושר. ניתן לשלם {cost} ליורו עבור טיפול רפואי שיחזיר לו כושר.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "pay",
        label_he: "לשלם ולטפל ({cost} אירו)",
        effects: [
          { kind: "budget", amount: -500_000, timing: "immediate" },
          { kind: "fitness", target: "event_player", amount: 20, timing: "immediate" },
        ],
      },
      {
        id: "skip",
        label_he: "לא לטפל",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "sponsorship_offer",
    title_he: "הצעת חסות",
    description_he: "חברה מציעה לחסות את הקבוצה תמורת {amount} ליורו, שישולמו בסוף העונה.",
    type: "choice",
    options: [
      {
        id: "accept",
        label_he: "לקבל את ההצעה",
        effects: [{ kind: "budget", amount: 2_500_000, timing: "end_of_season" }],
      },
      {
        id: "decline",
        label_he: "לסרב",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "end_of_season_salary_request",
    title_he: "בקשת שכר מסוף העונה",
    description_he: "{playerName} מבקש תוספת שכר של {amount} ליורו שתשולם בסוף העונה.",
    type: "choice",
    targetPosition: "goalkeeper",
    options: [
      {
        id: "accept",
        label_he: "להסכים",
        effects: [{ kind: "budget", amount: -1_000_000, timing: "end_of_season" }],
      },
      {
        id: "decline",
        label_he: "לסרב",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "fan_fundraiser",
    title_he: "גיוס כספים מהאוהדים",
    description_he: "האוהדים ערכו מגבית תרומות למען הקבוצה וגייסו {amount} ליורו.",
    type: "automatic",
    effects: [{ kind: "budget", amount: 300_000, timing: "immediate" }],
  },
  {
    id: "equipment_upgrade",
    title_he: "שדרוג ציוד אימונים",
    description_he: "ניתן לשדרג את ציוד האימונים תמורת {cost} ליורו, מה שישפר מיידית את הכושר של כל השחקנים.",
    type: "choice",
    options: [
      {
        id: "pay",
        label_he: "לשדרג ({cost} אירו)",
        effects: [
          { kind: "budget", amount: -400_000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 8, timing: "immediate" },
        ],
      },
      {
        id: "skip",
        label_he: "לא כרגע",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "injury_scare",
    title_he: "בעיה גופנית קלה",
    description_he: "{playerName} סבל מבעיה גופנית קלה באימון והכושר שלו נפגע.",
    type: "automatic",
    targetPosition: "random",
    effects: [{ kind: "fitness", target: "event_player", amount: -15, timing: "immediate" }],
  },
  {
    id: "talent_scout_bonus",
    title_he: "דוח סקאוט חיובי",
    description_he: "הסקאוטים של הקבוצה מדווחים כי {playerName} התקדם ברמתו.",
    type: "automatic",
    targetPosition: "random",
    effects: [{ kind: "ability", target: "event_player", amount: 1, timing: "immediate" }],
  },
  {
    id: "disciplinary_fine",
    title_he: "קנס משמעתי מהליגה",
    description_he: "הליגה הטילה על הקבוצה קנס משמעתי בסך {amount} ליורו.",
    type: "automatic",
    effects: [{ kind: "budget", amount: -200_000, timing: "immediate" }],
  },
];

export function getEventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}
