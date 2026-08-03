# Screens — LeadFlow Manager

> Derived from the PRD's four pillars, `docs/ARCHITECTURE.md` §7 (route map), and `PRODUCT.md`.
> ~~Struck through~~ = built and running. Everything else is unbuilt.
> The **TODO** column is never struck through: it is what is still open on that screen,
> whether the screen is built or not. "Whole screen" means nothing exists yet.
> Last updated: 2026-08-03

Every screen is Hebrew/RTL, mobile-first at 390px, and follows `docs/DESIGN-SYSTEM.md` v2.0.
"Screen" here means a route or a full-surface overlay (drawer/dialog), not a component.

---

## 1. Shell

| # | Screen | Notes | TODO |
|---|---|---|---|
| 1.1 | ~~**App shell — masthead**~~ | ~~Ink masthead, brand lockup, reminders bell + badge, tenant monogram. Desktop adds inline nav. The monogram is a link to the profile.~~ | Badge count is the literal `3` (`shell.ts:49`) although the store now loads reminders and exposes `openItems` — a small wiring job. Bell opens nothing until 4.1. Desktop `+ ליד חדש` has no target until 3.1. |
| 1.2 | ~~**App shell — bottom tabs**~~ | ~~Four tabs under 900px; active item marked by the yellow rule and `aria-current="page"`. Unbuilt destinations are `aria-disabled`, not dead links.~~ | Reminders and Insights are still `aria-disabled` spans; promote to links when 4.1 and 5.1 land. |
| 1.3 | ~~**App shell — primary action band**~~ | ~~Full-width red band above the tabs on mobile; red button in the masthead on desktop.~~ | Still a button with no target. Blocked on 3.1. |
| 1.4 | **Tenant switcher** | Only matters once a user belongs to more than one tenant. Post-launch with invites. | Whole screen. Blocked on 8.3. |
| 1.5 | ~~**Global notifications — critical popup**~~ | ~~Fires for one case only: a write that did not persist. Torn-sheet mark, structured text, `נסה שוב` re-runs the failed mutation, always dismissible.~~ | The one rule it runs on (`costsData`) has unit cover in `supabase.service.spec.ts`. Nothing open. |
| 1.6 | ~~**Global notifications — toast stack**~~ | ~~Success, info, recoverable failures, and the checklist nudge, which shares the stack. Max 3, auto-dismiss, holds on hover/focus.~~ | The impeccable detector flags `border-inline-start: 4px solid` on the toast (`toast-stack.ts:93`) as the side-tab accent anti-pattern. Either justify it as the world's rule idiom or drop it. |
| 1.7 | ~~**Offline banner**~~ | ~~Ink strip under the masthead that pushes content; writes are blocked with an explanation while it is up; confirms on reconnect.~~ | It lives inside `Shell`, because the design puts it under the masthead — so the signed-out screens have no offline signal at all, and a sign-in attempt with no network surfaces only as a toast. Decide whether the auth screens get their own. |

## 2. Dashboard (PRD pillar 1)

