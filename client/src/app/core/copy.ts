/**
 * Hebrew UI copy, keyed by feature so a future i18n extraction is cheap.
 * Tone (per PM decisions): stage nudges and empty states may be energetic;
 * checklist questions stay plain and conversational; errors state the fix.
 * No emoji, no sales jargon.
 */

import {
  ActivityType,
  ChecklistItem,
  LeadSource,
  LeadStatus,
  OpenReason,
  QualificationAnswer,
  SortKey,
} from './lead.model';

export const APP_NAME = 'LeadFlow';
export const APP_SUB = 'Manager';

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'ליד חדש',
  contacted: 'יצרנו קשר',
  qualified: 'כשיר',
  proposal_sent: 'נשלחה הצעה',
  won: 'נסגר בהצלחה',
  lost: 'לא יצא לפועל',
};

/** Short forms for the board headers and filter strip, where the column is already context. */
export const STATUS_SHORT: Record<LeadStatus, string> = {
  new: 'חדש',
  contacted: 'קשר',
  qualified: 'כשיר',
  proposal_sent: 'הצעה',
  won: 'נסגר',
  lost: 'לא יצא',
};

/**
 * What the stage *is*, in the words someone who has never used a CRM would use.
 * STATUS_GUIDANCE below says what to do next; this says where you are. A beginner
 * needs both, and "כשיר" tells them neither on its own.
 */
export const STATUS_MEANING: Record<LeadStatus, string> = {
  new: 'מישהו גילה עניין, ואתם עוד לא דיברתם איתו.',
  contacted: 'דיברתם איתם לפחות פעם אחת, אבל עוד לא ברור אם יצא מזה משהו.',
  qualified: 'בדקתם והם באמת מתאימים — שווה להשקיע בהם זמן.',
  proposal_sent: 'שלחתם מחיר או הצעה, ועכשיו הכתובת אצלם.',
  won: 'הם אמרו כן. זה לקוח.',
  lost: 'זה לא קרה. רשמתם למה, וזה מה שיעזור לכם בפעם הבאה.',
};

/** The teaching layer: what this stage means and what to do next. */
export const STATUS_GUIDANCE: Record<LeadStatus, string> = {
  new: 'ליד חדש — הזמן להכשיר! צרו קשר וברַרו אם יש כאן עניין אמיתי.',
  contacted: 'דיברתם. עכשיו כדאי לבדוק אם הם באמת צריכים את מה שאתם מציעים.',
  qualified: 'הליד כשיר. השלב הבא הוא הצעה — כמה שיותר קרוב לשיחה, יותר טוב.',
  proposal_sent: 'הצעה נשלחה. אם לא חוזרים אליכם תוך 3 ימים — הרימו טלפון.',
  won: 'נסגר בהצלחה. שווה לרשום מאיפה הליד הגיע, כדי לדעת מה עובד.',
  lost: 'לא יצא לפועל. רשמו את הסיבה — זה מה שיעזור לכם בפעם הבאה.',
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  website: 'אתר',
  referral: 'המלצה',
  social_media: 'רשתות',
  phone: 'טלפון',
  other: 'אחר',
};

export const OPEN_REASON: Record<OpenReason, string> = {
  reminder_due: 'תזכורת מחכה לך',
  proposal_silent: 'הצעה נשלחה — אין תשובה',
  unqualified: 'ליד חדש — עדיין לא הוכשר',
  drifting: 'הרבה זמן בלי מגע',
};

/**
 * The action the day sheet offers per reason. One primary verb, never a menu.
 *
 * All four log contact today. `unqualified` said "התחל הכשרה" while the checklist was
 * local state; the real checklist lives on the lead-detail screen, so until that exists
 * the honest verb is the one this button actually performs.
 */
export const OPEN_ACTION: Record<OpenReason, string> = {
  reminder_due: 'רשום פעילות',
  proposal_silent: 'חייג',
  unqualified: 'רשום פעילות',
  drifting: 'חייג',
};

/**
 * Sort options, phrased as the question the user is actually asking rather than as a
 * column name. "מי שקט מזמן" beats "לפי מגע אחרון": it says which end of the list you
 * get, so nobody has to guess the direction.
 */
