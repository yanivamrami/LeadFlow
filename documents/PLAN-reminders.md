# Implementation plan — Reminders (SCREENS §4)

> **Status: built 2026-08-03.** All seven steps of §9 shipped. Kept for the decisions it
> records, not as outstanding work — §1's explicit-vs-derived split and §2's "do not build the
> generator" are now also in `docs/ARCHITECTURE.md` §6.1. What remains open moved to
> `documents/GAPS.md`: G-32 (the day sheet's `דחה` still pushes a fixed day) and G-33 (never
> visually verified). Scenarios to run by hand: `documents/MANUAL-TESTS.md` §4b.

> Functional plan for `documents/SCREENS.md` 4.1 / 4.2 / 4.3 plus the reminder gaps in
> `documents/GAPS.md` (G-1 … G-9). Behaviour, data and acceptance criteria only — visual
> execution defers to `docs/DESIGN-SYSTEM.md` v2.0 and a design pass on the built screen.
>
> Written against the code as of 2026-08-03. Every file/line reference below was verified.
> Last updated: 2026-08-03

---

## 1. The decision this plan turns on

The product currently has **two different things** that both mean "you owe this lead
something", and only one of them is a row in a table:

| | Explicit reminder | Derived urgency |
|---|---|---|
| Source | `public.reminders` row with a `due_at` | computed on every read by `openReason()` (`leads.store.ts:302`) |
| Examples | "call Thursday", a snooze | `proposal_silent` (3 silent days), `unqualified` (new + 0 answers + 1 day), `drifting` (`DRIFT_DAYS`) |
| Can be completed | yes — `done_at` | no — it stops being true when the lead changes |
| Can be rescheduled | yes | meaningless |
| Exists today | table + read path, no writer but snooze | fully working, drives the day sheet |

**Decision: the reminders screen is the explicit ones.** A list whose rows cannot be
individually completed or moved is not a reminders list — it is a second day sheet with
different sorting, and the two will disagree in front of the user. Derived urgency keeps its
home: the day sheet (2.1), the register's attention flags, and the urgency sort.

**But the PRD's reminders are automatic** (§2: "based on lead status or last interaction"), so
the screen does not pretend derived urgency does not exist. It carries a **second band below a
rule: leads with no reminder that probably want one**, each offering one action — set a
reminder. That converts a vague nudge into a dated commitment the user chose, which is exactly
the teaching this product exists to do, and it is the one place where the PRD's "automated" and
the product's "advisory, never blocking" principle can both be honoured.

Consequences, stated so nobody re-litigates them mid-build:

- **Badge = overdue + due-today reminder rows.** Not `openItems`. Zero rows means no badge,
  even with five drifting leads — because nothing is *scheduled*. The bell is the user's own
  calendar; pipeline attention already has three surfaces. This overrides the SCREENS 1.1 note
  that reads as if the badge should be `openItems.length`.
- The suggestion band never contributes to the badge, is never counted anywhere, and is capped
  (see §4.1) — a suggestion that nags is a gate wearing a different coat.

---

## 2. Data & backend

**No migration is required.** `public.reminders`
(`client/supabase/migrations/20260802152919_init_schema.sql:105`) already has every column this
needs, RLS with all four policies, and the partial index
`reminders_tenant_due_at_idx (tenant_id, due_at) where done_at is null` — the exact access path
4.1 queries on. The FK index landed in `20260802154958_index_reminders_lead_fk.sql`.

**No RPC is required.** `save_lead` / `create_lead`
(`20260803093000_lead_write_rpcs.sql`) exist because the lead sheet commits three tables at
once and a half-commit loses a typed note. Every reminder write here touches **one row in one
table**, so plain PostgREST is correct and adding a function would be ceremony. The one
multi-table case already exists and already works: `logActivity` → `closeOpenReminders`
(`leads.store.ts:532`).

**Do not build the reminder generator (G-5).** `docs/ARCHITECTURE.md` §3 step 4 and §6's
`reminders-due` job describe a writer that was never built; `openReason()` replaced it and is
better — a derived rule cannot go stale, cannot double-fire, and needs no cron. Building the
trigger now would produce a row that says the same thing the client already computes, and then
two sources of "this proposal is silent" that drift apart. **Deliverable for G-5 is an
ARCHITECTURE.md amendment, not code.** Revisit only when reminders must reach a user who is not
looking at the app — i.e. when the email digest arrives, which PRODUCT.md:60 defers.

