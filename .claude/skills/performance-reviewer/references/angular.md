# Angular — Performance Checklist

Apply on top of the general review process. Findings should map to one of these
categories. For each, the trigger to look for and the fix.

## Change detection

- **Method calls in templates for values or CSS classes** — any `{{ getX() }}`,
  `[class]="computeClass()"`, `[style]="computeStyle()"`, `*ngIf="canShow()"`
  re-runs on *every* change detection cycle. Sev 1 on large/looped views, Sev 2
  otherwise. Fix: precompute into a field/signal, use a pure pipe, or use
  `[class.x]`/`[ngClass]`/`[style.x]`/host bindings bound to state.
- **Missing OnPush** — components using default change detection re-check on
  every global CD tick. Fix: `changeDetection: ChangeDetectionStrategy.OnPush`
  plus immutable inputs / signals.
- **Mutating objects/arrays in place** with OnPush — change not detected or forces
  workarounds. Fix: replace references immutably or use signals.
- **Manual `detectChanges()` / `markForCheck()` sprinkled to "fix" rendering** —
  usually a smell for a deeper CD problem. Flag and trace the root cause.

## Rendering & lists

- **`@for` / `*ngFor` without track / trackBy** — DOM nodes destroyed and
  recreated on every change. Sev 2 (Sev 1 on large lists). Fix: `@for (x of xs;
  track x.id)` or a `trackBy` fn.
- **Large lists rendered eagerly** — no virtualization for hundreds/thousands of
  rows. Fix: CDK virtual scroll or pagination.
- **Heavy/below-the-fold blocks rendered upfront** — Fix: `@defer` with
  appropriate triggers (viewport, interaction, idle).

## Signals & reactivity

- **`computed()` doing expensive work re-run needlessly**, or effects writing
  state that retrigger. Fix: memoize, split computeds, avoid state writes in
  effects.
- **Subscriptions without teardown** — memory leaks that degrade over time. Fix:
  `takeUntilDestroyed()`, async pipe, or explicit unsubscribe.
- **`async` pipe used multiple times on the same stream** in a template —
  multiple subscriptions. Fix: single subscription via `*ngIf="stream$ | async
  as v"` or a signal.

## RxJS

- Missing `debounceTime`/`distinctUntilChanged` on input-driven streams.
- Missing `shareReplay` for shared expensive sources.
- Nested subscriptions instead of `switchMap`/`mergeMap` (also a leak risk).

## Bundle & loading

- **No lazy-loaded routes** — everything in the initial bundle. Fix: lazy
  `loadComponent`/`loadChildren`, standalone components.
- Large eager third-party imports; non-tree-shakeable imports (import whole lib).
- Missing `@defer` for rarely-used heavy features.
- Images without dimensions / `NgOptimizedImage` not used where appropriate.

## HTTP & data

- Over-fetching in services (requesting more than the view needs) — pairs with a
  backend DTO finding.
- No caching of stable reference data.
- Waterfalls of dependent requests that could be parallelized (`forkJoin`).

## Don't overstate
Template method-call findings on a small, non-looped view are Sev 3, not Sev 1.
Gauge severity by how often the expression evaluates and over how many nodes.
