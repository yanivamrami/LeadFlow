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
    remindersBadge: 'תזכורות פתוחות',
    skipToContent: 'דלג לתוכן',
  },
  sheet: {
    title: 'היום',
    open: 'פתוחים',
    showAll: 'הצג הכול',
    showLess: 'הצג פחות',
    emptyTitle: 'אין משימות פתוחות היום',
    emptyBody: 'זה הזמן להוסיף ליד חדש, או לעבור על מי ששקט יותר מדי.',
    emptyAction: 'מי שקט מדי?',
    doneToday: 'סגרתם היום',
    explainer:
      'הדף הצהוב הוא היום שלך. כל מה שסגרתם נמחק בקו אדום, והדף מתקצר. דף ריק — סיימתם.',
    dismiss: 'הבנתי',
    snooze: 'דחה ליום',
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
    logActivity: 'רשום פעילות',
    moveTo: 'העבר לשלב',
    snooze: 'דחה ליום',
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
    checklistFilled: 'שאלות ההכשרה סומנו',
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

    checklist: {
      title: 'שאלות הכשרה',
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
    nameHelp: 'מופיע במסך העליון ומשמש כשם העסק.',
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

/** Compact age for the sheet's black tab: היום / יום / יומיים / N ימים. */
export function formatAge(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'יום';
  if (days === 2) return 'יומיים';
  return `${days} ימים`;
}