export const SORT_LABEL: Record<SortKey, string> = {
  urgency: 'לפי דחיפות',
  value: 'לפי שווי',
  quiet: 'מי שקט מזמן',
  created: 'לפי תאריך הוספה',
};

export const CHECKLIST_QUESTION: Record<ChecklistItem, string> = {
  interest: 'הם הגיבו והראו עניין אמיתי?',
  need: 'הם באמת צריכים את מה שאתם מציעים?',
  budget: 'יש להם תקציב לזה?',
  authority: 'אתם מדברים עם מי שמחליט?',
  timeline: 'הם רוצים את זה בקרוב, או "מתישהו"?',
};

/**
 * The "why ask?" line behind each question. This is where the teaching lives — the
 * questions themselves stay plain and conversational (PM decisions §7), so the reason
 * sits one tap away instead of cluttering the question.
 */
export const CHECKLIST_WHY: Record<ChecklistItem, string> = {
  interest: 'אם הם לא הגיבו, כל השאר לא באמת משנה.',
  need: 'לקוח שלא צריך את מה שאתם מציעים לא ייסגר, גם אם הוא נחמד.',
  budget: 'עסקאות בלי תקציב נתקעות — עדיף לדעת מוקדם.',
  authority: 'מי שאין לו סמכות לא יכול לאשר, גם כשהוא רוצה.',
  timeline: '"מתישהו" זה בדרך כלל לא. שווה לברר מתי.',
};

/**
 * What each field on the lead form is *for*. The PRD asks for tooltips; the primary device
 * has no hover, so this is the same tap-to-reveal line the checklist's "why ask?" uses —
 * one open at a time, annotation rather than interruption.
 *
 * Every line says why the field earns its keep, not what to type in it. A label already
 * says "טלפון"; a beginner does not know that leaving it empty is allowed, or that `מקור`
 * is the field the insights screen reads back to them weeks later.
 */
export type LeadFieldKey = 'name' | 'company' | 'phone' | 'email' | 'source' | 'value' | 'status';

export const LEAD_FIELD_HELP: Record<LeadFieldKey, string> = {
  name: 'הדבר היחיד שחייב להיות. גם "הבחור מחנות הברזל" עובד — תתקנו כשתדעו.',
  company: 'עוזר להבדיל בין שני אנשים עם אותו שם, ומזכיר לכם עם מי דיברתם.',
  phone: 'לא חובה. אם יש רק טלפון או רק אימייל — זה מספיק כדי להתחיל.',
  email: 'לא חובה. שימושי כשצריך לשלוח הצעה או סיכום שיחה.',
  source: 'מאיפה הליד הגיע. זה השדה שמסך התובנות קורא אחר כך, כדי להראות לכם מאיפה באים הלקוחות שנסגרים.',
  value: 'הערכה גסה מספיקה. משמש כדי לראות כמה כסף פתוח על השולחן — לא הבטחה.',
  status: 'איפה הליד עומד עכשיו. אתם מזיזים אותו כשמשהו קורה, ולכל שלב יש הצעה מה לעשות אחריו.',
};

/** Tri-state answers. The label carries the meaning — colour never does it alone. */
export const ANSWER_LABEL: Record<QualificationAnswer, string> = {
  yes: 'כן',
  no: 'לא',
  unknown: '?',
};

export const ANSWER_ARIA: Record<QualificationAnswer, string> = {
  yes: 'כן',
  no: 'לא',
  unknown: 'עוד לא שאלנו',
};

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: 'שיחה',
  email: 'אימייל',
  meeting: 'פגישה',
  note: 'הערה',
  status_changed: 'שינוי שלב',
};

/** Common reasons a deal dies. Chips, not a closed list — free text always wins. */
export const LOST_REASONS: readonly string[] = [
  'מחיר',
  'תזמון',
  'בחרו במתחרה',
  'לא מתאים',
  'נעלמו',
];

