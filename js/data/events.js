// הגדרות אירועים מיוחדים. כל אירוע הוא תיאור נתונים בלבד - ההיגיון
// לביצוע ההשפעות נמצא ב-js/engine/events.js, כדי שיהיה קל להוסיף
// אירועים חדשים כאן בלי לגעת בלוגיקה.

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
          { kind: "budget", amount: -500000, timing: "immediate" },
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
        effects: [{ kind: "budget", amount: 2500000, timing: "end_of_season" }],
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
                effects: [{ kind: "budget", amount: 3500000, timing: "end_of_season" }],
              },
              {
                probability: 0.5,
                label_he: "החברה נעלבה והורידה את ההצעה",
                effects: [{ kind: "budget", amount: 1200000, timing: "end_of_season" }],
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
        effects: [{ kind: "budget", amount: -1000000, timing: "end_of_season" }],
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
        effects: [{ kind: "budget", amount: 750000, timing: "immediate" }],
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
                effects: [{ kind: "budget", amount: 1400000, timing: "end_of_season" }],
              },
              {
                probability: 0.5,
                label_he: "ההשקעה הפסידה חלק מערכה",
                effects: [{ kind: "budget", amount: -200000, timing: "end_of_season" }],
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
        effects: [{ kind: "budget", amount: 300000, timing: "immediate" }],
      },
      {
        id: "big_event",
        label_he: "לממן אירוע גדול (-100,000€) ולהמר על התרומות",
        effects: [
          { kind: "budget", amount: -100000, timing: "immediate" },
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "האירוע הצליח מעל המצופה",
                effects: [{ kind: "budget", amount: 900000, timing: "immediate" }],
              },
              {
                probability: 0.4,
                label_he: "האירוע הניב פחות מהצפוי",
                effects: [{ kind: "budget", amount: 150000, timing: "immediate" }],
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
          { kind: "budget", amount: -150000, timing: "immediate" },
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
        effects: [{ kind: "budget", amount: -200000, timing: "immediate" }],
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
                effects: [{ kind: "budget", amount: -400000, timing: "immediate" }],
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
          { kind: "budget", amount: -400000, timing: "immediate" },
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
  {
    id: "media_interview_controversy",
    title_he: "ראיון נפיץ בתקשורת",
    description_he: "{playerName} מעניק ראיון ללא אישור ומבקר את השיטה הטקטית. הקבוצה צריכה להחליט כיצד להגיב.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "fine_player",
        label_he: "לקנוס את השחקן ולדרוש התנצלות (+100,000€ לתקציב, יכולת -2)",
        effects: [
          { kind: "budget", amount: 100000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: -2, timing: "immediate" },
        ],
      },
      {
        id: "support_player",
        label_he: "לתמוך בשחקן בפומבי (הימור על תגובת חדר ההלבשה)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "השחקנים מעריכים את הגיבוי והאווירה משתפרת",
                effects: [{ kind: "fitness", target: "all", amount: 4, timing: "immediate" }],
              },
              {
                probability: 0.4,
                label_he: "נוצר מתח בחדר ההלבשה בעקבות המועדפות",
                effects: [{ kind: "fitness", target: "all", amount: -4, timing: "immediate" }],
              },
            ],
          },
        ],
      },
      {
        id: "ignore",
        label_he: "להתעלם מהאירוע",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "youth_academy_prospect",
    title_he: "תגלית ממחלקת הנוער",
    description_he: "מאמן הנוער מדווח על כישרון עולה שזקוק לתוכנית פיתוח מואצת. ניתן להשקיע בקידומו או לתת לו להתקדם בקצב רגיל.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "invest_heavy",
        label_he: "להשקיע בתוכנית פיתוח אישית (-300,000€, הימור על פריצת דרך)",
        effects: [
          { kind: "budget", amount: -300000, timing: "immediate" },
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.55,
                label_he: "השחקן עשה קפיצת מדרגה אדירה",
                effects: [{ kind: "ability", target: "event_player", amount: 5, timing: "immediate" }],
              },
              {
                probability: 0.45,
                label_he: "ההתקדמות הייתה מתונה בלבד",
                effects: [{ kind: "ability", target: "event_player", amount: 1, timing: "immediate" }],
              },
            ],
          },
        ],
      },
      {
        id: "standard_track",
        label_he: "לקדם בקצב רגיל (חינם, יכולת +1)",
        effects: [{ kind: "ability", target: "event_player", amount: 1, timing: "immediate" }],
      },
    ],
  },
  {
    id: "stadium_turf_upgrade",
    title_he: "שדרוג משטח הדשא באצטדיון",
    description_he: "משטח הדשא באצטדיון דורש שזרוע דחוף. טיפול איכותי ימנע פציעות וישפר את כושר כל השחקנים.",
    type: "choice",
    options: [
      {
        id: "premium_turf",
        label_he: "להתקין משטח דשא מתקדם (-500,000€, כושר כל הסגל +7)",
        effects: [
          { kind: "budget", amount: -500000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 7, timing: "immediate" },
        ],
      },
      {
        id: "patch_work",
        label_he: "תיקון נקודתי בלבד (-100,000€, כושר כל הסגל +2)",
        effects: [
          { kind: "budget", amount: -100000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 2, timing: "immediate" },
        ],
      },
      {
        id: "skip_turf",
        label_he: "להשאיר את המצב כפי שהוא",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "friendly_match_invitation",
    title_he: "הזמנה למשחק ראווה בינלאומי",
    description_he: "מועדון יוקרתי מעבר לים מציע לקיים משחק ראווה רווחי, אך הדבר יכביד על עומס המשחקים של השחקנים.",
    type: "choice",
    options: [
      {
        id: "accept_match",
        label_he: "לטוס למשחק (+850,000€ מיידי, עומס כושר -6 לכל הסגל)",
        effects: [
          { kind: "budget", amount: 850000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: -6, timing: "immediate" },
        ],
      },
      {
        id: "decline_match",
        label_he: "לסרב ולהעניק ימי מנוחה לסגל (כושר כל הסגל +3)",
        effects: [{ kind: "fitness", target: "all", amount: 3, timing: "immediate" }],
      },
    ],
  },
  {
    id: "influencer_viral_campaign",
    title_he: "טרנד ויראלי ברשתות החברתיות",
    description_he: "{playerName} הפך לויראלי ברשתות החברתיות. מחלקת השיווק מציעה להשיק סדרת מוצרים מיוחדת סביבו.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "launch_merch",
        label_he: "להשקיע בייצור מוצרים (-200,000€, הימור על מכירות)",
        effects: [
          { kind: "budget", amount: -200000, timing: "immediate" },
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.65,
                label_he: "המוצרים נחטפו - רווח עצום",
                effects: [{ kind: "budget", amount: 900000, timing: "immediate" }],
              },
              {
                probability: 0.35,
                label_he: "הטרנד חלף מהר - מכירות חלשות",
                effects: [{ kind: "budget", amount: 100000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
      {
        id: "pass_merch",
        label_he: "לוותר על הקמפיין",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "veteran_player_mentorship",
    title_he: "חניכה על ידי שחקן ותיק",
    description_he: "אחד השחקנים הוותיקים בסגל מציע לקיים סדנאות מנהיגות ואימונים אישיים לשחקנים הצעירים.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "fund_mentorship",
        label_he: "לממן מענק הדרכה לוותיק (-150,000€, יכולת +3 לשחקן נבחר)",
        effects: [
          { kind: "budget", amount: -150000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: 3, timing: "immediate" },
        ],
      },
      {
        id: "decline_mentorship",
        label_he: "להודות לו ולהמשיך בשגרה",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "stadium_pitch_flooding",
    title_he: "נזקי מזג אוויר במתקן האימונים",
    description_he: "סערה קשה גרמה לנזק במתחם האימונים של הקבוצה. נדרש שיפוץ מהיר כדי לא לפגוע ברצף האימונים.",
    type: "choice",
    options: [
      {
        id: "quick_repair",
        label_he: "תיקון חירום מהיר (-300,000€ מיידי)",
        effects: [{ kind: "budget", amount: -300000, timing: "immediate" }],
      },
      {
        id: "delay_repair",
        label_he: "לדחות את התיקון ולהתאמן במגרש חלופי (כושר כל הסגל -5)",
        effects: [{ kind: "fitness", target: "all", amount: -5, timing: "immediate" }],
      },
    ],
  },
  {
    id: "shirt_sponsor_bonus",
    title_he: "אתגר בונוס מספונסר החולצות",
    description_he: "ספונסר הראשי מציע עסקת בונוס: תוספת תקציב משמעותית בסוף העונה אם תסכימו לסעיף התחייבות למיקום בטבלה.",
    type: "choice",
    options: [
      {
        id: "accept_challenge",
        label_he: "לקבל את האתגר (הימור על הבונוס בסוף העונה)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.55,
                label_he: "העמידה בציפיות הושגה - בונוס גדול",
                effects: [{ kind: "budget", amount: 1800000, timing: "end_of_season" }],
              },
              {
                probability: 0.45,
                label_he: "היעדים לא הושגו - קנס על אי עמידה בחוזה",
                effects: [{ kind: "budget", amount: -300000, timing: "end_of_season" }],
              },
            ],
          },
        ],
      },
      {
        id: "decline_challenge",
        label_he: "לשמור על החוזה הקיים ללא שינוי",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "dietitian_nutrition_plan",
    title_he: "תוכנית תזונה מותאמת אישית",
    description_he: "תזונאי ספורט בכיר מציע לבנות תפריט תזונה מודרני מותאם אישית לכל שחקני הקבוצה.",
    type: "choice",
    options: [
      {
        id: "hire_nutritionist",
        label_he: "להעסיק את התזונאי (-220,000€, כושר כל הסגל +6)",
        effects: [
          { kind: "budget", amount: -220000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 6, timing: "immediate" },
        ],
      },
      {
        id: "skip_nutritionist",
        label_he: "להישאר עם צוות התזונה הקיים",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "player_homesick",
    title_he: "געגועים הביתה ל{playerName}",
    description_he: "{playerName} מתקשה להתאקלם בעיר וסובל מגעגועים למשפחתו. הדבר משפיע על היכולת שלו במגרש.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "fly_family",
        label_he: "לממן טיסות ואירוח למשפחתו (-140,000€, יכולת +3)",
        effects: [
          { kind: "budget", amount: -140000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: 3, timing: "immediate" },
        ],
      },
      {
        id: "tough_love",
        label_he: "לדרוש ממנו להתמודד (הימור על תגובתו)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.4,
                label_he: "הוא התגבר על המכשול והתחזק מנטלית",
                effects: [{ kind: "ability", target: "event_player", amount: 2, timing: "immediate" }],
              },
              {
                probability: 0.6,
                label_he: "מצבו הדרדר והפוקוס שלו נפגע",
                effects: [{ kind: "fitness", target: "event_player", amount: -10, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "tax_audit_investigation",
    title_he: "ביקורת פתע מרשות המסים",
    description_he: "רשויות המס מבצעות בדיקה של תיקי העברות השחקנים מהשנה החולפת. ניתן לשכור ייעוץ משפטי בכיר.",
    type: "choice",
    options: [
      {
        id: "hire_tax_lawyers",
        label_he: "לשכור עורכי דין מומחים (-250,000€, מניעת קנסות בטוחה)",
        effects: [{ kind: "budget", amount: -250000, timing: "immediate" }],
      },
      {
        id: "risk_audit",
        label_he: "להסתמך על הייעוץ הקיים (הימור)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.5,
                label_he: "הבדיקה הסתיימה ללא ליקויים",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.5,
                label_he: "התגלו חריגות והוטל קנס כבד",
                effects: [{ kind: "budget", amount: -700000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fan_club_protest",
    title_he: "מחאת ארגון האוהדים",
    description_he: "ארגון האוהדים מאיים בחרם עידוד בשל מחירי הכרטיסים למשחקי הבית.",
    type: "choice",
    options: [
      {
        id: "lower_ticket_prices",
        label_he: "להוזיל כרטיסים (-350,000€ בסוף העונה, כושר מוראלי לכל הסגל +4)",
        effects: [
          { kind: "budget", amount: -350000, timing: "end_of_season" },
          { kind: "fitness", target: "all", amount: 4, timing: "immediate" },
        ],
      },
      {
        id: "refuse_protest",
        label_he: "לסרב לדרישות (הימור על השפעת החרם)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "המחאה נחלשה והאוהדים חזרו לעודד",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.4,
                label_he: "החרם הוחמר והפסיד הכנסות ממכירת כרטיסים",
                effects: [{ kind: "budget", amount: -500000, timing: "end_of_season" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "cryo_therapy_chamber",
    title_he: "חדר התאוששות בקריותרפיה",
    description_he: "צוות הפיזיותרפיה ממליץ לשכור תא הקפאה חדשני להאצת התאוששות השחקנים לאחר משחקים.",
    type: "choice",
    options: [
      {
        id: "lease_cryo",
        label_he: "לשכור את המערכת (-450,000€, כושר כל הסגל +9)",
        effects: [
          { kind: "budget", amount: -450000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 9, timing: "immediate" },
        ],
      },
      {
        id: "decline_cryo",
        label_he: "להמשיך בשיטות ההתאוששות המסורתיות",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "scout_scandal_espionage",
    title_he: "חשד לריגול טקטי",
    description_he: "סקאוט של הקבוצה נחשד בצילום אימון סגור של היריבה הבאה. הנהלת הליגה דורשת הבהרות.",
    type: "choice",
    options: [
      {
        id: "settle_out_of_court",
        label_he: "להגיע להסדר טיעון מהיר (-200,000€)",
        effects: [{ kind: "budget", amount: -200000, timing: "immediate" }],
      },
      {
        id: "deny_allegations",
        label_he: "להכחיש כל קשר (הימור בבית הדין)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.5,
                label_he: "הטענות נדחו מחוסר ראיות",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.5,
                label_he: "הקבוצה הורשעה והוטל קנס כפול",
                effects: [{ kind: "budget", amount: -550000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "charity_gala_auction",
    title_he: "ערב התרמה ואירוע גאלה",
    description_he: "עמותה מקומית מציעה לקיים ערב התרמה נוצץ בהשתתפות שחקני הקבוצה לחיזוק הקשר עם הקהילה.",
    type: "choice",
    options: [
      {
        id: "host_gala",
        label_he: "לארגן גאלה יוצרת תדמית (-120,000€, הימור על גיוס תרומות וחסויות)",
        effects: [
          { kind: "budget", amount: -120000, timing: "immediate" },
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.7,
                label_he: "תורמים אמידים הצטרפו וסכום מכובד גויס",
                effects: [{ kind: "budget", amount: 600000, timing: "immediate" }],
              },
              {
                probability: 0.3,
                label_he: "האירוע היה צנוע והכניס מעט",
                effects: [{ kind: "budget", amount: 180000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
      {
        id: "decline_gala",
        label_he: "לתרום סכום סמלי בלבד (-40,000€)",
        effects: [{ kind: "budget", amount: -40000, timing: "immediate" }],
      },
    ],
  },
  {
    id: "key_player_agent_demands",
    title_he: "דרישת עמלה מסוכן השחקן",
    description_he: "סוכנו של {playerName} דורש בונוס ייצוג מיוחד כדי להבטיח שהשחקן יישאר ממוקד בקבוצה.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "pay_agent",
        label_he: "לשלם את עמלת הסוכן (-350,000€, יכולת +2)",
        effects: [
          { kind: "budget", amount: -350000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: 2, timing: "immediate" },
        ],
      },
      {
        id: "refuse_agent",
        label_he: "לסרב לדרישת הסוכן (הימור על תגובת השחקן)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.5,
                label_he: "השחקן מתעלם מהסוכן וממשיך כרגיל",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.5,
                label_he: "השחקן מושפע מהסוכן ומאבד ריכוז",
                effects: [{ kind: "ability", target: "event_player", amount: -3, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "boot_sponsor_conflict",
    title_he: "סכסוך אימוץ נעליים",
    description_he: "נוצר ניגוד עניינים בין הספונסר האישי של {playerName} לבין מלבישת המועדון הרשמית.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "compensate_brand",
        label_he: "לשלם פיצוי לפשרה בחוזה (-160,000€)",
        effects: [{ kind: "budget", amount: -160000, timing: "immediate" }],
      },
      {
        id: "force_club_gear",
        label_he: "לחייב את השחקן לנעול את ציוד המועדון (כושר -5 לשחקן)",
        effects: [{ kind: "fitness", target: "event_player", amount: -5, timing: "immediate" }],
      },
    ],
  },
  {
    id: "team_building_trip",
    title_he: "מחנה גיבוש קבוצתי",
    description_he: "המאמן מציע לצאת למחנה גיבוש מרוכז כדי לחזק את הלכידות והרוח הקבוצתית.",
    type: "choice",
    options: [
      {
        id: "resort_retreat",
        label_he: "יומיים במלון יוקרה (-280,000€, כושר כל הסגל +7)",
        effects: [
          { kind: "budget", amount: -280000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 7, timing: "immediate" },
        ],
      },
      {
        id: "nature_camp",
        label_he: "מסע גיבוש בטבע (-90,000€, כושר כל הסגל +3)",
        effects: [
          { kind: "budget", amount: -90000, timing: "immediate" },
          { kind: "fitness", target: "all", amount: 3, timing: "immediate" },
        ],
      },
      {
        id: "cancel_trip",
        label_he: "לוותר על הגיבוש",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "gambling_allegation",
    title_he: "שמועות על מעורבות בהימורים",
    description_he: "גל שמועות ברשת טוען כי {playerName} היה מעורב בטופס הימורים לא חוקי. הנהלת המועדון נדרשת לפעול.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "suspend_and_investigate",
        label_he: "להשעות את השחקן ולשכור חוקר פרטי (-180,000€, כושר -10 לשחקן)",
        effects: [
          { kind: "budget", amount: -180000, timing: "immediate" },
          { kind: "fitness", target: "event_player", amount: -10, timing: "immediate" },
        ],
      },
      {
        id: "back_player",
        label_he: "להגן על השחקן ולדחות את השמועות (הימור)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.7,
                label_he: "השמועות התבררו כפייק ניוז - הקבוצה יצאה מחוזקת",
                effects: [{ kind: "none" }],
              },
              {
                probability: 0.3,
                label_he: "הפרשה התלקחה והוטל קנס משמעתי",
                effects: [{ kind: "budget", amount: -650000, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "merchandise_store_expansion",
    title_he: "הרחבת חנות המזכרות הרשמית",
    description_he: "הזדמנות עסקית לפתוח סניף דגל חדש של חנות המועדון במרכז הקניות המוביל בעיר.",
    type: "choice",
    options: [
      {
        id: "flagship_store",
        label_he: "לפתוח חנות דגל (-750,000€ מיידי, +1,700,000€ בסוף העונה)",
        effects: [
          { kind: "budget", amount: -750000, timing: "immediate" },
          { kind: "budget", amount: 1700000, timing: "end_of_season" },
        ],
      },
      {
        id: "online_store_only",
        label_he: "לשדרג את החנות הדיגיטלית בלבד (-200,000€ מיידי, +550,000€ בסוף העונה)",
        effects: [
          { kind: "budget", amount: -200000, timing: "immediate" },
          { kind: "budget", amount: 550000, timing: "end_of_season" },
        ],
      },
      {
        id: "skip_expansion",
        label_he: "להישאר במתכונת הנוכחית",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "doping_test_delay",
    title_he: "עיכוב בבדיקת סימום פתאומית",
    description_he: "בדיקת סימום הפתעתית של סוכנות המניעה גרמה לעיכוב הטיסה בחזרה ממשחק החוץ. השחקנים עייפים מאוד.",
    type: "choice",
    options: [
      {
        id: "charter_flight",
        label_he: "להזמין טיסת צ'ארטר חלופית (-180,000€, הסגל מגיע בזמן)",
        effects: [{ kind: "budget", amount: -180000, timing: "immediate" }],
      },
      {
        id: "wait_commercial",
        label_he: "להמתין לטיסה הרגילה (כושר כל הסגל -5 מעייפות)",
        effects: [{ kind: "fitness", target: "all", amount: -5, timing: "immediate" }],
      },
    ],
  },
  {
    id: "analyst_ai_software",
    title_he: "מערכת אנליטיקה ואינטליגנציה מלאכותית",
    description_he: "חברת סטארט-אפ מציעה תוכנת AI מתקדמת לניתוח מהלכים טקטיים ומניעת פציעות בזמן אמת.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "buy_full_suite",
        label_he: "לרכוש את החבילה המלאה (-320,000€, יכולת +4 לשחקן)",
        effects: [
          { kind: "budget", amount: -320000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: 4, timing: "immediate" },
        ],
      },
      {
        id: "basic_trial",
        label_he: "לנסות גרסת ניסיון בסיסית (-100,000€, יכולת +1 לשחקן)",
        effects: [
          { kind: "budget", amount: -100000, timing: "immediate" },
          { kind: "ability", target: "event_player", amount: 1, timing: "immediate" },
        ],
      },
      {
        id: "decline_tech",
        label_he: "להסתמך על שיטות הניתוח המסורתיות",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "stadium_naming_rights",
    title_he: "חסות שם האצטדיון",
    description_he: "תאגיד בינלאומי מציע חוזה חסות לשם האצטדיון לעונה הקרובה. חלק מהאוהדים מתנגדים לשינוי השם המסורתי.",
    type: "choice",
    options: [
      {
        id: "sell_naming_rights",
        label_he: "למכור את זכויות השם (+3,800,000€ בסוף העונה)",
        effects: [{ kind: "budget", amount: 3800000, timing: "end_of_season" }],
      },
      {
        id: "keep_traditional_name",
        label_he: "לשמור על השם המקורי ולהתחשב באוהדים",
        effects: [{ kind: "none" }],
      },
    ],
  },
  {
    id: "player_nightclub_incident",
    title_he: "בילוי לילי ערב משחק",
    description_he: "תמונות של {playerName} מבלה במועדון בשעות הלילה המאוחרות ערב משחק חשוב הופצו ברשת.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "strict_fine",
        label_he: "להטיל קנס כספי משמעותי (+80,000€ לתקציב, כושר השחקן -6)",
        effects: [
          { kind: "budget", amount: 80000, timing: "immediate" },
          { kind: "fitness", target: "event_player", amount: -6, timing: "immediate" },
        ],
      },
      {
        id: "internal_talk",
        label_he: "לקיים שיחת נזיפה אישית בלבד (הימור)",
        effects: [
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "השחקן הבין את הטעות ומתמקד באימונים",
                effects: [{ kind: "ability", target: "event_player", amount: 2, timing: "immediate" }],
              },
              {
                probability: 0.4,
                label_he: "המשמעת בסגל נפגעה",
                effects: [{ kind: "fitness", target: "all", amount: -3, timing: "immediate" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "scout_global_tour",
    title_he: "מסע סקאוטינג בדרום אמריקה",
    description_he: "ראש מערך הסקאוטינג מבקש תקציב נסיעות מיוחד לאיתור כישרונות צעירים בטורניר נוער בדרום אמריקה.",
    type: "choice",
    targetPosition: "random",
    options: [
      {
        id: "fund_scout_tour",
        label_he: "לממן את מסע הסקאוטינג (-400,000€, הימור על מציאת תגלית)",
        effects: [
          { kind: "budget", amount: -400000, timing: "immediate" },
          {
            kind: "random_outcome",
            branches: [
              {
                probability: 0.6,
                label_he: "הסקאוט איתר כישרון על יוצא דופן!",
                effects: [{ kind: "ability", target: "event_player", amount: 6, timing: "immediate" }],
              },
              {
                probability: 0.4,
                label_he: "המסע לא הניב מציאות מיוחדות",
                effects: [{ kind: "none" }],
              },
            ],
          },
        ],
      },
      {
        id: "cancel_scout_tour",
        label_he: "לסרב לבקשת התקציב",
        effects: [{ kind: "none" }],
      },
    ],
  },
];

export function getEventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}
