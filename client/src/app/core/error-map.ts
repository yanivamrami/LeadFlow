import { COPY } from './copy';

/**
 * One place that turns a server error into something a person can read.
 * Components never see a PostgREST payload; `SupabaseService` runs everything through
 * here, so the Hebrew copy and the severity decision both live in one file.
 */

export interface ServerError {
  code?: string;
  message?: string;
  status?: number;
}

export interface MappedError {
  /** Hebrew, factual, states the fix where there is one. */
  message: string;
  /** Support-facing. Shown small and muted in the popup; never in a toast. */
  code: string | null;
  /**
   * True only when a write was attempted, did not land, and the user believes it did.
   * This is the flag that raises the interrupt — everything else announces.
   */
  costsData: boolean;
}

/** PostgREST / GoTrue codes we can name precisely. Everything else falls to the generic. */
const BY_CODE: Record<string, { message: string; costsData: boolean }> = {
  '23505': { message: COPY.errors.duplicate, costsData: false },
  '23503': { message: COPY.errors.notFound, costsData: false },
  '42501': { message: COPY.errors.notAllowed, costsData: false },
  PGRST116: { message: COPY.errors.notFound, costsData: false },
  invalid_credentials: { message: COPY.errors.signInFailed, costsData: false },
  email_not_confirmed: { message: COPY.errors.emailNotConfirmed, costsData: false },
  user_already_exists: { message: COPY.errors.emailTaken, costsData: false },
  weak_password: { message: COPY.errors.weakPassword, costsData: false },
  over_request_rate_limit: { message: COPY.errors.tooManyRequests, costsData: false },
};

const BY_STATUS: Record<number, { message: string; costsData: boolean }> = {
  401: { message: COPY.errors.sessionExpired, costsData: false },
  403: { message: COPY.errors.notAllowed, costsData: false },
  404: { message: COPY.errors.notFound, costsData: false },
  409: { message: COPY.errors.duplicate, costsData: false },
  429: { message: COPY.errors.tooManyRequests, costsData: false },
};

/**
 * @param error the raw server error
 * @param wasWrite whether the call that failed was a mutation. A read that fails costs
 *   the user a refresh; a write that fails can cost them a lead — same status code,
 *   different severity, so the caller has to say which it was.
 */
export function mapError(error: ServerError | null | undefined, wasWrite: boolean): MappedError {
  if (!error) {
    return { message: COPY.errors.generic, code: null, costsData: wasWrite };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { message: COPY.errors.offline, code: null, costsData: false };
  }

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  const byStatus = error.status ? BY_STATUS[error.status] : undefined;
  const hit = byCode ?? byStatus;

  if (hit) {
    return { message: hit.message, code: error.code ?? null, costsData: hit.costsData };
  }

  // Unclassified. A failed write here is exactly the case the popup exists for.
  return { message: COPY.errors.generic, code: error.code ?? null, costsData: wasWrite };
}

/** Session expiry needs no modal — the redirect to sign-in is the interruption. */
export function isSessionExpired(error: ServerError | null | undefined): boolean {
  return error?.status === 401;
}
