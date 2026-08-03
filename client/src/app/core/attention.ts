import { daysBetween } from './copy';
import { Lead, OpenReason } from './lead.model';

/** Days since the lead was last touched, or since it was created if it never has been. */
function ageInDays(lead: Lead, now: Date): number {
  return daysBetween(lead.lastTouchAt ?? lead.createdAt, now);
}

/**
 * Why a lead belongs on the day sheet, or `null` if it does not — the one rule the day
 * sheet, the register's flags and its urgency sort, and the reminders suggestion band all
 * read off. Pure so it is testable without a store (documents/CONTRACT-stages.md §3).
 *
 * Every branch here used to be hardcoded to a stage *name* (`leads.store.ts`'s old
 * `openReason`/`attentionOf`, documents/PLAN-stages.md §4.2) and now reads a property of
 * whatever stage row the tenant actually has — seeded or user-created. `firstOpenStageId`
 * is passed in rather than resolved here, so this file never needs a store of its own.
 *
 * Order is unchanged from before and matters: a reminder due today outranks silence, which
 * outranks being new, which outranks generic drift, so a lead with a due reminder is never
 * bumped by a softer signal.
 */
export function openReasonFor(
  lead: Lead,
  now: Date,
  firstOpenStageId: string | null,
): OpenReason | null {
  const stage = lead.stage;

  // Was `status === 'won' || status === 'lost'`. A closed lead carries no attention at all,
  // whatever the tenant chose to call the stage it closed in.
  if (stage.kind !== 'open') return null;

  if (lead.reminderDueAt && daysBetween(lead.reminderDueAt, now) >= 0) {
    return 'reminder_due';
  }

  // Was `status === 'proposal_sent'`. A stage where the ball is in their court, silent past
  // its own drift threshold. A stage with expectsReply but driftDays null (an explicit
  // "never drifts") never fires this — the same null that keeps the generic check below
  // from firing on it either.
  if (stage.expectsReply && stage.driftDays !== null && ageInDays(lead, now) >= stage.driftDays) {
    return 'proposal_silent';
  }

  // Was `status === 'new'`. "The stage leads arrive in" is a position, not a name.
  if (stage.id === firstOpenStageId && lead.checklistAnswered === 0 && ageInDays(lead, now) >= 1) {
    return 'unqualified';
  }

  // Was `DRIFT_DAYS[status]`, where won/lost held Number.POSITIVE_INFINITY. Null now means
  // the same thing: never drifts.
  if (stage.driftDays !== null && ageInDays(lead, now) >= stage.driftDays) {
    return 'drifting';
  }

  return null;
}
