import { StageKind, SwatchName } from '../../core/lead.model';
import { NewStageInput } from '../../core/stages.store';

/**
 * Local copy for the stage manager (SCREENS 9.1). `core/copy.ts` already carries a
 * `COPY.stages` block — title, subtitle, add-stage label, archive verbs and notices,
 * reorder/rename/create toasts — and this screen reads that block directly (`copy.stages.*`
 * in the templates). This file holds only what that block does not: field labels and
 * helper text, the kind lock explanation, swatch names, and the add-stage template picker.
 *
 * This agent (W2-B, documents/CONTRACT-stages.md §4) does not own `core/copy.ts`. Reported
 * as a follow-up in the hand-off: fold this block into `COPY.stages` once an owner of that
 * file can take the change, so the stage manager's strings live in the one place every
 * other screen's do.
 */
export const COPY_STAGES = {
  loading: 'טוען את השלבים…',
  loadFailedTitle: 'לא הצלחנו לטעון את השלבים',
  loadFailedBody: 'שום דבר לא נמחק — רק הטעינה נכשלה. נסו שוב.',
  retry: 'נסה שוב',
  emptyTitle: 'אין שלבים פתוחים כרגע',
  emptyBody: 'זה לא אמור לקרות בפייפליין תקין — נסו לרענן, ואם זה נמשך הוסיפו שלב חדש.',

  reorderKeyboardHint:
    'אפשר גם עם מקלדת: התמקדו בידית הגרירה, רווח כדי להרים, חצים כדי להזיז, ורווח שוב כדי להניח.',

  kindLabel: { open: 'פתוח', won: 'זכייה', lost: 'אי-הצלחה' } as Record<StageKind, string>,
  kindLockedWon:
    'אפשר לשנות את השם, אבל לא את הסוג — זה תמיד יישאר שלב הזכייה של הפייפליין.',
  kindLockedLost:
    'אפשר לשנות את השם, אבל לא את הסוג — זה תמיד יישאר שלב האי-הצלחה של הפייפליין.',

  nameLabel: 'שם השלב',
  shortNameLabel: 'שם קצר',
  shortNameHelp: 'מוצג בעמודות הלוח ובצ׳יפים של הסינון. משאירים ריק כדי להשתמש בשם המלא.',

  swatchLabel: 'צבע',
  swatchLocked: 'הצבע קבוע לשלבים סגורים — הזכייה תמיד באדום, האי-הצלחה תמיד מקווקוות.',
  swatchName: {
    chalk: 'גיר',
    sky: 'שמיים',
    moss: 'אזוב',
    amber: 'ענבר',
    plum: 'שזיף',
    clay: 'חימר',
    slate: 'צפחה',
    sand: 'חול',
  } as Record<SwatchName, string>,

  driftLabel: 'ימים עד סימון כשקט',
  driftHelp:
    'כמה ימים בלי מגע לפני שליד בשלב הזה יסומן כשקט מדי. השאירו ריק אם השלב הזה אף פעם לא נחשב שקט.',

  expectsReplyLabel: 'מחכים לתשובה מהצד השני',
  expectsReplyHelp:
    'סמנו כשבשלב הזה התור בלקוח. ליד ששקט כאן יסומן בדיוק כמו בשלב "נשלחה הצעה" המובנה.',

  meaningLabel: 'משמעות השלב',
  meaningHelp: 'המשפט שמסביר לאן הליד הגיע — איפה הוא עומד עכשיו.',
  meaningPlaceholder: 'איפה הליד עומד כשהוא כאן?',

  guidanceLabel: 'מה לעשות עכשיו',
  guidanceHelp: 'ההצעה שתראו כשליד נמצא בשלב הזה.',
  guidancePlaceholder: 'מה כדאי לעשות כשליד מגיע לשלב הזה?',

  leadCount: (n: number) =>
    n === 0 ? 'אין לידים בשלב הזה כרגע' : n === 1 ? 'ליד אחד בשלב הזה' : `${n} לידים בשלב הזה`,
  leadCountUnknown: 'סופרים לידים…',
  leadCountFailed: 'לא הצלחנו לספור את הלידים בכל שלב',

  dragHandleLabel: (name: string) => `גררו כדי לשנות את מיקומו של ${name} בפייפליין`,
  dropHere: 'כאן ינחת השלב',

  chooseDestination: 'בחרו שלב',
  willMove: (n: number, dest: string) =>
    n === 1 ? `הליד יעבור ל"${dest}".` : `${n} הלידים יעברו ל"${dest}".`,
  archiveConfirm: (name: string) =>
    `לארכב את "${name}"? הוא ייעלם מהלוח ומהסינון, אבל היסטוריית הלידים ממשיכה להצביע עליו.`,
  cancel: 'ביטול',
  working: 'רגע…',

  archivedNote:
    'שלבים בארכיון אפשר לראות כאן, אבל לא להחזיר לפעילות בשלב הזה של המוצר.',

  addTitle: 'איזה שלב להוסיף?',
  addLead: 'כל תבנית מגיעה עם הסבר מוכן למתחילים. תמיד אפשר לערוך את המילים אחר כך.',
  customLabel: 'שלב משלי',
  customNameLabel: 'שם השלב',
  customNameRequired: 'צריך שם לשלב.',
  addConfirm: 'הוסף שלב',
  addCancel: 'ביטול',
} as const;

