import { COPY } from '../../core/copy';
import { isAppError } from '../../core/supabase.service';

/**
 * Client-side validation exists to save a round trip and to say things in Hebrew — it is
 * never the check that matters. GoTrue and Postgres refuse the same input on their own.
 *
 * Deliberately permissive on email: a regex that tries to be RFC-correct rejects real
 * addresses, and the only real proof an address works is a message arriving at it.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD = 8;

export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return COPY.auth.validation.emailRequired;
  if (!EMAIL.test(trimmed)) return COPY.auth.validation.emailInvalid;
  return null;
}

export function passwordError(value: string, checkLength: boolean): string | null {
  if (!value) return COPY.auth.validation.passwordRequired;
  if (checkLength && value.length < MIN_PASSWORD) return COPY.auth.validation.passwordShort;
  return null;
}

export function nameError(value: string): string | null {
  return value.trim() ? null : COPY.auth.validation.nameRequired;
}

export function matchError(a: string, b: string): string | null {
  return a === b ? null : COPY.auth.validation.mismatch;
}

/**
 * Only ever navigate to a path inside this app. `//evil.example` is a protocol-relative
 * URL that a router will happily leave the origin for, and `returnUrl` comes from the
 * query string — that is, from anyone who can get a link in front of a user.
 */
export function safeReturnUrl(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/**
 * A signed-out submit (sign in, sign up, reset) that fails while the browser is offline
 * throws before the request even leaves — `signInWithPassword` et al. reject with a raw
 * fetch error rather than the service's normalized `AppError`, so `error.message` here
 * would otherwise fall back to the generic line and never say what actually happened.
 * `online` is read first so the offline line always wins, in the same words
 * `NotifyService.blockedOffline` uses for a blocked write — one phrasing for "nothing
 * left the browser", not a third one invented for this screen.
 */
export function submitError(error: unknown, online: boolean): string {
  if (!online) return COPY.offline.blocked;
  return isAppError(error) ? error.message : COPY.errors.generic;
}
