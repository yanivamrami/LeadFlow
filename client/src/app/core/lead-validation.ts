import { COPY } from './copy';
import { StageKind } from './lead.model';

/**
 * What the lead sheet checks before it will save. Pure on purpose: the same rules apply
 * to create and to edit, and a rule this consequential should be testable without
 * standing up a component.
 *
 * Only two things are ever required — a name, because without one there is nothing to
 * recognise the lead by, and a reason on a lost lead, because that is the whole point of
 * recording the loss. Contact details are deliberately optional: a lead captured as
 * "the guy from the hardware store, number tomorrow" must still be enterable.
 *
 * `stageKind` rather than a stage id: the only thing this rule ever cared about is
 * whether the selected stage is the lost one, and that is a property of `kind`, never of
 * which stage the tenant happens to have renamed into that role
 * (documents/PLAN-stages.md §1).
 */
export interface LeadFormValues {
  name: string;
  email: string;
  /** Raw text, not a number — an empty field is not zero, and zero is a real estimate. */
  value: string;
  stageKind: StageKind;
  lostReason: string;
}

export interface LeadFormErrors {
  name?: string;
  email?: string;
  value?: string;
  lostReason?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLeadForm(values: LeadFormValues): LeadFormErrors {
  const errors: LeadFormErrors = {};

  if (values.name.trim().length === 0) {
    errors.name = COPY.lead.nameRequired;
  }

  const email = values.email.trim();
  if (email.length > 0 && !EMAIL.test(email)) {
    errors.email = COPY.lead.emailInvalid;
  }

  const value = values.value.trim();
  if (value.length > 0 && !Number.isFinite(Number(value))) {
    errors.value = COPY.lead.valueInvalid;
  }

  if (values.stageKind === 'lost' && values.lostReason.trim().length === 0) {
    errors.lostReason = COPY.lead.lostReasonRequired;
  }

  return errors;
}

export function hasErrors(errors: LeadFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
