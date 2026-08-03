import { DestroyRef, Injectable, computed, inject, isDevMode, signal } from '@angular/core';

import { COPY } from './copy';
import {
  CriticalAlert,
  FailedWrite,
  RECONNECT_MS,
  TOAST_LIMIT,
  TOAST_MS,
  TOAST_WITH_ACTION_MS,
  Toast,
  ToastAction,
  ToastKind,
} from './notify.model';

/**
 * The one place that decides how the product speaks to the user.
 *
 * Components never choose a mechanism. They report what happened — `succeeded`,
 * `failedToPersist`, `blockedOffline` — and the severity rule here picks the popup,
 * the toast stack, or nothing. That is what keeps the interrupt rare: there is exactly
 * one method that can raise it, and it takes a `FailedWrite`.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private seq = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private readonly _toasts = signal<Toast[]>([]);
  private readonly _alerts = signal<CriticalAlert[]>([]);
  private readonly _online = signal(this.readOnline());
  private readonly _reconnected = signal(false);

  readonly toasts = computed(() => this._toasts().slice(0, TOAST_LIMIT));
  /** One interrupt at a time, ever. A second waits behind the first. */
  readonly alert = computed<CriticalAlert | null>(() => this._alerts()[0] ?? null);
  readonly online = this._online.asReadonly();
  readonly reconnected = this._reconnected.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      const goOffline = () => this.setOnline(false);
      const goOnline = () => this.setOnline(true);
      window.addEventListener('offline', goOffline);
      window.addEventListener('online', goOnline);
      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('offline', goOffline);
        window.removeEventListener('online', goOnline);
        this.timers.forEach((t) => clearTimeout(t));
      });

      // Dev-only handle so these three states can be exercised before Supabase exists.
      // isDevMode() is false in a production build, so it never ships.
      if (isDevMode()) {
        (window as unknown as Record<string, unknown>)['__lfNotify'] = this;
      }
    }
  }

  /* ---------- the severity rule ---------- */

  /** Something worked. Receipt, not a decision. */
  succeeded(message: string): void {
    this.toast('success', message);
  }

  info(message: string, action?: ToastAction): void {
    this.toast('info', message, action);
  }

  /**
   * A recoverable failure: permission denied, not found, rate limited, sign-in refused.
   * The work can continue, so it announces rather than interrupts.
   */
  failed(message: string): void {
    this.toast('error', message);
  }

  /**
   * The only path to the interrupt. A write was attempted, did not land, and the user
   * believes it did — the one case where a missed message costs real data.
   */
  failedToPersist(write: FailedWrite, code: string | null = null): void {
    this._alerts.update((queue) => [
      ...queue,
      {
        id: ++this.seq,
        title: COPY.notify.saveFailedTitle,
        body: COPY.notify.saveFailedBody(write.subject),
        code,
        retry: () => void this.runRetry(write),
      },
    ]);
  }

  /**
   * A write refused before it left the client because there is no connection.
   * Nothing was attempted and nothing was lost, so this is a toast — the banner
   * already carries the state.
   */
  blockedOffline(): void {
    this.toast('error', COPY.offline.blocked);
  }

  /** The checklist nudge lives in the same pasted stack as toasts — same object, same place. */
  nudge(message: string, action: ToastAction, dismissLabel: string): void {
    this.push({
      id: ++this.seq,
      kind: 'info',
      message,
      action,
      sticky: true,
      dismissLabel,
      createdAt: Date.now(),
    });
  }

  /* ---------- lifecycle ---------- */

  dismissToast(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  dismissAlert(id: number): void {
    this._alerts.update((queue) => queue.filter((a) => a.id !== id));
  }

  /** Hover, focus or touch holds a toast open — the timer is a convenience, not a deadline. */
  holdToast(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  resumeToast(id: number): void {
    const toast = this._toasts().find((t) => t.id === id);
    if (!toast || toast.sticky) return;
    this.arm(toast);
  }

  private toast(kind: ToastKind, message: string, action?: ToastAction): void {
    this.push({
      id: ++this.seq,
      kind,
      message,
      action,
      sticky: false,
      createdAt: Date.now(),
    });
  }

  private push(toast: Toast): void {
    this._toasts.update((list) => [toast, ...list]);
    if (!toast.sticky) this.arm(toast);
  }

  private arm(toast: Toast): void {
    const ms = toast.action ? TOAST_WITH_ACTION_MS : TOAST_MS;
    this.timers.set(
      toast.id,
      setTimeout(() => this.dismissToast(toast.id), ms),
    );
  }

  private async runRetry(write: FailedWrite): Promise<void> {
    const current = this.alert();
    if (current) this.dismissAlert(current.id);
    try {
      await write.run();
      this.succeeded(COPY.notify.retried);
    } catch {
      // Still failing. Raise it again rather than swallowing it — the data is still at risk.
      this.failedToPersist(write);
    }
  }

  private setOnline(online: boolean): void {
    const was = this._online();
    this._online.set(online);
    if (online && !was) {
      this._reconnected.set(true);
      setTimeout(() => this._reconnected.set(false), RECONNECT_MS);
    }
  }

  private readOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }
}
