import { OPEN_ACTION, OPEN_REASON, STATUS_GUIDANCE, daysBetween } from './copy';
import { DRIFT_DAYS, Lead, OpenReason } from './lead.model';

/**
 * The rules behind "what should I do with this lead".
 *
 * Pure functions rather than store methods, for the reason `reminder-digest.ts` gives: every
 * branch here is a product decision somebody could quietly regress, and all of them are
 * testable without a Supabase client or a component in the room.
 *
 * They also had to leave the store to be usable at all. `openReason` was private on
 * `LeadsStore`, so the one screen where a beginner asks "what now?" — the lead sheet — could
 * not reach the answer the day sheet was already computing.
 */

/** Days since anyone touched this lead. Creation counts as a touch; nothing else does. */
export function ageInDays(lead: Lead, now: Date): number {
  return daysBetween(lead.lastTouchAt ?? lead.createdAt, now);
}

/**
 * Why this lead is owed something right now, or null if it is fine.
 *
 * Order is precedence, not taste: an explicit reminder the user set themselves outranks
 * every rule the app inferred, and a silent proposal outranks generic drift because it is
 * the most expensive thing to forget.
 */
export function openReasonOf(lead: Lead, now: Date): OpenReason | null {
  if (lead.status === 'won' || lead.status === 'lost') return null;

  if (lead.reminderDueAt && daysBetween(lead.reminderDueAt, now) >= 0) {
    return 'reminder_due';
  }
  if (lead.status === 'proposal_sent' && ageInDays(lead, now) >= DRIFT_DAYS.proposal_sent) {
    return 'proposal_silent';
  }
  if (lead.status === 'new' && lead.checklistAnswered === 0 && ageInDays(lead, now) >= 1) {
    return 'unqualified';
  }
  if (ageInDays(lead, now) >= DRIFT_DAYS[lead.status]) {
    return 'drifting';
  }
  return null;
}

/**
 * The one next thing to do with this lead, and whether it is already late.
 *
 * `urgent` is the difference between "this is what this stage is for" and "this is overdue",
 * and the caller renders them differently — but both are advice, and neither blocks anything.
 */
export interface NextStep {
  text: string;
  /** The verb, when there is a concrete one. Absent for stage guidance, which reads as prose. */
  action: string | null;
  urgent: boolean;
}

/**
 * Null for a closed lead: won and lost have nothing owed, and inventing a next step for them
 * would be noise on the one screen that is supposed to be quiet. Create mode has no lead at
 * all, so callers simply do not render this.
 */
export function nextStepOf(lead: Lead, now: Date): NextStep | null {
  if (lead.status === 'won' || lead.status === 'lost') return null;

  const reason = openReasonOf(lead, now);
  if (reason) {
    return { text: OPEN_REASON[reason], action: OPEN_ACTION[reason], urgent: true };
  }

  // Nothing is overdue, so the honest advice is what this stage is for. This is the line the
  // product always had and never showed: it lived in a five-second toast that only fired when
  // the checklist was already complete, which is never true for the beginner who needs it.
  return { text: STATUS_GUIDANCE[lead.status], action: null, urgent: false };
}
