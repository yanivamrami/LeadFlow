# Screens — LeadFlow Manager

> Derived from the PRD's four pillars, `docs/ARCHITECTURE.md` §7 (route map), and `PRODUCT.md`.
> ~~Struck through~~ = built and running. Everything else is unbuilt.
> The **TODO** column is never struck through: it is what is still open on that screen,
> whether the screen is built or not. "Whole screen" means nothing exists yet.
> Cross-cutting open work — doc-vs-code drift, deploy debt — lives in `documents/GAPS.md`.
> Last updated: 2026-08-03

Every screen is Hebrew/RTL, mobile-first at 390px, and follows `docs/DESIGN-SYSTEM.md` v2.0.
"Screen" here means a route or a full-surface overlay (drawer/dialog), not a component.

---

## 1. Shell

| # | Screen | Notes | TODO |
|---|---|---|---|
| 1.1 | ~~**App shell — masthead**~~ | ~~Ink masthead, brand lockup, reminders bell + badge, tenant monogram. Desktop adds inline nav. The monogram is a link to the profile.~~ | Nothing open. Badge is `RemindersStore.openCount` — overdue + due today, hidden at zero. Bell links to `/reminders`; the desktop action reaches `/lead/new`. **A labelled `יציאה` control is now the outermost masthead item** (icon-only under 900px, with `aria-label` carrying the word): logging out was previously reachable only by knowing the unlabelled monogram was a link. |
| 1.2 | ~~**App shell — bottom tabs**~~ | ~~Four tabs under 900px; active item marked by the ink rule and `aria-current="page"`.~~ | Nothing open. No `aria-disabled` navigation remains anywhere in the shell. |
| 1.3 | ~~**App shell — primary action band**~~ | ~~Full-width red band above the tabs on mobile; red button in the masthead on desktop.~~ | Nothing open. Both reach `/lead/new`. |
| 1.4 | **Tenant switcher** | Only matters once a user belongs to more than one tenant. Post-launch with invites. | Whole screen. Blocked on 8.3. |
| 1.5 | ~~**Global notifications — critical popup**~~ | ~~Fires for one case only: a write that did not persist. Torn-sheet mark, structured text, `נסה שוב` re-runs the failed mutation, always dismissible.~~ | The one rule it runs on (`costsData`) has unit cover in `supabase.service.spec.ts`. Nothing open. |
| 1.6 | ~~**Global notifications — toast stack**~~ | ~~Success, info, recoverable failures, and the checklist nudge, which shares the stack. Max 3, auto-dismiss, holds on hover/focus.~~ | Nothing open. The detector's `border-inline-start: 4px solid` finding is a **false positive** — `docs/DESIGN-SYSTEM.md` specifies that exact rule three times (lines 203/212/329), `4px` is the system's own section-rule width, and every kind also carries a Lucide mark so colour never signals alone. Justified at GAPS G-29; suppress it rather than re-litigating per audit. |
| 1.7 | ~~**Offline banner**~~ | ~~Ink strip under the masthead that pushes content; writes are blocked with an explanation while it is up; confirms on reconnect.~~ | Nothing open. Extracted to `shared/offline-banner` and now also rendered by `AuthPage`, so all four signed-out screens carry it — and a failed auth submit while offline says so in the same words `blockedOffline` uses, instead of a generic error. Placement inside `Shell` is unchanged. |

## 2. Dashboard (PRD pillar 1)

