import { OPEN_ACTION, OPEN_REASON } from './copy';
import { ageInDays, openReasonFor } from './attention';
import { Lead } from './lead.model';

/**
 * "What should I do with this lead" — the advice layer.
 *
 * Two workstreams independently pulled the attention rules out of `LeadsStore`, and this file
 * is the merge of them. The *reason* engine lives in `attention.ts` and is deliberately not
 * duplicated here: this file had its own `openReasonOf` and `ageInDays` keyed on stage names,
 * which the stages refactor made both wrong and redundant. Two engines answering "is this lead
 * owed something" is how two screens end up disagreeing in front of the user.
 *
 * What survived is the part that was genuinely new: `nextStepOf`, the single line the lead sheet
 * shows a beginner. It exists because the guidance the product always had lived in a
 * five-second toast that only fired when the checklist was already complete — which is never
 * true for the person who needs it most.
 */

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
 * Null for a closed lead: a won or lost lead has nothing owed, and inventing a next step for it
 * would be noise on the one screen that is supposed to be quiet. Create mode has no lead at all,
 * so callers simply do not render this.
 *
 * `firstOpenStageId` is threaded through to `openReasonFor` rather than resolved here, so this
 * file stays free of a store — the same reason that function takes it as an argument.
 *
 * The non-urgent line now comes off the stage row (`stage.guidance`) rather than a hardcoded
 * `STATUS_GUIDANCE` map, which is the point of moving the teaching copy into the database: a
 * stage the user invented can carry its own advice. A stage with no guidance returns null and
 * the caller shows nothing, rather than something generic that would be wrong for a stage
 * nobody at this company has ever explained.
 */
export function nextStepOf(
  lead: Lead,
  now: Date,
  firstOpenStageId: string | null,
): NextStep | null {
  if (lead.stage.kind !== 'open') return null;

  const reason = openReasonFor(lead, now, firstOpenStageId);
  if (reason) {
    return { text: OPEN_REASON[reason], action: OPEN_ACTION[reason], urgent: true };
  }

  const guidance = lead.stage.guidance?.trim();
  if (!guidance) return null;

  return { text: guidance, action: null, urgent: false };
}

export { ageInDays };