export const COPY = {
  nav: {
    dashboard: 'לוח',
    reminders: 'תזכורות',
    insights: 'תובנות',
    profile: 'פרופיל',
  },
  shell: {
    search: 'חיפוש לפי שם, חברה או טלפון',
    addLead: 'ליד חדש',
    openMenu: 'פעולות על הליד',
    /** The count belongs in the label: a red dot alone tells a screen reader nothing. */
    remindersBadge: (n: number) =>
      n === 0 ? 'תזכורות' : n === 1 ? 'תזכורת אחת מחכה' : `${n} תזכורות מחכות`,
    skipToContent: 'דלג לתוכן',
    /**
     * Leaving is a masthead control, not something buried two screens deep: a user who
     * cannot find the way out does not trust the way in. The label shows from 900px; below
     * that the icon carries it and this string is the accessible name.
     */
    signOut: 'יציאה',
    account: 'החשבון שלי',
  },
  sheet: {
    title: 'היום',
    open: 'פתוחים',
    showAll: 'הצג הכול',
    showLess: 'הצג פחות',
    emptyTitle: 'אין משימות פתוחות היום',
    emptyBody: 'זה הזמן להוסיף ליד חדש, או לעבור על מי ששקט יותר מדי.',
    emptyAction: 'מי שקט מדי?',
    working: 'רגע…',
    doneToday: 'סגרתם היום',
    explainer:
      'הדף הצהוב הוא היום שלך. כל מה שסגרתם נמחק בקו אדום, והדף מתקצר. דף ריק — סיימתם.',
    dismiss: 'הבנתי',
    /**
     * Was `דחה ליום` while the only reachable date was tomorrow. It now opens a chooser,
     * so the label stops promising a specific amount of time.
     */
    snooze: 'דחה',
  },
  register: {
    title: 'כל הלידים',
    all: 'הכול',
    sort: 'מיון',
    sortAria: 'מיון הלידים',
    loadFailedTitle: 'לא הצלחנו לטעון את הלידים',
    loadFailedBody: 'שום דבר לא נמחק — רק הטעינה נכשלה. נסו שוב.',
    retry: 'נסה שוב',
    loading: 'טוען לידים…',
    view: 'תצוגה',
    viewList: 'רשימה',
    viewBoard: 'לוח',
    showing: (shown: number, total: number) => `מוצגים ${shown} מתוך ${total}`,
    showMore: 'הצג עוד',
    end: 'זה הסוף.',
    emptyTitle: 'עוד אין לידים',
    emptyBody: 'הוסיפו את הליד הראשון ונתחיל לעקוב אחריו יחד.',
    noResultsTitle: 'לא נמצאו לידים',
    noResultsBody: 'נסו חיפוש אחר, או נקו את הסינון.',
    clearFilters: 'נקה סינון',
    demoFlag: 'לדוגמה',
    demoNote: 'נוצר אוטומטית כדי שיהיה במה להתנסות · אפשר למחוק',
    /**
     * A filter arriving from the insights screen. It names itself on the register, because
     * a filter the user cannot see is one they will not think to remove — and then the
     * board looks broken.
     */
    sourceFilter: (label: string) => `מקור: ${label}`,
    clearSourceFilter: 'הצג את כל המקורות',
    noContact: 'ללא מגע',
    columns: {
      lead: 'ליד',
      stage: 'שלב',
      source: 'מקור',
      value: 'שווי משוער',
      lastTouch: 'מגע אחרון',
    },
  },
  board: {
    moveTo: 'העבר לשלב',
    dropHere: 'שחרר כאן',
    emptyColumn: 'אין לידים בשלב הזה',
    checklistProgress: (answered: number, total: number) =>
      `${answered} מתוך ${total} שאלות הכשרה`,
  },
  menu: {
    open: 'פתח ליד',
    /** Opens the composer on the lead. It no longer writes anything by itself. */
    logActivity: 'רשום פעילות',
    moveTo: 'העבר לשלב',
    /** Opens the day chooser in this same panel — see `sheet.snooze`. */
    snooze: 'דחה',
    delete: 'מחק ליד',
  },
  nudge: {
    checklist: (open: number) => `${open} שאלות הכשרה עדיין פתוחות`,
    checklistBody: 'למלא עכשיו? אפשר גם אחר כך — הליד עבר בכל מקרה.',
    fillNow: 'מלא עכשיו',
    later: 'לא עכשיו',
  },
  a11y: {
    attentionNow: 'דורש טיפול',
    attentionDrift: 'ללא מגע',
    stageChanged: (name: string, stage: string) => `${name} הועבר לשלב ${stage}`,
    alertRole: 'הודעה חשובה',
    toastRegion: 'הודעות',
  },
  /**
   * Notifications. The popup fires for one thing only — a change that did not persist —
   * so its copy names the record and states what survived.
   */
  notify: {
    dismiss: 'סגור',
    retry: 'נסה שוב',
    close: 'סגירה',
    code: (value: string) => `קוד: ${value}`,
    saveFailedTitle: 'השינוי לא נשמר',
    saveFailedBody: (subject: string) =>
      `${subject} לא עודכן. הנתונים הקודמים נשארו כפי שהיו.`,
    retrying: 'מנסה שוב…',
    retried: 'השינוי נשמר',
    saved: 'נשמר',
    stageMoved: (name: string, stage: string) => `${name} — ${stage}`,
    snoozed: 'נדחה למחר',
    activityLogged: 'הפעילות נרשמה',
    leadDeleted: 'הליד נמחק',
    reminderDone: 'התזכורת סומנה כבוצעה',
    reminderMoved: (when: string) => `התזכורת נדחתה ל${when}`,
    reminderSet: (when: string) => `נקבעה תזכורת ל${when}`,
    reminderRemoved: 'התזכורת נמחקה',
    checklistFilled: 'שאלות ההכשרה סומנו',
  },
  /**
   * The legend. The PRD's audience has never managed leads before, so the interface
   * cannot rely on anyone already knowing what a pipeline stage or a "qualified" lead
   * is. Everything the screen says with colour, texture or a term of art is spelled out
   * here in plain words, in one place, reachable from every screen.
   */
  help: {
    open: 'מה זה אומר?',
    title: 'מה זה אומר?',
    subtitle: 'כל מה שמופיע על המסך, במילים פשוטות.',
    close: 'סגור',

    sheetTitle: 'הדף הצהוב',
    sheetBody:
      'הדף הצהוב למעלה הוא היום שלכם. כל מה שמופיע בו מחכה לכם עכשיו. כשתסיימו משהו הוא יימחק בקו אדום והדף יתקצר — דף ריק אומר שסיימתם להיום.',

    flagsTitle: 'הסימנים בצד של כל שורה',
    flagNow: 'צריך אתכם היום.',
    flagDrift: 'לא דיברתם עם הליד הזה כבר הרבה זמן.',
    flagNone: 'הכול בסדר. אין מה לעשות כרגע.',

    cardsTitle: 'הכרטיסים בלוח',
    cardNow: 'רקע צהוב — הליד הזה מחכה לכם.',
    cardDrift: 'רקע מפוספס — שקט כאן יותר מדי זמן.',
    cardWon: 'מסגרת אדומה — נסגר בהצלחה.',
    cardLost: 'מסגרת מקווקוות וחיוורת — לא יצא לפועל.',

    stagesTitle: 'ששת השלבים',
    stagesLead: 'כל ליד נמצא באחד מהשלבים האלה. אתם מזיזים אותו כשמשהו קורה.',

    colorsTitle: 'הצבעים',
    colorDay: 'צהוב — משהו שמחכה לכם היום.',
    colorRed: 'אדום — סגירה, או פעולה ראשית כמו שמירה.',
    colorInk: 'שחור — הודעות של המערכת ודברים שהמערכת רשמה לבד.',
    colorHatch: 'פספוסים — משהו ששקט או שלא יצא לפועל. לא שגיאה.',

    qualifyTitle: 'מה זה "שאלות הכשרה"?',
    qualifyBody:
      '"הכשרה" זה פשוט לבדוק אם שווה להשקיע בליד הזה — לפני שאתם משקיעים בו שעות. חמש שאלות קצרות: יש עניין אמיתי? הם צריכים את מה שאתם מציעים? יש תקציב? אתם מדברים עם מי שמחליט? ומתי זה אמור לקרות?',
    qualifyNote:
      'אף שאלה לא חוסמת אתכם. אתם יכולים להזיז ליד לכל שלב בכל רגע — השאלות רק עוזרות לדעת איפה אתם עומדים.',
  },
  /**
   * Reminders — §4. The explicit ones: rows a person scheduled, which can be completed
   * and moved. Derived urgency keeps its home on the day sheet; it appears here only as
   * suggestions the user can promote into a dated commitment.
   */
  reminders: {
    title: 'תזכורות',
    subtitle: 'מה קבעתם לעצמכם, ומה כדאי לקבוע.',

    overdue: 'באיחור',
    today: 'היום',
    upcoming: 'בהמשך',
    suggestions: 'בלי תזכורת',
    suggestionsLead: 'לידים שכדאי לקבוע להם משהו, לפני שהם נשכחים.',
    suggestionsCapped: (shown: number, total: number) =>
      `מוצגים ${shown} מתוך ${total}. טפלו באלה, והשאר יופיעו כאן.`,

    complete: 'בוצע',
    reschedule: 'דחה',
    setReminder: 'קבע תזכורת',
    removeReminder: 'מחק תזכורת',
    working: 'רגע…',

    /** The reschedule control, reused on the list, on suggestions and on lead detail. */
    pickTomorrow: 'מחר',
    pick3: 'בעוד 3 ימים',
    pickWeek: 'בעוד שבוע',
    pickDate: 'תאריך',
    pickCancel: 'ביטול',
    pickSave: 'קבע',
    /** min is a hint, not a validator, so the store guards it too and says why. */
    pastDate: 'אי אפשר לקבוע תזכורת לתאריך שעבר.',

    emptyTitle: 'אין תזכורות פתוחות',
    emptyBody: 'הצינור שלכם נקי כרגע. כשתקבעו תזכורת היא תופיע כאן.',
    emptyAction: 'חזרה ללוח',

    loading: 'טוען תזכורות…',
    failedTitle: 'לא הצלחנו לטעון את התזכורות',
    failedBody: 'שום דבר לא נמחק — רק הטעינה נכשלה. נסו שוב.',
    retry: 'נסה שוב',

    /** Fires once per session. States the count and offers the list — nothing else. */
    toastOverdue: (n: number) =>
      n === 1 ? 'תזכורת אחת באיחור.' : `${n} תזכורות באיחור.`,
    toastToday: (n: number) => (n === 1 ? 'תזכורת אחת להיום.' : `${n} תזכורות להיום.`),
    toastAction: 'הצג',
  },
  /**
   * Insights — §5. The PRD's fourth pillar exists to *educate*, so no figure appears
   * without a line saying what it means. A number a beginner cannot interpret is a
   * failure here even when the arithmetic is right.
   */
  insights: {
    title: 'תובנות',
    subtitle: 'מה קורה בפועל בצינור שלכם.',

    totalLabel: 'לידים בסך הכול',
    totalMeaning: (open: number) => `${open} מהם עוד פתוחים ומחכים לכם.`,

    conversionLabel: 'אחוז סגירה',
    /** Names its own denominator on its face — the number is meaningless without it. */
    conversionMeaning: (won: number, decided: number) =>
      `מתוך ${decided} לידים שהגיעו להחלטה, ${won} נסגרו בהצלחה. לידים שעוד פתוחים לא נספרים כאן.`,
    conversionNone: 'עוד לא הגעתם להחלטה על אף ליד, אז אין מה לחשב.',

    openValueLabel: 'שווי שעוד בתהליך',
    openValueMeaning: 'סכום כל הלידים שעדיין לא נסגרו. זו לא הכנסה — זו הזדמנות.',
    wonValueLabel: 'נסגר בהצלחה',
    wonValueMeaning: 'הסכומים שרשמתם על לידים שנסגרו.',

    flowTitle: 'עד לאן הלידים מגיעים',
    flowLead:
      'כמה לידים הגיעו בכלל לכל שלב. השורות מתקצרות משלב לשלב — זה נורמלי, וזה מראה לכם איפה אתם מאבדים אותם.',
    flowUnit: 'לידים',

    sourcesTitle: 'מאיפה הלידים מגיעים',
    sourcesLead: 'מסודר לפי מה שבאמת נסגר, לא לפי מה שהביא הכי הרבה.',
    sourcesCol: { source: 'מקור', total: 'הגיעו', won: 'נסגרו', rate: 'אחוז' },
    sourcesOpen: 'הצג במסך הלידים',

    /** Below the threshold no ratio between groups is shown at all. */
    thinTitle: 'עוד אין מספיק נתונים',
    thinBody: (needed: number) =>
      `כדי להשוות בין מקורות בצורה אמינה צריך עוד ${needed} לידים שהגיעו להחלטה. עד אז המספרים למעלה נכונים, אבל השוואה ביניהם עוד לא תהיה אמיתית.`,

    emptyTitle: 'עוד אין מה למדוד',
    emptyBody: 'הוסיפו כמה לידים, ותוך שבועיים־שלושה יהיה כאן מה לראות.',
    emptyAction: 'ליד חדש',

    loading: 'טוען תובנות…',
    failedTitle: 'לא הצלחנו לטעון את התובנות',
    failedBody: 'שום דבר לא נמחק — רק החישוב נכשל. נסו שוב.',
    retry: 'נסה שוב',
  },
  /** The lead sheet — §3. One surface in two modes, so one copy block. */
  lead: {
    createTitle: 'ליד חדש',
    createSubtitle: 'שם זה כל מה שצריך. את השאר תמלאו כשתדעו.',
    editAria: 'פרטי הליד',
    save: 'שמור',
    saving: 'שומר…',
    cancel: 'ביטול',
    close: 'סגירה',
    created: 'הליד נוסף',
    saved: 'הליד נשמר',

    fields: {
      name: 'שם',
      namePlaceholder: 'שם הליד',
      company: 'חברה',
      phone: 'טלפון',
      email: 'אימייל',
      source: 'מקור',
      value: 'שווי משוער',
      status: 'שלב',
      optional: 'לא חובה',
    },

    /** The per-field help toggle. Same words as the checklist's, because it is the same act. */
    fieldHelpShow: 'למה זה חשוב?',
    fieldHelpHide: 'סגור',
    fieldHelpAria: (field: string) => `למה ${field} חשוב?`,

    /** Name is the only requirement. An error names the fix, never just the rule. */
    nameRequired: 'צריך שם — בלעדיו אין איך לזהות את הליד.',
    emailInvalid: 'האימייל לא נראה תקין. בדקו את הכתובת.',
    valueInvalid: 'שווי צריך להיות מספר.',

    /** Closing. Lost teaches only if the reason is captured; Won must not inflate revenue. */
    lostReason: 'למה זה לא יצא לפועל?',
    lostReasonRequired: 'רשמו סיבה — זה מה שיעזור לכם בפעם הבאה.',
    lostReasonPlaceholder: 'בכמה מילים',
    wonAmount: 'הסכום הסופי',
    wonAmountHint: 'זה המספר שיופיע בתובנות. שנו אותו אם סגרתם אחרת.',

    /** The follow-up, read and managed here — the one save commits it with everything else. */
    reminder: 'תזכורת',
    reminderNone: 'אין תזכורת פתוחה לליד הזה.',
    reminderSet: 'קבע תזכורת',
    reminderChange: 'שנה תאריך',
    reminderClear: 'בטל תזכורת',
    /** Says the choice is not written yet, because on this sheet nothing is until save. */
    reminderPending: 'יישמר בשמירה',

    checklist: {
      title: 'שאלות הכשרה',
      /** The term is jargon on first contact, so the section says what it is for. */
      lead: 'חמש שאלות שעוזרות לדעת אם שווה להשקיע בליד הזה. אף אחת מהן לא חוסמת אתכם.',
      progress: (answered: number, total: number) => `${answered} מתוך ${total}`,
      why: 'למה שואלים?',
      hideWhy: 'הסתר',
    },

    timeline: {
      title: 'מה קרה עד עכשיו',
      empty: 'עוד לא נרשמה פעילות כאן.',
      emptyHint: 'כל שיחה, אימייל או הערה שתרשמו יופיעו כאן עם התאריך.',
      showAll: (total: number) => `הצג הכול (${total})`,
      showLess: 'הצג פחות',
      systemEntry: 'נרשם אוטומטית',
    },

    composer: {
      label: 'הוסיפו הערה',
      placeholder: 'מה קרה? מה הצעד הבא?',
      type: 'סוג',
    },

    /** Destructive, so it names the blast radius before asking. */
    delete: 'מחק ליד',
    deleteConfirm: (name: string, activities: number) =>
      activities > 0
        ? `${name} וכל ${activities} הפעילויות שלו יימחקו. אין ביטול.`
        : `${name} יימחק. אין ביטול.`,
    deleteYes: 'מחק',
    deleteNo: 'חזרה',

    /** The unsaved guard: in-place in the footer, never a modal over a modal. */
    dirtyTitle: 'לא שמרתם.',
    dirtyBody: 'לצאת בלי לשמור?',
    dirtyLeave: 'צא',
    dirtyStay: 'חזרה',
  },
  auth: {
    emailLabel: 'אימייל',
    passwordLabel: 'סיסמה',
    showPassword: 'הצג סיסמה',
    hidePassword: 'הסתר סיסמה',
    working: 'רגע…',
    signIn: {
      title: 'כניסה',
      submit: 'כניסה ללוח',
      forgot: 'שכחתם את הסיסמה?',
      noAccount: 'עוד אין לכם חשבון?',
      createOne: 'פתחו חשבון',
    },
    signUp: {
      title: 'פתיחת חשבון',
      nameLabel: 'איך קוראים לכם?',
      nameHelp: 'השם הזה יופיע בלוח וגם ישמש כשם העסק. אפשר לשנות אחר כך.',
      passwordHelp: 'לפחות 8 תווים.',
      submit: 'פתחו לי לוח',
      nextTitle: 'מה קורה אחרי',
      nextBody:
        'נפתח לכם לוח לידים משלכם, ובתוכו ליד אחד לדוגמה כדי שיהיה במה להתנסות. אפשר למחוק אותו בכל רגע.',
      haveAccount: 'כבר יש לכם חשבון?',
      signInInstead: 'התחברו',
    },
    reset: {
      title: 'איפוס סיסמה',
      lead: 'נשלח לכם קישור לבחירת סיסמה חדשה. הקישור תקף לשעה אחת ולשימוש אחד.',
      submit: 'שלחו קישור',
      sentTitle: 'הקישור נשלח',
      /** Never confirms whether an address is registered — that is an account-enumeration leak. */
      sentBody: (email: string) =>
        `אם ${email} רשום אצלנו, הקישור בדרך. שווה לבדוק גם בתיקיית הספאם.`,
      resend: 'שליחה חוזרת',
      back: 'חזרה לכניסה',
    },
    newPassword: {
      title: 'סיסמה חדשה',
      lead: 'בחרו סיסמה חדשה, ואנחנו מכניסים אתכם ישר ללוח.',
      label: 'סיסמה חדשה',
      confirmLabel: 'שוב, לוודא',
      submit: 'שמרו והיכנסו',
      expiredTitle: 'הקישור כבר לא תקף',
      expiredBody: 'קישורי איפוס פגים אחרי שעה ואחרי שימוש אחד. אפשר לבקש חדש.',
      requestNew: 'בקשו קישור חדש',
      changed: 'הסיסמה עודכנה',
    },
    validation: {
      nameRequired: 'צריך שם — הוא מופיע בלוח.',
      emailRequired: 'צריך אימייל.',
      emailInvalid: 'האימייל לא נראה תקין.',
      passwordRequired: 'צריך סיסמה.',
      passwordShort: 'לפחות 8 תווים.',
      mismatch: 'שתי הסיסמאות לא זהות.',
    },
  },
  /** Account settings. Rare, deliberate visits — so every row states its consequence. */
  profile: {
    title: 'פרופיל',
    identity: 'הפרטים שלכם',
    nameLabel: 'שם',
    nameHelp: 'מופיע במסך העליון.',
    /**
     * The business name is the tenant's, not the user's. It was set once at signup and had
     * no way back — a typo lived forever, and a renamed business had nowhere to say so.
     */
    businessLabel: 'שם העסק',
    businessHelp: 'איך העסק נקרא. משמש כשיצטרפו אליכם אנשים נוספים.',
    businessSaved: 'שם העסק עודכן',
    businessRequired: 'צריך שם לעסק.',
    emailLabel: 'אימייל',
    emailNote: 'החלפת אימייל דורשת אישור בדואר, ואין עדיין שליחת מיילים. בקרוב.',
    save: 'שמירה',
    saved: 'השם עודכן',
    security: 'סיסמה',
    currentPassword: 'הסיסמה הנוכחית',
    newPassword: 'סיסמה חדשה',
    confirmPassword: 'שוב, לוודא',
    changePassword: 'עדכון סיסמה',
    passwordChanged: 'הסיסמה עודכנה',
    appearance: 'תצוגה',
    themeLabel: 'ערכת צבע',
    themeLight: 'בהיר',
    themeDark: 'כהה',
    themeSystem: 'לפי המכשיר',
    session: 'החשבון',
    signOut: 'יציאה',
    signedOut: 'יצאתם',
    danger: 'מחיקת חשבון',
    dangerBody: 'מוחק את החשבון ואת כל מה שנשמר בו. אין שחזור.',
    dangerAction: 'למחיקת החשבון',
    delete: {
      title: 'מחיקת החשבון',
      lead: 'זה סופי. אחרי המחיקה אין דרך לשחזר את הנתונים — גם לא דרכנו.',
      whatGoes: 'מה נמחק',
      leads: (n: number) => `${n} לידים`,
      activities: (n: number) => `${n} רישומי פעילות`,
      reminders: (n: number) => `${n} תזכורות`,
      account: 'החשבון עצמו והכניסה אליו',
      counting: 'סופרים…',
      confirmLabel: 'הבנתי שאי אפשר לשחזר',
      submit: 'מחקו את החשבון',
      cancel: 'ביטול',
      done: 'החשבון נמחק',
    },
  },
  /** Offline is a state: the banner states it, and every blocked write says so at the point of action. */
  offline: {
    banner: 'אין חיבור לרשת — שינויים לא יישמרו',
    blocked: 'אין חיבור — השינוי לא בוצע',
    back: 'החיבור חזר',
  },
  /**
   * Errors state the fact and the fix — no blame, no jargon, and never a raw
   * PostgREST code. SupabaseService maps every server error onto one of these.
   */
  errors: {
    generic: 'משהו השתבש. נסו שוב.',
    offline: 'אין חיבור לרשת. בדקו את החיבור ונסו שוב.',
    sessionExpired: 'ההתחברות פגה. התחברו שוב.',
    signInFailed: 'המייל או הסיסמה לא נכונים.',
    emailNotConfirmed: 'המייל עדיין לא אושר. בדקו את תיבת הדואר.',
    emailTaken: 'המייל הזה כבר רשום. נסו להתחבר.',
    weakPassword: 'הסיסמה קצרה מדי. נדרשים לפחות 8 תווים.',
    notAllowed: 'אין לכם הרשאה לפעולה הזו.',
    notFound: 'הרשומה לא נמצאה. ייתכן שנמחקה.',
    duplicate: 'הרשומה כבר קיימת.',
    tooManyRequests: 'יותר מדי נסיונות. המתינו רגע ונסו שוב.',
    samePassword: 'זו הסיסמה הנוכחית. בחרו אחת אחרת.',
    wrongPassword: 'הסיסמה הנוכחית לא נכונה.',
    recoveryInvalid: 'הקישור לא תקף יותר. בקשו קישור חדש.',
    deleteFailed: 'המחיקה לא הושלמה. הנתונים עדיין כאן — נסו שוב.',
  },
} as const;

