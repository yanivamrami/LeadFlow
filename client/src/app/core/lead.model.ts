/** Domain model. Mirrors the `leads` table in docs/ARCHITECTURE.md §5. */

export type LeadSource = 'website' | 'referral' | 'social_media' | 'phone' | 'whatsapp' | 'other';

/** Every value the union permits, for validating untrusted input (e.g. `?source=`). */
export const LEAD_SOURCES: readonly LeadSource[] = [
  'website',
  'referral',
  'social_media',
  'phone',
  'whatsapp',
  'other',
];

/**
 * Activity kinds. `status_changed` is written only by the DB trigger — the client
 * never sends it, which is what makes the timeline's system entries trustworthy.
 */
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'status_changed';

/** The four a person can choose in the composer. */
export const NOTE_TYPES: readonly ActivityType[] = ['call', 'email', 'meeting', 'note'];

/** Fixed 5-item V1 checklist, in PM order. See documents/Lead Qualification Checklist - PM Decisions.md */
export type ChecklistItem = 'interest' | 'need' | 'budget' | 'authority' | 'timeline';

/** Tri-state: "no" and "haven't asked" are different signals. */
export type QualificationAnswer = 'yes' | 'no' | 'unknown';

/** One entry in a lead's history. `status_changed` rows are written by a DB trigger. */
export interface Activity {
  id: string;
  type: ActivityType;
  body: string | null;
  occurredAt: Date;
}

/**
 * Answers the user has actually given. An absent key means "not asked", which is a
 * different signal from `unknown` ("asked, they don't know") — the distinction the
 * whole tri-state exists to preserve.
 */
export type ChecklistAnswers = Partial<Record<ChecklistItem, QualificationAnswer>>;

/**
 * What a stage row *is*, underneath whatever the user has named it. Every product rule
 * that used to key off the six-status enum now keys off `kind` instead — conversion,
 * the lost-reason requirement, the won-amount confirmation, the attention engine — so a
 * tenant can rename `נסגר בהצלחה` to `לקוח` and change no arithmetic at all. See
 * documents/PLAN-stages.md §1. A tenant always has exactly one `won` and one `lost`
 * stage, and at least one `open` stage.
 */
export type StageKind = 'open' | 'won' | 'lost';

/**
 * One of a fixed set of eight pre-contrast-checked colour pairs (theme/tokens.css). Not
 * a free colour picker: the שלט־שוק palette is deliberately tight, and an arbitrary
 * choice would both clash with it and risk reintroducing a contrast failure the design
 * system already paid for once.
 */
export type SwatchName =
  | 'chalk'
  | 'sky'
  | 'moss'
  | 'amber'
  | 'plum'
  | 'clay'
  | 'slate'
  | 'sand';

/**
 * A pipeline stage — a per-tenant row a user can rename, reorder, add and archive, not a
 * hardcoded union anymore. See core/stages.store.ts, which owns loading and writing these.
 */
export interface Stage {
  id: string;
  name: string;
  /** Board headers and filter chips, where the column is already context. Falls back to `name`. */
  shortName: string | null;
  position: number;
  kind: StageKind;
  swatch: SwatchName;
  /** Where you are. The teaching layer that used to live in STATUS_MEANING. */
  meaning: string | null;
  /** What to do next. The teaching layer that used to live in STATUS_GUIDANCE. */
  guidance: string | null;
  /** Days of silence before the lead counts as drifting. Null = never drifts. */
  driftDays: number | null;
  /** "The ball is in their court." Generalises what used to be `status === 'proposal_sent'`. */
  expectsReply: boolean;
  /** Seeded by signup. Blocks nothing except deleting the won/lost pair — the words are the user's. */
  isSystem: boolean;
  /** Archived, never deleted: a lead's history still resolves through an archived stage. */
  archivedAt: Date | null;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stage: Stage;
  estimatedValue: number;
  lostReason: string | null;
  isDemo: boolean;
  assignedTo: string | null;
  createdAt: Date;
  lastTouchAt: Date | null;
  /** Follow-up reminder; drives the day sheet. */
  reminderDueAt: Date | null;
  reminderTitle: string | null;
  /** Answered items out of CHECKLIST_ITEMS.length. Derived from `answers`. */
  checklistAnswered: number;
  answers: ChecklistAnswers;
  /** Newest first. Drives the lead sheet's timeline. */
  activities: Activity[];
  /** Set when the lead was closed or its reminder completed today — shown struck through. */
  clearedToday: string | null;
}

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  'interest',
  'need',
  'budget',
  'authority',
  'timeline',
];

/** Rows the day sheet shows before collapsing the rest behind "show all". */
export const OPEN_ITEMS_CAP = 3;

export type Attention = 'now' | 'drift' | 'none';

/**
 * Register sort. `urgency` is the default because it is the only one that answers
 * "what should I do next" — the others answer questions the user asks deliberately.
 */
export type SortKey = 'urgency' | 'value' | 'quiet' | 'created';

export const SORT_KEYS: readonly SortKey[] = ['urgency', 'value', 'quiet', 'created'];

/** Why a lead is on the day sheet. Drives the sheet's one-line reason. */
export type OpenReason = 'reminder_due' | 'proposal_silent' | 'unqualified' | 'drifting';

/** What the lead sheet sends on save. One shape for both create and edit. */
export interface LeadDraft {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stageId: string;
  estimatedValue: number | null;
  lostReason: string | null;
}

/**
 * What the sheet intends for the lead's follow-up. Three states, distinguishable:
 * `keep` touches nothing (most saves), `set` creates or reschedules, `clear` completes
 * every open reminder on the lead.
 */
export type ReminderAction = 'keep' | 'set' | 'clear';

/** The optional extras a save may carry alongside the fields. */
export interface LeadSaveExtras {
  note: string | null;
  noteType: ActivityType;
  /** Only the items the user touched in this session. */
  answers: ChecklistAnswers;
  reminderAction: ReminderAction;
  reminderDue: Date | null;
  reminderTitle: string | null;
}

export interface OpenItem {
  lead: Lead;
  reason: OpenReason;
  /** Days the lead has been waiting; 0 means today. */
  age: number;
}
