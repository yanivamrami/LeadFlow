/** Domain model. Mirrors the `leads` table in docs/ARCHITECTURE.md §5. */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal_sent'
  | 'won'
  | 'lost';

export type LeadSource = 'website' | 'referral' | 'social_media' | 'phone' | 'other';

/** Fixed 5-item V1 checklist, in PM order. See documents/Lead Qualification Checklist - PM Decisions.md */
export type ChecklistItem = 'interest' | 'need' | 'budget' | 'authority' | 'timeline';

/** Tri-state: "no" and "haven't asked" are different signals. */
export type QualificationAnswer = 'yes' | 'no' | 'unknown';

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  estimatedValue: number;
  lostReason: string | null;
  isDemo: boolean;
  assignedTo: string | null;
  createdAt: Date;
  lastTouchAt: Date | null;
  /** Follow-up reminder; drives the day sheet. */
  reminderDueAt: Date | null;
  reminderTitle: string | null;
  /** Answered items out of CHECKLIST_ITEMS.length. */
  checklistAnswered: number;
  /** Set when the lead was closed or its reminder completed today — shown struck through. */
  clearedToday: string | null;
}

export const STAGE_ORDER: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'won',
  'lost',
];

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  'interest',
  'need',
  'budget',
  'authority',
  'timeline',
];

/**
 * How many silent days earn the drift flag. Product decision, not a visual one:
 * a proposal with no reply goes stale fastest, so it gets the shortest fuse.
 */
export const DRIFT_DAYS: Record<LeadStatus, number> = {
  new: 3,
  contacted: 7,
  qualified: 7,
  proposal_sent: 3,
  won: Number.POSITIVE_INFINITY,
  lost: Number.POSITIVE_INFINITY,
};

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

export interface OpenItem {
  lead: Lead;
  reason: OpenReason;
  /** Days the lead has been waiting; 0 means today. */
  age: number;
}
