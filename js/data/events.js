// הגדרות אירועים מיוחדים. כל אירוע הוא תיאור נתונים בלבד - ההיגיון
// לביצוע ההשפעות נמצא ב-js/engine/events.js, כדי שיהיה קל להוסיף
// אירועים חדשים כאן בלי לגעת בלוגיקה.
//
// כל אירוע הוא מבוסס-בחירה (type: "choice") עם 2-3 אופציות. לכל
// אופציה יש effects[] משלה, כך שלכל בחירה יש השלכה שונה ומוצגת
// במספרים מדויקים למשתמש לפני ההחלטה (ראו js/engine/events.js,
// הפונקציה describeEffects).
//
// סוגי effect אפשריים (kind):
//  - "budget"            : שינוי בתקציב. amount חיובי = הכנסה, שלילי = הוצאה.
//                          timing: "immediate" | "end_of_season".
//  - "fitness"            : שינוי כושר (target: "event_player" | "all"), בטווח 51-99.
//  - "ability"             : שינוי יכולת ל-event_player, בטווח 1-99.
//  - "salary_commitment"   : תוספת קבועה לשכר העונתי של event_player.
//  - "random_outcome"      : הימור עם תוצאות אפשריות (branches), לכל branch
//                            probability (סכום כל ה-branches = 1) ו-effects
//                            משלו. ה-UI מציג את האחוזים *לפני* הבחירה.
//  - "none"                : אין השפעה בפועל (אופציה של "לא לעשות כלום").
//
// timing: "immediate" | "end_of_season"

