/**
 * Notification model. Severity is not a slider — it is one question:
 * can the user safely keep working?
 *
 *   critical → popup   a write failed and they believe it succeeded
 *   toast    → toast   success, info, and every recoverable failure
 *   offline  → banner  a state with a duration, so it gets a place, not a moment
 */

export type ToastKind = 'success' | 'info' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional single action. A toast carrying one never auto-dismisses in under 8s. */
  action?: ToastAction;
  /** Persistent toasts (the checklist nudge) wait for the user. */
  sticky: boolean;
  /** Secondary exit label for sticky toasts — advisory, never blocking. */
  dismissLabel?: string;
  createdAt: number;
}

/** The interrupt. One at a time, ever; a second queues behind the first. */
export interface CriticalAlert {
  id: number;
  /** What happened. */
  title: string;
  /** What it means for them, naming the actual record. */
  body: string;
  /** Support-facing code. Truthful, not decorative. */
  code: string | null;
  /** The recovery. Re-runs the write that failed; absent only when nothing can be retried. */
  retry?: () => void;
}

/** What a failed write knows about itself, so the retry can re-run it verbatim. */
export interface FailedWrite {
  /** Human-readable subject for the alert body — a lead name, usually. */
  subject: string;
  /** Re-runs the exact same mutation. */
  run: () => Promise<void>;
}

export const TOAST_LIMIT = 3;
export const TOAST_MS = 5000;
export const TOAST_WITH_ACTION_MS = 8000;
/** How long the banner shows "connection is back" before collapsing. */
export const RECONNECT_MS = 2000;
