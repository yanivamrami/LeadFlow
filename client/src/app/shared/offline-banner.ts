import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LucideWifi, LucideWifiOff } from '@lucide/angular';

import { COPY } from '../core/copy';
import { NotifyService } from '../core/notify.service';

/**
 * Offline is a state, not an event: it has a duration and it resolves on its own, so it
 * gets a place rather than a moment. The strip sits under the masthead and *pushes*
 * content instead of overlaying it — nothing gets hidden while the user is already in
 * trouble. On reconnect it says so for two seconds, then collapses.
 */
@Component({
  selector: 'lf-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideWifi, LucideWifiOff],
  template: `
    @if (!online()) {
      <div class="strip" role="status" aria-live="polite">
        <svg lucideWifiOff aria-hidden="true"></svg>
        {{ copy.offline.banner }}
      </div>
    } @else if (reconnected()) {
      <div class="strip strip--back" role="status" aria-live="polite">
        <svg lucideWifi aria-hidden="true"></svg>
        {{ copy.offline.back }}
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .strip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--lf-space-2);
      min-block-size: 40px;
      padding-inline: var(--lf-space-4);
      background: var(--lf-ink);
      color: var(--lf-on-ink);
      border-block-end: 2px solid var(--lf-day);
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      animation: drop var(--lf-dur-enter) var(--lf-ease) backwards;
    }

    .strip--back {
      border-block-end-color: var(--lf-day);
      color: var(--lf-day);
    }

    .strip svg {
      flex: 0 0 auto;
      inline-size: 18px;
      block-size: 18px;
      stroke: currentColor;
      stroke-width: 2.4;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @keyframes drop {
      from { opacity: 0; translate: 0 -8px; }
      to { opacity: 1; translate: 0 0; }
    }
  `,
})
export class OfflineBanner {
  private readonly notify = inject(NotifyService);

  protected readonly copy = COPY;
  protected readonly online = this.notify.online;
  protected readonly reconnected = this.notify.reconnected;
}