export const EVENTS = [
  {
    id: "salary_raise_request",
    title_he: "שחקן מבקש העלאה בשכר",
    description_he:
      "{playerName} ({positionLabel}) דורש תשלום חד-פעמי של {amount}€ כדי להירגע, אחרת הוא עלול להתעצבן.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "accept",
        label_he: "להסכים ולשלם {amount}€ מיד",
        effects: [{ kind: "budget", amountFormula: "raiseAmount", sign: -1, timing: "immediate" }],
      },
      {
        id: "decline",
        label_he: "לסרב ולהמר על התגובה שלו",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.45,
                label_he: "הוא נרגע מעצמו - אין השפעה",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.55,
                label_he: "הוא מתעצבן ומאבד מוטיבציה - היכולת שלו יורדת",
                effects: [{ kind: "ability", target: "event_player", amount: -4, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "medical_treatment",
    title_he: "בעיית כושר ל{playerName}",
    description_he: "{playerName} סובל מירידת כושר. ניתן לשלם {cost}€ עבור טיפול רפואי מיידי, או לוותר.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "pay",
        label_he: "לשלם ולטפל ({cost}€)",
        effects: [
          { kind: "budget", amount: -500_000, timing: "immediate" },
          { kind: "fitness", target: "event_player", amount: 9, timing: "immediate" },
        ],
      },
      {
        id: "skip",
        label_he: "לוותר ולא לשלם",
        effects: [{ kind: "fitness", target: "event_player", amount: -9, timing: "immediate" }],
      },
    ],
  },
  {
    id: "sponsorship_offer",
    title_he: "הצעת חסות",
    description_he: "חברה מציעה לחסות את הקבוצה תמורת 2,500,000€ שישולמו בסוף העונה. ניתן גם לנסות לנהל משא ומתן על סכום גבוה יותר.",
    type: "choice",
    options: [
      {
        id: "accept",
        label_he: "לקבל את ההצעה כמות שהיא (+2,500,000€ בסוף העונה)",
        effects: [{ kind: "budget", amount: 2_500_000, timing: "end_of_season" }],
      },
      {
        id: "negotiate",
        label_he: "לנהל משא ומתן על סכום גבוה יותר (הימור)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.5,
                label_he: "המשא ומתן הצליח - החברה הסכימה לסכום גבוה יותר",
                effects: [{ kind: "budget", amount: 3_500_000, timing: "end_of_season" }],
              },
              {
                probability: 0.5,
                label_he: "החברה נעלבה והורידה את ההצעה",
                effects: [{ kind: "budget", amount: 1_200_000, timing: "end_of_season" }],
              },
            ],
          },
        ],
      },
      {
        id: "decline",
        label_he: "לסרב לגמרי",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "end_of_season_salary_request",
    title_he: "השוער דורש תוספת שכר",
    description_he: "{playerName} (שוער) מבקש תוספת שכר של 1,000,000€ שתשולם בסוף העונה, אחרת הוא עלול לאבד ריכוז.",
    type: "choice",
    targetPosition: "goalkeeper",
    options: [
      {
        id: "accept",
        label_he: "להסכים (-1,000,000€ בסוף העונה)",
        effects: [{ kind: "budget", amount: -1_000_000, timing: "end_of_season" }],
      },
      {
        id: "decline",
        label_he: "לסרב ולהמר על התגובה שלו",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "הוא ממשיך לשחק כרגיל - אין השפעה",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.4,
                label_he: "הוא נפגע מהסירוב והכושר שלו צונח",
                effects: [{ kind: "fitness", target: "event_player", amount: -10, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "investment_matured",
    title_he: "השקעה פיננסית",
    description_he: "השקעה פיננסית שביצעת בעבר הבשילה. ניתן למשוך את הרווח מיד, או להשאיר אותה מושקעת ולהמר על תשואה גבוהה יותר בסוף העונה.",
    type: "choice",
    options: [
      {
        id: "withdraw_now",
        label_he: "למשוך עכשיו (+750,000€ מיידי)",
        effects: [{ kind: "budget", amount: 750_000, timing: "immediate" }],
      },
      {
        id: "reinvest",
        label_he: "להשאיר מושקע ולהמר על סוף העונה",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.5,
                label_he: "ההשקעה שילשה את עצמה",
                effects: [{ kind: "budget", amount: 1_400_000, timing: "end_of_season" }],
              },
              {
                probability: 0.5,
                label_he: "ההשקעה הפסידה חלק מערכה",
                effects: [{ kind: "budget", amount: -200_000, timing: "end_of_season" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fan_fundraiser",
    title_he: "מגבית תרומות מהאוהדים",
    description_he: "האוהדים מציעים לערוך מגבית תרומות לקבוצה. ניתן לקבל תרומה רגילה, או לממן אירוע גדול יותר (עלות 100,000€) בהימור על תוצאה טובה יותר.",
    type: "choice",
    options: [
      {
        id: "regular",
        label_he: "לקבל תרומה רגילה (+300,000€ מיידי)",
        effects: [{ kind: "budget", amount: 300_000, timing: "immediate" }],
      },
      {
        id: "big_event",
        label_he: "לממן אירוע גדול (-100,000€) ולהמר על התרומות",
        effects: [
          { kind: "budget", amount: -100_000, timing: "immediate" },
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "האירוע הצליח מעל המצופה",
                effects: [{ kind: "budget", amount: 900_000, timing: "immediate" }],
              },
              {
                probability: 0.4,
                label_he: "האירוע הניב פחות מהצפוי",
                effects: [{ kind: "budget", amount: 150_000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "injury_scare",
    title_he: "בעיה גופנית קלה",
    description_he: "{playerName} מתלונן על אי-נוחות קלה. אפשר לתת לו לנוח (בלי להבטיח החלמה), או להמשיך להעמיס עליו באימונים.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "rest",
        label_he: "לתת לו לנוח (הימור על ההחלמה)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.7,
                label_he: "הוא החלים לגמרי - אין השפעה",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.3,
                label_he: "הבעיה החמירה במנוחה",
                effects: [{ kind: "fitness", target: "event_player", amount: -20, timing: "immediate" }],
              },
            ],
          },
        ],
      },
      {
        id: "play_through",
        label_he: "להמשיך להעמיס עליו (כושר -8 מיידי, בטוח)",
        effects: [{ kind: "fitness", target: "event_player", amount: -8, timing: "immediate" }],
      },
    ],
  },
  {
    id: "talent_scout_bonus",
    title_he: "דוח סקאוט חיובי",
    description_he: "הסקאוטים מדווחים כי {playerName} מתקדם ברמתו. ניתן לממן אימון אישי נוסף (150,000€) לשיפור גדול יותר, או להסתפק בהתקדמות הטבעית.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "invest",
        label_he: "לממן אימון אישי (-150,000€, יכולת +3)",
        effects: [
          { kind: "budget", amount: -150_000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: 3, timing: "immediate" },
        ],
      },
      {
        id: "natural",
        label_he: "להסתפק בהתקדמות הטבעית (חינם, יכולת +1)",
        effects: [{ kind: "ability", target: "event_player", amount: 1, timing: "immediate" }],
      },
    ],
  },
  {
    id: "disciplinary_fine",
    title_he: "קנס משמעתי מהליגה",
    description_he: "הליגה שוקלת קנס משמעתי על התנהגות אוהדים. ניתן לשלם קנס מופחת מיד, או לערער ולהמר על התוצאה.",
    type: "choice",
    options: [
      {
        id: "pay_now",
        label_he: "לשלם קנס מופחת מיד (-200,000€, בטוח)",
        effects: [{ kind: "budget", amount: -200_000, timing: "immediate" }],
      },
      {
        id: "appeal",
        label_he: "לערער על הקנס (הימור)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.55,
                label_he: "הערעור התקבל - הקנס בוטל לגמרי",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.45,
                label_he: "הערעור נדחה - הקנס הוכפל",
                effects: [{ kind: "budget", amount: -400_000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "equipment_upgrade",
    title_he: "שדרוג ציוד אימונים",
    description_he: "ניתן לשדרג את ציוד האימונים תמורת 400,000€, מה שישפר מיידית את הכושר של כל השחקנים, או לדלג על כך הפעם.",
    type: "choice",
    options: [
      {
        id: "pay",
        label_he: "לשדרג (-400,000€, כושר כל הסגל +8)",
        effects: [
          { kind: "budget", amount: -400_000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 8, timing: "immediate" },
        ],
      },
      {
        id: "skip",
        label_he: "לדלג הפעם (חינם, ללא שיפור)",
        effects: [{ kind: "none" }],
      },
    ],
  },
];

export function getEventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}