### Read path

The nested read on the leads query (`leads.store.ts:58`) stays as it is — the dashboard needs
the earliest open reminder per lead and nothing more. The route gets its own query, because it
needs *all* rows including future ones, with the lead's name attached:

```ts
// RemindersStore
this.supabase.client
  .from('reminders')
  .select('id, title, due_at, done_at, lead_id, leads ( id, name, status )')
  .eq('tenant_id', tenantId)
  .is('done_at', null)
  .order('due_at', { ascending: true })
```

Ascending on purpose, and it is the one list in the product that sorts that way: the answer to
"what is next" is the *soonest*, so it is still the first row (compare the note on
`SORT_LABEL` in `copy.ts:93` — every other sort puts the answer on top by descending).

Completed rows are not fetched. "What I finished" is the day sheet's cleared-today strikethrough
and the lead's timeline; a reminders archive is a screen nobody asked for.

### Store

New `RemindersStore` in `client/src/app/core/reminders.store.ts`, root-provided, mirroring
`InsightsStore`'s shape (own load, own `loading` / `loaded` / `loadFailed`, own `_now`). It does
**not** live inside `LeadsStore`: that store is the dashboard's pipeline and is already large,
and the badge must work on `/insights` and `/profile` where the pipeline may never have loaded.

State: `rows`, `loading`, `loaded`, `loadFailed`, `_now`, `busyId`.

Derived:
- `overdue` — `daysBetween(due_at, now) > 0`
- `today` — `daysBetween(due_at, now) === 0`
- `upcoming` — `daysBetween(due_at, now) < 0`
- `openCount = overdue().length + today().length` ← the badge
- `suggestions` — from `LeadsStore`, see §4.1

Banding **must** use `daysBetween` from `copy.ts:574` (UTC-normalised calendar days), the same
helper `openReason()` uses. Two definitions of "today" in one product is a bug that only shows
up at 23:50.

Writes (each wrapped in the existing `commit()` pattern so offline-block, toast and the
failed-to-persist interrupt all keep working unchanged):
- `complete(id)` → `update { done_at: now }`
- `reschedule(id, due: Date)` → `update { due_at }`
- `create(leadId, title, due)` → `insert { lead_id, tenant_id, title, due_at }`
- `remove(id)` → `delete` — for a reminder set by mistake. Distinct from `complete`: "I did it"
  and "this should never have existed" are different facts, and only one belongs in history.

`commit()` re-reads on success (`leads.store.ts:551` explains why); the reminders store does the
same, and additionally refreshes `LeadsStore` when a write changes what the day sheet shows.

---

## 3. Routing & shell

| Change | File | Detail |
|---|---|---|
| Add route | `app.routes.ts` | `{ path: 'reminders', pathMatch: 'full', title: 'תזכורות · LeadFlow Manager', loadComponent: … }` — a sibling of `insights`, inside `Shell`, behind `authGuard`. Not a child of the dashboard: it is a destination, not an overlay, so unmounting the board is right. |
| Bell becomes a link | `shell.html:37` | `<button class="mast__bell">` → `<a routerLink="/reminders" routerLinkActive="on" ariaCurrentWhenActive="page">`. Keeps `copy.shell.remindersBadge` as the label. |
| Badge tells the truth (G-1) | `shell.ts:57` | Delete `reminderCount = 3`; use `RemindersStore.openCount`. Badge renders only when `> 0` — a `0` in a red dot is noise. `aria-label` must include the number, not just "תזכורות פתוחות". |
| Promote both tabs | `shell.html:11`, mobile nav | `<span class="soon" aria-disabled="true">` → real `<a routerLink="/reminders">` in the desktop nav and the bottom tab strip. Closes half of SCREENS 1.2's TODO (Insights is already live). |
| Load the count | `shell.ts` | Load once on shell init, not per navigation. |

---

## 4. The screens

### 4.1 Reminders list

