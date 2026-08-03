/**
 * Pure webhook URL guard — SCREENS 9.3, documents/PLAN-automations.md §2 "Webhook safety".
 *
 * This is the save-time UX check only. The SQL side (20260804091200, owned by another
 * agent) is authoritative: it re-asserts the same rule server-side, because a check that
 * lives only in the client is one direct PostgREST/RPC call away from not existing at all.
 * This function exists so a user gets a readable Hebrew refusal the moment they type a bad
 * URL, instead of a save that silently fails later.
 *
 * What this catches: non-HTTPS, and a *literal* loopback / private / link-local host.
 * What this does NOT catch, on purpose (documents/PLAN-automations.md §1, §2): a hostname
 * whose DNS answers with a private address. `pg_net` cannot resolve before sending, so
 * that gap is real and is tracked as a release condition — "before the first external
 * tenant, tier B moves to a function that resolves DNS, or webhook hosts get an
 * allowlist" — not something a string check can close.
 */
export type WebhookUrlVerdict = 'ok' | { refused: string };

const PRIVATE_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^::$/,
];

export function webhookUrlCheck(url: string): WebhookUrlVerdict {
  const trimmed = url.trim();
  if (!trimmed) {
    return { refused: 'צריך כתובת webhook.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { refused: 'הכתובת הזאת לא תקינה — צריך כתובת מלאה שמתחילה ב-https://‎.' };
  }

  if (parsed.protocol !== 'https:') {
    return { refused: 'רק כתובות HTTPS מותרות לוובהוק — כתובת http:// לא מתקבלת.' };
  }

  // Bracketed IPv6 hostnames come back from URL.hostname with the brackets stripped already,
  // but strip defensively in case that ever changes.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return {
      refused:
        'הכתובת מצביעה על כתובת פנימית או מקומית (כמו localhost או רשת פרטית), ולא ניתן להשתמש בה לוובהוק.',
    };
  }

  return 'ok';
}
