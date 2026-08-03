import { COPY } from './copy';

export const DIGEST_KEY = 'lf-reminder-digest';

export interface DigestInput {
  overdue: number;
  today: number;
  /** Already announced in this browser session. */
  alreadyShown: boolean;
  /** Only a successful read may announce — a failed one announces nothing. */
  loaded: boolean;
  online: boolean;
  /** Telling someone what they are already looking at is noise. */
  onRemindersRoute: boolean;
}

/**
 * Whether to announce the reminder digest, and what it should say.
 *
 * Extracted as a pure function on purpose: every one of these conditions is a rule
 * somebody could quietly regress, and all of them are testable without standing up a
 * component or a browser.
 *
 * Zero is silent. There is no "you have no reminders" toast, ever.
 */
export function digestMessage(input: DigestInput): string | null {
  if (input.alreadyShown) return null;
  if (!input.loaded) return null;
  if (!input.online) return null;
  if (input.onRemindersRoute) return null;

  // Overdue takes precedence when both exist: it is the one that is already late.
  if (input.overdue > 0) return COPY.reminders.toastOverdue(input.overdue);
  if (input.today > 0) return COPY.reminders.toastToday(input.today);
  return null;
}

export function digestAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(DIGEST_KEY) === '1';
  } catch {
    // Blocked storage: announce once per load rather than not at all.
    return false;
  }
}

export function markDigestShown(): void {
  try {
    sessionStorage.setItem(DIGEST_KEY, '1');
  } catch {
    // Nothing to do — the toast has already been shown.
  }
}