/* ---------- formatting ---------- */

const ILS = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

/** ₪12,500 in lists; over a million compacts to ₪1.2מ׳ so columns stay narrow. */
export function formatValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = (value / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `₪${millions}מ׳`;
  }
  return ILS.format(value);
}

const DAY_MONTH = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' });

export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Relative inside a week, absolute after — with correct Hebrew dual for two days. */
export function formatWhen(date: Date | null, now: Date): string {
  if (!date) return '—';
  const days = daysBetween(date, now);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  if (days <= 7) return `לפני ${days} ימים`;
  return DAY_MONTH.format(date);
}

/**
 * Future-facing sibling of formatWhen. That one is past-tense ("אתמול", "לפני יומיים")
 * and cannot be reused for a due date without reading as though the work already happened.
 * Overdue is stated as a fact, never as a scolding.
 */
export function formatDue(date: Date, now: Date): string {
  const days = daysBetween(date, now);
  if (days > 0) {
    if (days === 1) return 'באיחור יום';
    if (days === 2) return 'באיחור יומיים';
    return `באיחור ${days} ימים`;
  }
  if (days === 0) return 'היום';
  const ahead = -days;
  if (ahead === 1) return 'מחר';
  if (ahead === 2) return 'בעוד יומיים';
  if (ahead <= 7) return `בעוד ${ahead} ימים`;
  return DAY_MONTH.format(date);
}

/** Compact age for the sheet's black tab: היום / יום / יומיים / N ימים. */
export function formatAge(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'יום';
  if (days === 2) return 'יומיים';
  return `${days} ימים`;
}
