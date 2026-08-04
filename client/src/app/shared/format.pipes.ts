import { Pipe, PipeTransform } from '@angular/core';

import { formatAge, formatDue, formatValue, formatWhen } from '../core/copy';

/**
 * The product's four formatters, as pipes.
 *
 * They were being called as component methods from bindings, which means Angular re-ran them
 * on every change-detection pass for every row that used them — and on a board of 40 leads
 * that is 40 currency formats per pass, none of which had changed. A pure pipe is memoised on
 * its arguments' identity, so the work happens once per actual value change.
 *
 * Pipes rather than a `computed()` per row for these specifically, because they are honest
 * functions of their input: no store, no signal, nothing to invalidate. Anything that reads
 * state does NOT belong here — it belongs in a computed view model on the component, where it
 * is derived once per change instead of once per binding. `busy(id)` was the clearest example:
 * a pipe would still have run per row.
 *
 * `pure: true` is the default and is stated anyway, because the whole value of this file
 * depends on it and a future edit that flips it would silently restore the original problem.
 */

/** ₪ with no decimals when whole. */
@Pipe({ name: 'lfValue', pure: true })
export class ValuePipe implements PipeTransform {
  transform(value: number): string {
    return formatValue(value);
  }
}

/**
 * Past-facing: היום · אתמול · לפני יומיים · absolute past a week.
 *
 * `now` is a required argument rather than read from a clock inside the pipe: a pure pipe that
 * read `new Date()` would be memoised against a value that keeps changing, so it would go
 * stale and never update. Passing the store's `now()` signal keeps it correct and keeps the
 * pipe honest.
 */
@Pipe({ name: 'lfWhen', pure: true })
export class WhenPipe implements PipeTransform {
  transform(date: Date | null, now: Date): string {
    return formatWhen(date, now);
  }
}

/** Future-facing sibling: מחר · בעוד יומיים · באיחור N ימים. Same `now` reasoning. */
@Pipe({ name: 'lfDue', pure: true })
export class DuePipe implements PipeTransform {
  transform(date: Date, now: Date): string {
    return formatDue(date, now);
  }
}

/** Compact age for the day sheet's black tab: היום · יום · יומיים · N ימים. */
@Pipe({ name: 'lfAge', pure: true })
export class AgePipe implements PipeTransform {
  transform(days: number): string {
    return formatAge(days);
  }
}

/** Import as a unit — every screen that formats one of these usually formats another. */
export const FORMAT_PIPES = [ValuePipe, WhenPipe, DuePipe, AgePipe] as const;