| # | Screen | Notes | TODO |
|---|---|---|---|
| 2.1 | ~~**Dashboard — day sheet**~~ | ~~The yellow sheet: open items at display scale, per-item action, snooze, cleared-today strikethrough, show-all, pasted explainer. Reads real rows.~~ | Not visually verified. Items open lead detail by name. `דחה` opens `lf-due-picker` **inline in the row**, pushing the sheet down — nothing covers the yellow field. The per-item action no longer writes its own label as the note: `חייג` rows log a typed **call with no body**, and the two rows whose verb names nothing navigate to the composer (`?at=note`) instead of inventing a record. |
| 2.2 | ~~**Dashboard — register (list view)**~~ | ~~Attention flags, stage tags, values, last touch, per-row menu. Real columns at ≥900px.~~ | Not visually verified. Rows open lead detail by name. `רשום פעילות` opens the composer rather than writing a placeholder; `דחה` turns the same kebab panel into the day chooser (no stacked overlay). A removable chip names an active `?source=` filter. Row-menu delete is still the demo path only (3.7). |
| 2.3 | ~~**Dashboard — board (kanban)**~~ | ~~Six columns RTL, CDK drag-and-drop, drop placeholder, per-card stage menu. Activates at ≥768px only. Stage moves persist.~~ | Not visually verified. Cards open lead detail by name, and the card menu is the same `lf-lead-menu` as the register's. Each column now carries its stage meaning as a caption when guidance is set to full — the meaning only, never the next step: six columns of "what to do" side by side would read as six simultaneous nudges. An active source filter still has no indicator here (G-40). |
| 2.4 | ~~**Dashboard — search & stage filters**~~ | ~~Search across name, company, phone, email; stage chip strip with counts.~~ | Filtering to a stage now states what that stage means under the strip — the phone's answer to the board's column captions, since the board needs ≥768px. Filters the loaded array client-side; revisit as PostgREST filters once a tenant holds more rows than one fetch. |
| 2.5 | ~~**Dashboard — empty & no-results states**~~ | ~~Dashed container, geometric mark, one action. Separate copy for "no leads yet" vs "nothing matched".~~ | Nothing open. The "no leads yet" action reaches `/lead/new`. |
| 2.6 | ~~**Dashboard — checklist nudge**~~ | ~~Pasted advisory after a stage move with open questions. Always carries `לא עכשיו`.~~ | Not visually verified (MANUAL-TESTS S16). `מלא עכשיו` is **wired**: it opens the lead at its checklist (`?at=checklist`), focus landing on the section rather than an answer segment, and it still answers nothing itself. `copy.nudge.checklistBody` remains unused — use it or delete it. |
| 2.7 | ~~**Dashboard — loading skeleton**~~ | ~~Opaque `--lf-skeleton` bars that breathe, never a shimmer sweep. Day sheet and register both, in the layout the rows will occupy. Shows only on the first read, never after a write.~~ | Not visually verified — it renders behind `authGuard`. Reduced motion stops the loop outright: the global 80ms override would otherwise turn it into a ~12Hz strobe. |
| 2.8 | ~~**Dashboard — sort control**~~ | ~~Four sorts — דחיפות (default), שווי, מי שקט מזמן, תאריך הוספה. A native select on purpose: on a phone the OS picker beats a custom menu and is accessible for free.~~ | Not visually verified. The open list is the platform's, not the world's — accepted, per the Operate rule that native expectations outrank expression. |
| 2.9 | ~~**Dashboard — load failure**~~ | ~~Found while building 2.7: a failed read rendered "you have no leads yet". Now its own state with a retry, replacing both regions so there is one message rather than two.~~ | Not visually verified. |

## 3. Lead capture & administration (PRD pillars 2 & 3)

| # | Screen | Notes | TODO |
|---|---|---|---|
All seven are one component — `features/lead/lead-sheet` in create or edit mode, routed at
`/lead/new` and `/lead/:id` as children of the dashboard so the board stays behind it.
One save commits fields, note and checklist answers together through the `save_lead` RPC.

