import {
  ActionInput,
  AutomationAction,
  AutomationTrigger,
  RunStatus,
  TriggerInput,
} from '../../core/automations.store';

/**
 * Local copy for the automations feature (SCREENS 9.2, 9.3, 9.4) — this agent does not own
 * `core/copy.ts` (documents/CONTRACT-stages.md §4), so every Hebrew string this screen
 * needs, including the sentence-builder that is the whole point of 9.2/9.3, lives here.
 */
export const COPY_AUTOMATIONS = {
  sectionTitle: 'אוטומציות על השלב הזה',
  sectionLead:
    'כלל אומר "כשליד מגיע לכאן, עשו את זה" — בלי לגעת בליד עצמו עד שהתנאי מתקיים.',

  loading: 'טוען כללים…',
  loadFailedTitle: 'לא הצלחנו לטעון את הכללים',
  loadFailedBody: 'שום דבר לא נמחק — רק הטעינה נכשלה.',
  retry: 'נסה שוב',
  empty: 'אין עדיין כללים על השלב הזה.',

  addToggle: 'הוסיפו כלל',
  addCancel: 'ביטול',
  save: 'שמור כלל',
  working: 'רגע…',
  editToggle: 'עריכה',
  deleteAct: 'מחיקה',
  deleteConfirm: (sentence: string) => `למחוק את הכלל הזה? "${sentence}"`,
  deleteConfirmAct: 'כן, מחקו',
  deleteCancelAct: 'ביטול',

  enabledLabel: 'כלל פעיל',
  suspendedBadge: 'מושהה',
  suspendedReason: 'מושהה כי השלב שלו אורכב — הפעלה מחדש היא צעד מכוון, לא אוטומטי.',

  triggerLabel: 'מתי',
  triggerEnters: 'כשליד מגיע לשלב הזה',
  triggerIdle: 'כשליד נשאר בשלב הזה בלי תזוזה',
  idleDaysLabel: 'כמה ימים בלי תזוזה',
  idleDaysHelp: 'הכלל יבדוק אחרי כמה ימים, ורק אם הליד עדיין כאן.',

  actionLabel: 'מה לעשות',
  actionName: {
    set_reminder: 'קביעת תזכורת',
    assign_member: 'שיוך לחבר צוות',
    add_note: 'הוספת הערה',
    suggest_advance: 'הצעת מעבר שלב',
    webhook: 'שליחת webhook',
  } as Record<AutomationAction, string>,

  reminderDaysLabel: 'בעוד כמה ימים',
  reminderTitleLabel: 'כותרת (רשות)',
  reminderTitlePlaceholder: 'למשל: להתקשר ולבדוק מה קורה',

  assignMemberLabel: 'למי לשייך',
  assignMemberChoose: 'בחרו חבר צוות',
  assignMemberSingleWarning:
    'יש כרגע רק חבר צוות אחד, אז הכלל הזה כמעט תמיד ישייך את הליד אליו — עדיין שווה להגדיר, לקראת היום שיצטרפו עוד אנשים.',
  assignMemberEmptyWarning: 'אין עדיין חברי צוות לבחור מהם.',
  membersLoadFailed: 'לא הצלחנו לטעון את רשימת חברי הצוות.',

  noteBodyLabel: 'תוכן ההערה',
  noteBodyPlaceholder: 'מה כדאי לכתוב על הליד?',

  advanceStageLabel: 'להציע מעבר לאיזה שלב',
  advanceStageChoose: 'בחרו שלב',
  advanceStageNote:
    'הכלל רק מציע את המעבר — הוא נכתב כהערה על הליד, ואף אחד לא מזיז את הליד בשבילכם.',

  webhookUrlLabel: 'כתובת ה-webhook',
  webhookUrlPlaceholder: 'https://…',
  webhookUrlHelp: 'רק כתובות HTTPS מתקבלות, ולא כתובות פנימיות או מקומיות.',
  webhookSecretTitle: 'מפתח החתימה הסודי',
  webhookSecretWarning:
    'זו הפעם היחידה שהמפתח הזה יוצג. העתיקו ושמרו אותו עכשיו — אחר כך אין דרך לראות אותו שוב, רק ליצור כלל חדש.',
  webhookSecretCopy: 'העתקה',
  webhookSecretCopied: 'המפתח הועתק.',
  webhookSecretDone: 'שמרתי, סגרו',
  // The sender landed (20260804091200), so the earlier "nothing will be sent" warning would
  // now be false. What is still worth saying is where the key lives and that it is signed.
  webhookPendingNote:
    'כל בקשה נשלחת חתומה, כדי שהצד השני יוכל לוודא שהיא באמת מכם. את מפתח החתימה נראה פעם אחת בלבד — שמרו אותו במקום בטוח.',

  restatementLabel: 'זה מה שהכלל הזה יעשה',

  runLogToggle: 'יומן הרצות',
  runLogTitle: 'יומן ההרצות — 50 האחרונות',
  runLogLoading: 'טוען הרצות…',
  runLogLoadFailedTitle: 'לא הצלחנו לטעון את יומן ההרצות',
  runLogLoadFailedBody: 'זה כולל את הרגע היחיד שבו תגלו אם ה-webhook נכשל — כדאי לנסות שוב.',
  runLogEmpty: 'עוד לא רץ כלום על הכלל הזה.',
  runLogEmptyDisabled: 'הכלל הזה כבוי, ולכן לא ירוץ עד שיופעל מחדש.',

  runStatus: {
    queued: 'ממתין',
    sending: 'נשלח כרגע',
    done: 'בוצע',
    failed: 'נכשל',
    skipped: 'דולג',
  } as Record<RunStatus, string>,

  runLeadFallback: 'ליד שנמחק',

  dryRunToggle: 'בדיקה',
  dryRunTitle: 'בדיקה (סימולציה) — לא שולחת ולא כותבת כלום',
  dryRunPickLead: 'על איזה ליד לבדוק?',
  dryRunChoose: 'בחרו ליד',
  dryRunLeadsLoadFailed: 'לא הצלחנו לטעון לידים לבדיקה.',
  dryRunRun: 'הרץ בדיקה',
  dryRunDisclaimer:
    'זו סימולציה בצד המסך בלבד: שום דבר לא נשלח, שום ליד לא משתנה, ולא נכתבת שורה ביומן ההרצות. היא בודקת רק את מה שהכלל היה אומר לעשות — לא את הביצוע עצמו בשרת.',
  dryRunResult: (leadName: string, sentence: string) =>
    `אילו "${leadName}" היה עומד בתנאי הזה עכשיו: ${sentence}`,

  cancel: 'ביטול',
} as const;

