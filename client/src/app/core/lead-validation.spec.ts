import { LeadFormValues, hasErrors, validateLeadForm } from './lead-validation';

const form = (patch: Partial<LeadFormValues> = {}): LeadFormValues => ({
  name: 'מיכל ברנר',
  email: '',
  value: '',
  stageKind: 'open',
  lostReason: '',
  ...patch,
});

describe('validateLeadForm', () => {
  it('accepts a lead with nothing but a name', () => {
    // The capture case this exists for: a name now, the phone number tomorrow.
    expect(hasErrors(validateLeadForm(form()))).toBe(false);
  });

  it('requires a name', () => {
    expect(validateLeadForm(form({ name: '' })).name).toBeTruthy();
    expect(validateLeadForm(form({ name: '   ' })).name).toBeTruthy();
  });

  it('never requires a contact method', () => {
    const errors = validateLeadForm(form({ email: '', value: '' }));
    expect(errors.email).toBeUndefined();
  });

  it('checks an email only when one was given', () => {
    expect(validateLeadForm(form({ email: '' })).email).toBeUndefined();
    expect(validateLeadForm(form({ email: 'nope' })).email).toBeTruthy();
    expect(validateLeadForm(form({ email: 'a@b.co' })).email).toBeUndefined();
  });

  it('checks the value only when one was given, and allows zero', () => {
    expect(validateLeadForm(form({ value: '' })).value).toBeUndefined();
    expect(validateLeadForm(form({ value: '0' })).value).toBeUndefined();
    expect(validateLeadForm(form({ value: '12500' })).value).toBeUndefined();
    expect(validateLeadForm(form({ value: 'שלוש' })).value).toBeTruthy();
  });

  it('demands a reason on a lost lead and nowhere else', () => {
    expect(validateLeadForm(form({ stageKind: 'lost' })).lostReason).toBeTruthy();
    expect(
      validateLeadForm(form({ stageKind: 'lost', lostReason: 'מחיר' })).lostReason,
    ).toBeUndefined();
    expect(validateLeadForm(form({ stageKind: 'won' })).lostReason).toBeUndefined();
  });
});
