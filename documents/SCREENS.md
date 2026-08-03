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
| 2.6 | ~~**Dashboard — checklist nudge**~~ | ~~Pasted advisory after a stage move with open questions. Always carries `לא עכשיו`.~~ | `fillNow` marks all five items answered at once — a stand-in until 3.4 exists. |
| 2.7 | **Dashboard — loading skeleton** | Opaque `--lf-skeleton` bars, no shimmer. | Whole screen — but no longer blocked: the store is async and already exposes a loading flag. |
| 2.8 | **Dashboard — sort control** | | Whole screen. `מיון: לפי דחיפות` is static text, not a control. |

## 3. Lead capture & administration (PRD pillars 2 & 3)

| # | Screen | Notes | TODO |
|---|---|---|---|
| 3.1 | **Add lead** | Bottom drawer on mobile, dialog on desktop. Essential fields with per-field tooltips, source selection, inline validation. | Whole screen. Three built entry points already point at it: the mobile band, the desktop CTA, and the empty state. `lf-text-field` and `lf-form-error` are ready to reuse. |
| 3.2 | **Lead detail** | The biggest unbuilt surface: header, fields, stage control, qualification checklist, activity timeline, reminders. | Whole screen. Every row, card and day-sheet item points here and today they point at nothing. |
| 3.3 | **Edit lead** | Same form as 3.1 in edit mode. | Whole screen, plus the open decision: separate route or an inline mode on 3.2. |
| 3.4 | **Qualification checklist** | Fixed 5 items, tri-state (`yes` / `no` / `unknown`), stored per lead. | Whole screen. `qualification_answers` is read for progress but never written. 2.6 currently fakes the completion it asks for. |
| 3.5 | **Log activity** | Call · email · meeting · note. | Whole screen. The store already inserts activities, so this is the surface, not the plumbing. |
| 3.6 | **Close lead (won / lost)** | Won confirmation; Lost requires a reason, per the PRD's Close step. | Whole screen. The stage control already reaches `won`/`lost` with no ceremony and no reason captured. |
| 3.7 | **Delete lead confirmation** | Destructive, so it confirms. Demo leads delete without ceremony. | Whole screen. `lf-alert-dialog` is available; the delete-account page is the worked example of the two-step pattern. |

## 4. Reminders

| # | Screen | Notes | TODO |
|---|---|---|---|
| 4.1 | **Reminders list** | Compact density. Due / overdue / upcoming. | Whole screen. Unblocks the masthead bell, the hardcoded badge, and two `aria-disabled` tabs. Rows already come back nested on the leads query. |
| 4.2 | **Snooze / reschedule** | | Whole screen. Replaces the one-tap "tomorrow" the store writes today. |
| 4.3 | **Login toast** | In-app only at launch — no email digest, no push (`docs/ARCHITECTURE.md` §6). | Whole screen. `NotifyService` already carries the surface it needs. |

## 5. Analytics (PRD pillar 4)

| # | Screen | Notes | TODO |
|---|---|---|---|
| 5.1 | **Insights overview** | Total leads, conversion rate, pipeline value. Each metric ships with a plain-language explanation — the PRD's "educational insights". | Whole screen. |
| 5.2 | **Pipeline progression** | Leads through stages over time. RTL time axis. | Whole screen. Needs stage-change history, which nothing records today — an activity row is written per move, so the history is recoverable but not modelled. |
| 5.3 | **Source breakdown** | Which sources actually convert. | Whole screen. Source is on the lead but has no entry surface until 3.1. |
| 5.4 | **Analytics empty state** | A new user has no data; this must teach rather than show zeros. | Whole screen. |

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
| Built | 18 |
| Built, with something still open | 17 of the 18 — only 1.5 is closed |
| Unbuilt, in scope (§1–§7) | 20 |
| Dropped (6.7) | 1 |
| Deferred (§8) | 4 |

§1–§7 holds 39 screens: 18 built + 20 unbuilt + 1 dropped.

**Nearest useful next screen: 3.2 lead detail** — every row, card and day-sheet item already
points at it, and today they point at nothing. 3.1 add-lead is the close second, and it is
what three built controls are waiting on.