/** "יום" / "יומיים" / "N ימים" — the same dual-form Hebrew needs everywhere in this
 *  product (DESIGN-SYSTEM.md §11: "Hebrew dual is handled explicitly"). */
export function dayPhrase(n: number): string {
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return `${n} ימים`;
}

export const TRIGGER_OPTIONS: readonly AutomationTrigger[] = ['lead_enters_stage', 'lead_idle_in_stage'];
export const ACTION_OPTIONS: readonly AutomationAction[] = [
  'set_reminder',
  'assign_member',
  'add_note',
  'suggest_advance',
  'webhook',
];

/** What `describeAutomation` needs — the trigger/action/config shape shared by a saved
 *  `Automation` and a still-being-built draft in the editor, so the same sentence can be
 *  shown live while the user is choosing and again after the rule is saved. */
export type AutomationDescriptor = TriggerInput & ActionInput;

function triggerPhrase(rule: TriggerInput): string {
  if (rule.trigger === 'lead_enters_stage') return COPY_AUTOMATIONS.triggerEnters;
  return `${COPY_AUTOMATIONS.triggerIdle} ${dayPhrase(rule.idleDays)}`;
}

function actionPhrase(
  rule: ActionInput,
  resolveStageName: (id: string) => string | null,
  resolveMemberName: (id: string) => string | null,
): string {
  switch (rule.action) {
    case 'set_reminder': {
      const { days, title } = rule.config;
      const base = days === 1 ? 'קבעו תזכורת ליום אחד' : days === 2 ? 'קבעו תזכורת ליומיים' : `קבעו תזכורת ל-${days} ימים`;
      return title ? `${base}, בשם "${title}"` : base;
    }
    case 'assign_member': {
      const name = resolveMemberName(rule.config.userId);
      return `שייכו את הליד ל${name ?? 'חבר הצוות שנבחר'}`;
    }
    case 'add_note':
      return `הוסיפו לליד הערה: "${rule.config.body}"`;
    case 'suggest_advance': {
      const name = resolveStageName(rule.config.stageId);
      return `הציעו להעביר את הליד לשלב "${name ?? '—'}" (בלי להעביר אותו בפועל)`;
    }
    case 'webhook':
      return `שלחו קריאת webhook לכתובת ${rule.config.url}`;
  }
}

/**
 * The full-sentence restatement that is the primary content of a rule row (SCREENS 9.2)
 * and the thing the editor ends on before save (9.3): "כשליד מגיע לשלב הזה — קבע תזכורת
 * ל-3 ימים." A rule the user cannot read back in one sentence is a rule they will not
 * trust, so this function — not the raw trigger/action/config — is what the UI shows.
 *
 * `resolveStageName` / `resolveMemberName` take an id and answer a display name or null;
 * the caller supplies them from whatever it already has in scope (the stage list, the
 * member list) rather than this function reaching for a store.
 */
export function describeAutomation(
  rule: AutomationDescriptor,
  resolveStageName: (id: string) => string | null,
  resolveMemberName: (id: string) => string | null,
): string {
  return `${triggerPhrase(rule)} — ${actionPhrase(rule, resolveStageName, resolveMemberName)}.`;
}