| # | Screen | Notes | TODO |
|---|---|---|---|
| 3.1 | ~~**Add lead**~~ | ~~Create mode: fields only, no timeline or checklist because there is nothing to show yet. **Name is the only requirement** — contact details stay optional so a lead can be captured before the number is known.~~ | Not visually verified. **Per-field help is built** (G-23): a `למה זה חשוב?` toggle beside each of the seven labels reveals one line beneath the field, one open at a time — the checklist's own mechanic, not a hover tooltip, because the primary device has no hover. The status control also carries a **live** stage line: what the selected stage means, and what to do next, updating as the selection changes and before any save. |
| 3.2 | ~~**Lead detail**~~ | ~~Header, fields, checklist, timeline, composer, one save. Opens from the register row, board card and day-sheet item — all three by name, so the kebab is not swallowed. Carries the follow-up line: set, change or clear a reminder, committed by the same one save via `save_lead`'s reminder parameters.~~ | Not visually verified. Per-field help and the live stage line are built (see 3.1). A **next-step line** sits above the fields: the one thing to do with this lead, urgent reasons carrying a verb and healthy leads carrying the stage's own advice — absent for won/lost, which are owed nothing. Arriving with `?at=checklist` or `?at=note` lands on the checklist or the composer. |
| 3.3 | ~~**Edit lead**~~ | ~~Same component, edit mode. The open question is closed: an inline mode on 3.2, not a separate route.~~ | — |
| 3.4 | ~~**Qualification checklist**~~ | ~~5 rows in PM order, each a radiogroup of three segments (כן / לא / ?) where the selected one takes an ink fill. A per-row "why ask?" carries the teaching. Answers commit with the one save; untouched items stay absent, so "not asked" stays distinct from "unknown".~~ | Not visually verified. |
| 3.5 | ~~**Log activity**~~ | ~~Composer with four type chips (שיחה · אימייל · פגישה · הערה) above the textarea. Part of the save, not a second action.~~ | Not visually verified. Notes are append-only by design — no edit, no delete. |
| 3.6 | ~~**Close lead (won / lost)**~~ | ~~Inline in the fields, never a second dialog. Lost requires a reason, with chips writing into free text. Won confirms the final amount, so conversion analytics do not report estimates as revenue.~~ | Not visually verified. |
| 3.7 | ~~**Delete lead confirmation**~~ | ~~Two-step in the footer strip, naming the blast radius including the activity count. Same in-place pattern as the unsaved-changes guard — no modal over a modal.~~ | Not visually verified. |

## 4. Reminders

| # | Screen | Notes | TODO |
|---|---|---|---|
| 4.1 | ~~**Reminders list**~~ | ~~Compact density, four bands — באיחור · היום · בהמשך, then a rule and בלי תזכורת (capped suggestions from derived urgency). All four states: skeleton, empty, load failure with retry, populated. Overdue is carried by the band heading and a red stamp, never a red row. Per-row busy, complete and reschedule.~~ | Not visually verified. The screen is the **explicit** reminders; derived urgency stays on the day sheet and appears here only as promotable suggestions — reasoning in `docs/ARCHITECTURE.md` §6.1. |
| 4.2 | ~~**Snooze / reschedule**~~ | ~~Inline expansion in the row, never a modal: three chips (מחר · בעוד 3 ימים · בעוד שבוע), a native `<input type="date">` with `min` = today, save and cancel. Writes 09:00 local — the product reasons in whole days everywhere. `lf-due-picker`, shared with lead detail.~~ | Not visually verified. The day sheet and the row/card kebab now both use this control — inline in the row on the sheet, and as a second page of the same overlay panel in the kebab. G-32 closed. |
| 4.3 | ~~**Login toast**~~ | ~~One per browser session, on the first successful read, when overdue + today > 0. Overdue takes precedence; the action lands on `/reminders`. Never the critical popup. In-app only at launch — no email digest, no push (`docs/ARCHITECTURE.md` §6).~~ | Nothing open. The rule is a pure function (`reminder-digest.ts`) with all six suppression cases under unit cover. |

## 5. Analytics (PRD pillar 4)

| # | Screen | Notes | TODO |
|---|---|---|---|
**Two deliberate deviations, both reasoned:** conversion is `won ÷ decided`, not the PRD's
literal "Won vs. Total" — counting still-open leads as failures shows a beginner a punishing
number with no explanation, and the figure names its own denominator on screen. And the charts
are semantic HTML, not `p-chart` as `docs/ARCHITECTURE.md` maps: six labelled bars are a list,
so they are screen-readable, selectable and printable. Chart.js earns its place at the first
real time-series.