| # | Screen | Notes | TODO |
|---|---|---|---|
| 2.1 | ~~**Dashboard — day sheet**~~ | ~~The yellow sheet: open items at display scale, per-item action, snooze, cleared-today strikethrough, show-all, pasted explainer. Reads real rows.~~ | Items point at lead detail (3.2), which does not exist. Snooze is a fixed one-tap "tomorrow" until 4.2. |
| 2.2 | ~~**Dashboard — register (list view)**~~ | ~~Attention flags, stage tags, values, last touch, per-row menu. Real columns at ≥900px.~~ | Rows do not navigate (3.2). Row-menu delete is the demo path only (3.7). |
| 2.3 | ~~**Dashboard — board (kanban)**~~ | ~~Six columns RTL, CDK drag-and-drop, drop placeholder, per-card stage menu. Activates at ≥768px only. Stage moves persist.~~ | Cards do not open 3.2. |
| 2.4 | ~~**Dashboard — search & stage filters**~~ | ~~Search across name, company, phone, email; stage chip strip with counts.~~ | Filters the loaded array client-side. Revisit as PostgREST filters once a tenant can hold more rows than one fetch. |
| 2.5 | ~~**Dashboard — empty & no-results states**~~ | ~~Dashed container, geometric mark, one action. Separate copy for "no leads yet" vs "nothing matched".~~ | The "no leads yet" action has no target until 3.1. |
| 2.6 | ~~**Dashboard — checklist nudge**~~ | ~~Pasted advisory after a stage move with open questions. Always carries `לא עכשיו`.~~ | It now informs and waits — the "fill them in now" action was removed, because marking five questions answered without asking them is a lie about the user's own data. The action returns with 3.4. |
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
| 3.1 | ~~**Add lead**~~ | ~~Create mode: fields only, no timeline or checklist because there is nothing to show yet. **Name is the only requirement** — contact details stay optional so a lead can be captured before the number is known.~~ | Not visually verified. Per-field tooltips from the PRD are not built; the labels and one help line carry it for now. |
| 3.2 | ~~**Lead detail**~~ | ~~Header, fields, checklist, timeline, composer, one save. Opens from the register row, board card and day-sheet item — all three by name, so the kebab is not swallowed.~~ | Not visually verified. Reminders are read but not managed here (4.2). |
| 3.3 | ~~**Edit lead**~~ | ~~Same component, edit mode. The open question is closed: an inline mode on 3.2, not a separate route.~~ | — |
| 3.4 | ~~**Qualification checklist**~~ | ~~5 rows in PM order, each a radiogroup of three segments (כן / לא / ?) where the selected one takes an ink fill. A per-row "why ask?" carries the teaching. Answers commit with the one save; untouched items stay absent, so "not asked" stays distinct from "unknown".~~ | Not visually verified. |
| 3.5 | ~~**Log activity**~~ | ~~Composer with four type chips (שיחה · אימייל · פגישה · הערה) above the textarea. Part of the save, not a second action.~~ | Not visually verified. Notes are append-only by design — no edit, no delete. |
| 3.6 | ~~**Close lead (won / lost)**~~ | ~~Inline in the fields, never a second dialog. Lost requires a reason, with chips writing into free text. Won confirms the final amount, so conversion analytics do not report estimates as revenue.~~ | Not visually verified. |
| 3.7 | ~~**Delete lead confirmation**~~ | ~~Two-step in the footer strip, naming the blast radius including the activity count. Same in-place pattern as the unsaved-changes guard — no modal over a modal.~~ | Not visually verified. |

## 4. Reminders

| # | Screen | Notes | TODO |
|---|---|---|---|
| 4.1 | **Reminders list** | Compact density. Due / overdue / upcoming. | Whole screen. Unblocks the masthead bell, the hardcoded badge, and two `aria-disabled` tabs. Rows already come back nested on the leads query. |
| 4.2 | **Snooze / reschedule** | | Whole screen. Replaces the one-tap "tomorrow" the store writes today. |
| 4.3 | **Login toast** | In-app only at launch — no email digest, no push (`docs/ARCHITECTURE.md` §6). | Whole screen. `NotifyService` already carries the surface it needs. |

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
| 5.3 | ~~**Source breakdown**~~ | ~~Two columns per source — how many came in, how many closed — sorted by close rate, so the answer is the first row. Never a pie: a pie shows volume and hides the only thing that matters. Each row links into the register filtered by that source.~~ | The register does not yet read a `source` query param, so the link lands unfiltered. |
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
| 6.6 | ~~**Profile / account settings**~~ | ~~Display name, password change (reauth first), theme (light/dark/system), sign out, and the entry to account deletion.~~ | Email is read-only — changing it needs the `double_confirm_changes` flow and a sender. The tenant / business name is not editable anywhere; `updateDisplayName` deliberately leaves it alone. |
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

---

## Count

| State | Screens |
|-------|---------|
| Built | 32 |
| Built, with something still open | 30 of the 32 — 1.5 and 3.3 are closed |
| Unbuilt, in scope (§1–§7) | 7 |
| Dropped (6.7) | 1 |
| Deferred (§8) | 4 |

§1–§7 holds 40 screens: 32 built + 7 unbuilt + 1 dropped. (2.9 was found while building
2.7 and added to the list rather than fixed silently.)

**No visual round has been run on §3.** It renders behind `authGuard` and this session has
no password, so every §3 row above is code-complete and type-checked but unseen. That is
the single largest open risk on the list.

**Nearest useful next screen: 3.2 lead detail** — every row, card and day-sheet item already
points at it, and today they point at nothing. It has a confirmed brief, parked on 2026-08-03.
3.1 add-lead is the close second, and it is what three built controls are waiting on.
