/**
 * Hebrew UI copy, keyed by feature so a future i18n extraction is cheap.
 * Tone (per PM decisions): stage nudges and empty states may be energetic;
 * checklist questions stay plain and conversational; errors state the fix.
 * No emoji, no sales jargon.
 */

import { LeadSource, LeadStatus, OpenReason, ChecklistItem } from './lead.model';

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

/** The action the day sheet offers per reason. One primary verb, never a menu. */
export const OPEN_ACTION: Record<OpenReason, string> = {
  reminder_due: 'רשום פעילות',
  proposal_silent: 'חייג',
  unqualified: 'התחל הכשרה',
  drifting: 'חייג',
};

export const CHECKLIST_QUESTION: Record<ChecklistItem, string> = {
  interest: 'הם הגיבו והראו עניין אמיתי?',
  need: 'הם באמת צריכים את מה שאתם מציעים?',
  budget: 'יש להם תקציב לזה?',
  authority: 'אתם מדברים עם מי שמחליט?',
  timeline: 'הם רוצים את זה בקרוב, או "מתישהו"?',
};

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
    sort: 'מיון: לפי דחיפות',
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