**Route** `/reminders`. Compact density per SCREENS 4.1. Mobile-first at 390px.

**Bands, in this order**, each with its own heading and count, each omitted entirely when empty:

1. **באיחור** (overdue) — most overdue first (descending age, matching every other urgency
   surface in the product).
2. **היום** (due today) — the actual work.
3. **בהמשך** (upcoming) — soonest first. This is the only forward-looking list in the product;
   it is what makes the screen worth opening when nothing is due.
4. **— rule —** **בלי תזכורת** (suggestions) — leads with an open reason and **no** reminder
   row. Capped at 5, sorted by age. Header states the cap when it truncates. Never counted in
   the badge.

**Row content** (this is where G-6 is closed — `title` and `due_at` currently reach no
template anywhere):

- Lead name — the row's primary text, and a link to `/lead/:id`. The lead is what the user
  thinks about; the reminder is an attribute of it.
- The reminder's own `title`. Today it is only ever `COPY.notify.snoozed` because snooze is the
  sole writer; once §4.2/§5 land it carries real text. Falls back to a stage-derived line rather
  than rendering an empty element.
- Due date: relative first, absolute second — `מחר · 4.8` — via a new `formatDue()` (§6).
  `formatWhen` (`copy.ts:581`) is past-facing ("אתמול", "לפני יומיים") and cannot be reused.
- Stage tag, label always present — never colour alone (PRODUCT.md accessibility).
- Actions, in this order: **בוצע** (complete) · **דחה** (reschedule → 4.2) · row is the link to
  the lead. Three targets max, each ≥44×44.

**Suggestion rows** differ: no due date, no complete. One action — **קבע תזכורת** — opening the
same date control as 4.2 and inserting a row with a stage-derived title. A dismiss is *not*
offered: there is nothing to persist a dismissal in, and a dismiss that returns on reload is
worse than no dismiss. The cap does the work instead.

**Per-row busy state.** Copy the day sheet's `busyId` mechanic (`day-sheet.ts:48`) verbatim,
including its reasoning: every action is a round trip, and without it the tap looks ignored
right until the row vanishes.

**States** — all four, because the register earned this list the hard way (SCREENS 2.9 was
found when a failed read rendered "you have no leads yet"):

