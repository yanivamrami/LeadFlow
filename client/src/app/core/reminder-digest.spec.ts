import { COPY } from './copy';
import { DigestInput, digestMessage } from './reminder-digest';

/** Everything permissive; each test flips exactly the one thing it is about. */
function input(patch: Partial<DigestInput> = {}): DigestInput {
  return {
    overdue: 0,
    today: 0,
    alreadyShown: false,
    loaded: true,
    online: true,
    onRemindersRoute: false,
    ...patch,
  };
}

describe('digestMessage', () => {
  it('is silent at zero', () => {
    // There is no "you have no reminders" toast. Nothing to do is not news.
    expect(digestMessage(input())).toBeNull();
  });

  it('announces overdue', () => {
    expect(digestMessage(input({ overdue: 2 }))).toBe(COPY.reminders.toastOverdue(2));
  });

  it('announces today when nothing is overdue', () => {
    expect(digestMessage(input({ today: 1 }))).toBe(COPY.reminders.toastToday(1));
  });

  it('lets overdue win when both exist', () => {
    // Overdue is the one that is already late, so it names the count that is late.
    expect(digestMessage(input({ overdue: 1, today: 4 }))).toBe(
      COPY.reminders.toastOverdue(1),
    );
  });

  it('stays silent once it has already been shown this session', () => {
    expect(digestMessage(input({ overdue: 3, alreadyShown: true }))).toBeNull();
  });

  it('stays silent when the read failed', () => {
    // A failed read has no counts to trust; the empty list is not evidence of an empty day.
    expect(digestMessage(input({ overdue: 3, loaded: false }))).toBeNull();
  });

  it('stays silent while offline', () => {
    // The offline banner already owns the screen, and the data may be stale.
    expect(digestMessage(input({ overdue: 3, online: false }))).toBeNull();
  });

  it('stays silent on the reminders route itself', () => {
    expect(digestMessage(input({ overdue: 3, onRemindersRoute: true }))).toBeNull();
  });

  it('uses singular Hebrew for one and plural for many', () => {
    expect(digestMessage(input({ overdue: 1 }))).toBe('תזכורת אחת באיחור.');
    expect(digestMessage(input({ overdue: 5 }))).toBe('5 תזכורות באיחור.');
    expect(digestMessage(input({ today: 1 }))).toBe('תזכורת אחת להיום.');
    expect(digestMessage(input({ today: 3 }))).toBe('3 תזכורות להיום.');
  });
});
