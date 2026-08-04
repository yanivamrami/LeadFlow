import { Pipe, PipeTransform } from '@angular/core';

/**
 * The timeline's own stamp: היום HH:MM · אתמול HH:MM · an absolute date past that.
 *
 * Kept local to this feature rather than appended to shared/format.pipes.ts: those four are
 * each used from multiple screens (reminders, the day sheet); nothing outside this sheet's
 * timeline needs this formatting, so it does not belong in the shared surface.
 *
 * `now` is a required argument rather than read from a clock inside the pipe — a pure pipe
 * that read `new Date()` would be memoised against a value that keeps changing, so it would
 * go stale and never update. `pure: true` is the default and stated anyway, for the same
 * reason format.pipes.ts states it: the whole point of this file depends on it.
 */
@Pipe({ name: 'lfStamp', pure: true })
export class StampPipe implements PipeTransform {
  transform(at: Date, now: Date): string {
    const sameDay = at.toDateString() === now.toDateString();
    const time = at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `היום ${time}`;
    const yesterday = new Date(now.getTime() - 86_400_000);
    if (at.toDateString() === yesterday.toDateString()) return `אתמול ${time}`;
    return at.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  }
}