| 5.1 | ~~**Insights overview**~~ | ~~Three ruled bands — total, conversion, value in play — plus closed value. Never a KPI tile row. Every figure carries a plain-language line saying what it means, which is the pillar's whole purpose.~~ | Not visually verified. The aggregate's arithmetic is unverified against real rows: no DB password this session, so `lead_stats` has been validated by Postgres at creation but never executed. |
| 5.2 | ~~**Pipeline progression**~~ | ~~Stage reach as labelled bars in the pipeline ramp: how many leads ever got to each stage, so "where do I lose them" reads instantly. Stage history is now modelled — `from_status`/`to_status` columns, trigger updated, existing rows backfilled by parsing the old display text once.~~ | Not a time-series. A trend chart needs months of history and a reader who parses one; revisit when there is history worth plotting, with the axis running right-to-left. |
| 5.3 | ~~**Source breakdown**~~ | ~~Two columns per source — how many came in, how many closed — sorted by close rate, so the answer is the first row. Never a pie: a pie shows volume and hides the only thing that matters. Each row links into the register filtered by that source.~~ | Nothing open. The register reads `?source=`, scopes the stage counts and the total to it, names the active filter in a removable chip, and falls back to everything on an unrecognised value. Board view has no chip — list-only, open question. |
| 5.4 | ~~**Analytics empty & thin states**~~ | ~~Two states. No leads: dashed container, one action. **Not enough leads: figures show, comparisons withhold** — below 10 decided leads no ratio between sources appears at all, not even caveated, because people remember the number and forget the disclaimer.~~ | The 10-decided threshold is a judgement call, not a derived constant. Revisit against real usage. |

## 6. Auth & account

Signed-out routes live under `/auth/*` and render bare; everything else renders inside
`Shell` behind `authGuard`.

| # | Screen | Notes | TODO |
|---|---|---|---|
| 6.1 | ~~**Sign in**~~ | ~~Email/password posted bill, red commit band, footer strip to sign-up and reset. `returnUrl` filtered through `safeReturnUrl` against open redirects.~~ | OAuth is a config-level promise, not built: no provider buttons, no callback route. |
| 6.2 | ~~**Sign up**~~ | ~~Name/email/password; the DB trigger creates the personal tenant plus the demo lead. Lands straight on the board.~~ | The branch that surfaces `emailNotConfirmed` is unreachable while `enable_confirmations = false`, so it has never run. Revisit with 6.5. |
| 6.3 | ~~**Password reset — request**~~ | ~~Confirmation never reveals whether an address is registered.~~ | Delivery rides Supabase's built-in sender: rate-limited and unbranded. Needs real SMTP before launch — no client code changes. |
| 6.4 | ~~**Password reset — set new**~~ | ~~Deep-linked from the email; outside `guestGuard` because a recovery link mints a real session. Dead links land on an expired state that offers a fresh one.~~ | Never exercised end-to-end — no mail has been sent yet. Verify the real link and the real expiry once a sender exists. |
| 6.5 | **Email confirmation landing** | | Whole screen. Not needed yet: `enable_confirmations = false` and no SMTP sender is configured. Build with 6.3's sender. |
| 6.6 | ~~**Profile / account settings**~~ | ~~Display name, password change (reauth first), theme (light/dark/system), sign out, and the entry to account deletion.~~ | Email is read-only — changing it needs the `double_confirm_changes` flow and a sender (G-15, deferred). **The business name is now editable** under the display name, through `updateTenantName`; RLS already restricted it to the tenant owner, so no migration was needed. Appearance also carries **הסברים** (full / מצומצם), which flips the field help and stage meanings between always-open and one-tap-away. Full is the default, including for accounts that predate the setting (G-45). |
| 6.7 | **First-run welcome** | **Dropped** (2026-08-03). The demo lead and the day-sheet explainer the trigger creates already carry activation; a welcome screen would only stand between someone and their board. | None — the decision closes it. |

**Open across all of §6:** no live visual inspection round has been run (desktop + mobile),
and `environment.ts` (production) still has an empty `supabaseUrl` / `supabasePublishableKey`.
A production build now *crashes at bootstrap* because of it — `SupabaseService` is injected
eagerly and refuses to construct unconfigured.

## 7. Legal & compliance

| # | Screen | Notes | TODO |
|---|---|---|---|
| 7.1 | **Privacy notice** | Required by Israeli Amendment 13 (`docs/ARCHITECTURE.md` §9): what lead data is stored, why, where, and how it is deleted. | Whole screen, plus a link to it from sign-up and from the profile. |
| 7.2 | **Terms** | | Whole screen. |
| 7.3 | ~~**Delete account / tenant**~~ | ~~Its own route, not a modal, so the two steps are genuinely separate. Counts the real rows before asking. The `delete-account` Edge Function removes the `auth.users` row; the FK cascades and the orphan-tenant trigger do the rest.~~ | Not deployed. Needs `supabase functions deploy delete-account` and `supabase secrets set SUPABASE_SECRET_KEY=sb_secret_…`; until then the button reaches nothing. Never run against a real account. |