| State | Behaviour |
|---|---|
| Loading | Opaque `--lf-skeleton` bars in the row layout, breathing not shimmering, reduced-motion stops the loop outright (2.7's rules). First read only. |
| Empty — no reminders and no suggestions | Dashed container, one action → `/`. Copy says the pipeline is clear, not that the feature is unused. |
| Empty — no reminders but suggestions exist | The suggestion band **is** the page. No empty state at all. |
| Load failure | Its own state with a retry, replacing the whole list — never a partial list plus an error. |

**Acceptance**
- Every band's count matches its rows; sum of overdue+today equals the masthead badge exactly.
- A reminder completed here disappears from the day sheet without a manual refresh.
- Every row reachable and operable by keyboard alone; the lead link is not swallowed by the
  action buttons (the same trap SCREENS 3.2 notes for the register's kebab).
- Zero rows → no badge in the masthead.

### 4.2 Reschedule

**Not a route and not a modal.** An inline expansion inside the row, following the in-place
pattern 3.6 and 3.7 already set (`no modal over a modal`). Opening it does not lose the list.

**Controls, in this order:**
1. Chips: **מחר** · **בעוד 3 ימים** · **בעוד שבוע**. Three, because a fourth is a menu.
2. **תאריך** — a native `<input type="date">` with `min` = today. Native on purpose, for the
   reason 2.8 already recorded for the sort control: on a phone the OS picker beats a custom
   menu and is accessible for free. Explicitly accept that the picker is the platform's, not
   the world's.
3. Cancel, always. Advisory, never blocking.

**Time-of-day is not asked.** `due_at` is `timestamptz`, but the product reasons in whole days
everywhere — `daysBetween`, `DRIFT_DAYS`, `formatAge`. Asking for a time would create a
precision the rest of the app immediately discards. Write 09:00 local on the chosen date.

**~~Day sheet stays one tap.~~ OVERRIDDEN by the user, 2026-08-03.** `דחה ליום` on the day sheet
must open a day-selection chooser, not silently push to tomorrow. Full brief:
`documents/PLAN-gaps.md` §1c. In short: the same shared chooser serves the day sheet, this list
and lead detail; it anchors to the row rather than covering the sheet; presets are
מחר · בעוד 3 ימים · בעוד שבוע · תאריך; the toast names the date it landed on; and the button
loses the `ליום` because it no longer means "by one day".

**Acceptance**
- Rescheduling an overdue reminder to a future date moves it between bands immediately.
- A date in the past cannot be submitted (`min`, plus a store-side guard — `min` is a hint, not
  a validator).
- Cancel writes nothing.
- The same control, same component, serves 4.1 rows, suggestion rows and lead detail (§5).

### 4.3 Login toast

Fires **once per session**, on the first successful load after sign-in, when
`overdue + today > 0`.

- Uses `notify.info(message, { label, run })` — already supported
  (`notify.service.ts`, `ToastAction` in `notify.model.ts`). A toast with an action holds 8s
  (`TOAST_WITH_ACTION_MS`); action navigates to `/reminders`.
- Message names the count and nothing else. Overdue takes precedence when both exist.
- **Never** the critical popup. `failedToPersist` is the only path to the interrupt and it takes
  a `FailedWrite` — a reminder digest is not a failed write. Do not widen that door.
- Suppression rules, all of them:
  - Once per browser session — `sessionStorage` key, so a refresh does not re-announce.
  - Only after the reminders read resolves successfully. A failed read announces nothing.
  - Not while offline (the banner owns the screen).
  - Not on the `/reminders` route itself — telling someone what they are looking at is noise.
- Zero-state is silent. No "you have no reminders" toast, ever.

**Acceptance:** sign in with 2 overdue → one toast, correct count, action lands on the list;
refresh → silent; sign out and back in → fires again.

---

## 5. Creating a reminder (G-4)

Without this the feature is read-only and the only user-authored reminder is always tomorrow.
Two entry points, no more:

1. **Lead detail (3.2)** — a reminder line in the fields region: shows the open reminder's title
   and date with edit / clear, or one control to set one when there is none. Closes the SCREENS
   3.2 TODO "reminders are read but not managed here". Reuses 4.2's date control.
   - Title is optional; empty falls back to a stage-derived line, so the fast path is
     date-only. Forcing a title to schedule a call is friction with no payoff.
   - It commits with the sheet's **one save**, not as a second action — that is 3.5's rule for
     the note composer and the same rule applies here. This is the one place a reminder write
     joins a multi-table commit, so it belongs in `save_lead` as two new optional parameters
     (`p_reminder_due`, `p_reminder_title`) rather than a second round trip that can half-fail.
2. **Suggestion rows on 4.1** — one tap from "this lead is drifting" to a dated commitment.

Not entry points: the register row menu and the board card menu. Both are stage-move surfaces;
adding scheduling to them makes two already-crowded menus worse.

**One open reminder per lead is the working assumption.** `toLead` already folds to the earliest
(`leads.store.ts:256`) and the day sheet, badge and attention rules all reason about "the" open
reminder. Setting a new one while one is open **reschedules that one** rather than creating a
second. The table permits many and multi-reminder is a real future need (a member and an owner
both scheduling on one lead), so nothing here blocks it — but v1 does not open that door, and
the assumption is written down so the next person knows it was a choice.

---

## 6. Copy (`core/copy.ts`)

All Hebrew, all in the existing keyed structure. New:

- `reminders` block: page title, the four band headings, per-band counts, empty state (both
  variants), load failure + retry, and the suggestion band's cap line.
- Row actions: `בוצע` · `דחה` · `קבע תזכורת` · `מחק תזכורת`.
- Reschedule chips: `מחר` · `בעוד 3 ימים` · `בעוד שבוע` · `תאריך`.
- `notify` additions: reminder completed, rescheduled (naming the new date), set, deleted.
- Login toast: overdue variant and due-today variant, both counted.
- Stage-derived fallback titles for the four `OpenReason` values — reuse `OPEN_REASON`
  (`copy.ts:72`) rather than writing a second set of words for the same four facts.
- `formatDue(date, now)` — future-facing sibling of `formatWhen` (`copy.ts:581`): `היום`,
  `מחר`, `בעוד יומיים` (correct Hebrew dual), `בעוד N ימים` inside a week, absolute `he-IL`
  date after; past → `באיחור N ימים`.

Voice per PRODUCT.md: warm-instructional, no emoji, no sales jargon. Nothing may read as a
scolding — an overdue reminder states the fact and offers the action.

---

## 7. Design constraints this screen must not break

- **Yellow is the day's one field.** The day sheet owns it. The reminders list is ink on poster
  stock; overdue is carried by texture/weight and the label, not by turning rows red. Red is
  `commit` only.
- Logical CSS properties only. Touch targets ≥44×44 in the compact density too — "compact"
  applies to type and rhythm, not to hit areas.
- `prefers-reduced-motion` collapses band transitions to a fade; no stagger on a list the user
  opens many times a week.
- Status never by colour alone; tags keep their labels.
- Run the impeccable detector before calling it done — the toast's
  `border-inline-start: 4px solid` finding (SCREENS 1.6) is the kind of thing a new list surface
  reintroduces by accident.

---

## 8. Tests

Precedent: `insights.store.spec.ts`, `supabase.service.spec.ts`.

- `reminders.store.spec.ts` — banding across the day boundary (23:50 and 00:10 with the same
  row), `openCount` excludes upcoming and suggestions, suggestion derivation excludes leads that
  already have an open row, past-date guard on `reschedule`.
- `formatDue` — every branch including the Hebrew dual and the overdue form.
- Login-toast rule as a pure function of `(overdue, today, alreadyShown, online, route)` so it is
  testable without a component.

---

## 9. Order of work

| Step | Delivers | Size | Why here |
|---|---|---|---|
| 1 | `RemindersStore` + read path + `openCount` | half day | Everything else reads from it. |
| 2 | Badge wired, bell → link, both tabs promoted (G-1) | ~1h | Stops the masthead lying today, before the screen exists. |
| 3 | 4.1 list — four bands, four states, complete action | 1 day | The screen. Suggestion band included from the start; retrofitting it means redesigning the page. |
| 4 | 4.2 reschedule control, inline (G-3) | half day | Reused three times; build it once, here. |
| 5 | Set/clear on lead detail + `save_lead` params (G-4) | half day | Makes the feature writable. Touches a migration, so it follows the client work that defines what it needs. |
| 6 | 4.3 login toast | ~2h | Cheapest last: needs a correct count, which step 1 provides. |
| 7 | ARCHITECTURE.md amendment for G-5/G-7; SCREENS.md + GAPS.md updated | ~1h | The docs are wrong until this runs. |

Steps 1–2 are shippable on their own and worth shipping on their own.

---

## 10. Definition of done

- SCREENS 4.1/4.2/4.3 struck through; §4's TODO column carries only what is genuinely still
  open. GAPS.md G-1, G-2, G-3, G-4, G-6, G-8 deleted; G-5 and G-7 resolved to a recorded
  decision.
- No `aria-disabled` navigation remains anywhere in the shell.
- Verified on a real device at 390px **and** on desktop — §3's unverified state
  (GAPS.md G-17) is the standing lesson: code-complete and type-checked is not done.
- A reminder completed on 4.1 is gone from the day sheet, the badge, and the register's
  attention flag without a manual refresh.

---

## 11. Open questions (PM, not engineering)

1. **Suggestion band cap of 5 and the four `DRIFT_DAYS` thresholds** — both are judgement
   calls, like the 10-decided threshold in SCREENS 5.4. Revisit against real usage.
2. **`assigned_to` (G-7)** — write `auth.uid()` on every reminder now so history is not empty
   when invites land (8.3), or leave it null until there is someone to assign to? Writing it
   costs nothing and cannot be backfilled later.
3. **Auto-scheduling** — should moving a lead to `proposal_sent` *offer* a 3-day reminder
   (accepted with one tap, never silently written)? It is the strongest version of the PRD's
   "automated", and it is the only proposal here that would put scheduling in front of someone
   who did not ask for it. Deliberately excluded from this plan; decide before v2.