/**
 * The template picker's filled options (documents/PLAN-stages.md §4.4) — a stage the user
 * invents has no teaching copy, and this product's whole positioning is guided-for-
 * beginners, so every option here except "שלב משלי" (built directly in `AddStage`) arrives
 * with `meaning`, `guidance`, a sensible `driftDays` and `expectsReply` already set.
 *
 * `meaning` answers "where am I"; `guidance` answers "what do I do next" — the same split
 * `STATUS_MEANING` / `STATUS_GUIDANCE` drew for the six seeded stages.
 */
export const STAGE_TEMPLATES: readonly NewStageInput[] = [
  {
    name: 'ממתין להצעה',
    shortName: 'בהכנה',
    swatch: 'sand',
    meaning: 'הליד הוכשר וממתין שתכינו לו הצעת מחיר או הצעה מסודרת.',
    guidance: 'הכינו הצעה ברורה ושלחו אותה בהקדם — עניין של לקוח לא ממתין לנצח.',
    driftDays: 3,
    expectsReply: false,
  },
  {
    name: 'ממתין לחתימה',
    shortName: 'חתימה',
    swatch: 'plum',
    meaning: 'סיכמתם בעל פה, או שלחתם חוזה, וממתינים שהלקוח יחתום.',
    guidance: 'עקבו אחרי מסמך החתימה, ותזכירו ללקוח בעדינות אם עובר יותר מדי זמן.',
    driftDays: 3,
    expectsReply: true,
  },
  {
    name: 'בהמתנה מהלקוח',
    shortName: 'ממתין',
    swatch: 'sky',
    meaning: 'שלחתם משהו — הצעה, מסמך או שאלה — וממתינים לתשובה מהלקוח.',
    guidance: 'אם עובר יותר מדי זמן בלי תשובה, שווה להתקשר ולבדוק מה קורה.',
    driftDays: 5,
    expectsReply: true,
  },
  {
    name: 'לא בזמן הנכון',
    shortName: 'לא הזמן',
    swatch: 'slate',
    meaning:
      'הלקוח מעוניין, אבל משהו דוחה את הקידמה כרגע — תקציב, עונתיות או תזמון פנימי.',
    guidance: 'קבעו תזכורת לחזור אליו בזמן שסיכמתם, כדי שלא ייפול בין הכיסאות.',
    driftDays: 14,
    expectsReply: false,
  },
];