## 8. Deferred (do not design as if shipped)

| # | Screen | Notes |
|---|---|---|
| 8.1 | Embeddable web-form builder | PRD marks it explicitly future. |
| 8.2 | Public capture form | Needs the `capture-form` Edge Function first. |
| 8.3 | Team invite / members | Post-launch. |
| 8.4 | Custom checklist items | V2 backlog per the PM decisions doc. |

## 9. Pipeline & automations — built 2026-08-04

Both phases built on `feat/stages-and-automations`; all nine migrations applied to dev, and
`public.lead_status` no longer exists. Plans: `documents/PLAN-stages.md`,
`documents/PLAN-automations.md`. The interface the parallel work was held to:
`documents/CONTRACT-stages.md`. **None of these four has been opened by a human — GAPS G-40**;
scenarios are in `MANUAL-TESTS.md` §7, and P1 (a rename must move no number) is the one that
matters most.

| # | Screen | Notes | TODO |
|---|---|---|---|
| 9.1 | ~~**Stage manager**~~ | ~~Owner-only, at `/settings/stages`. Rename, reorder by drag (one atomic `reorder_stages` RPC), add via a template picker that brings its own guidance copy, archive with a destination for the leads left behind (`archive_stage`, one transaction). Per stage: short name, one of eight pre-contrast-checked swatches, drift days, `expects_reply`, meaning and guidance.~~ | Not visually verified (G-40). No un-archive control yet — archived stages are listed but cannot be brought back. |
| 9.2 | ~~**Automations on a stage**~~ | ~~A section inside 9.1, not its own route, because the model is "this stage does this". One line per rule, restated in plain Hebrew from trigger + action + config. Suspended rules stay visible with their reason when the stage is archived — suspended is not disabled.~~ | Not visually verified (G-40). No per-tenant rule cap — `PLAN-automations.md` §10 Q2 is still an open PM question. |
| 9.3 | ~~**Rule editor**~~ | ~~In-place expansion, never a modal — the pattern 3.6, 3.7 and 4.2 set. Trigger, then action, then the action's fields, ending in a full sentence read back before saving. Webhook URLs are refused at save time for non-HTTPS, embedded credentials and any literal private/loopback/link-local host.~~ | Not visually verified (G-40). |
| 9.4 | ~~**Automation run log**~~ | ~~Last 50 runs per rule: when, which lead, done / failed / skipped / queued, and the skip reason in the words the database wrote. The only place a user can discover their webhook has been failing for a week.~~ | Not visually verified (G-40). **The dry run is a client-side simulation and says so** — a true one needs a `dry_run` branch in `fire_automation_run`. |

---

## Count

| State | Screens |
|-------|---------|
| Built | 35 |
| Built, nothing open | 9 — 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 2.5, 3.3, 4.3 |
| Built, something still open | 26 |
| Unbuilt, in scope (§1–§7) | 4 — 1.4, 6.5, 7.1, 7.2 |
| Dropped (6.7) | 1 |
| Deferred (§8) | 4 |
| Planned, specified, nothing built (§9) | 4 — 9.1, 9.2, 9.3, 9.4 |

§1–§7 holds 40 screens: 35 built + 4 unbuilt + 1 dropped. (2.9 was found while building
2.7 and added to the list rather than fixed silently. §4 landed 2026-08-03.)

**The largest open risk is not a missing screen: most of what is built has never been opened
by a human.** §3, §4 and §6 are code-complete, type-checked, unit-covered and unseen.
Scenarios are written — `documents/MANUAL-TESTS.md` — and running them outranks building
anything new.

**Both outstanding migrations are applied** as of 2026-08-03 and verified against a schema
dump of the dev project: demo leads no longer count toward any insights figure (G-18), and a
note saved on the lead sheet closes the follow-up when it is typed as a call, email or meeting
(G-26). The insights arithmetic is still unverified against real rows (G-16) — but it can now
be checked honestly, which it could not before.

**Then, in order** (`documents/PLAN-gaps.md` §10): deploy `delete-account` (G-14, needs an
interactive `supabase login`), and the two legal screens 7.1/7.2 before any user who is not
the author. Everything else in §1–§7 is either done or deliberately deferred.
