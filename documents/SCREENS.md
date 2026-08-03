# Screens — LeadFlow Manager

> Derived from the PRD's four pillars, `docs/ARCHITECTURE.md` §7 (route map), and `PRODUCT.md`.
> ~~Struck through~~ = built and running. Everything else is unbuilt.
> Last updated: 2026-08-02

Every screen is Hebrew/RTL, mobile-first at 390px, and follows `docs/DESIGN-SYSTEM.md` v2.0.
"Screen" here means a route or a full-surface overlay (drawer/dialog), not a component.

---

## 1. Shell

| # | Screen | Notes |
|---|---|---|
| 1.1 | ~~**App shell — masthead**~~ | ~~Ink masthead, brand lockup, reminders bell + badge, tenant monogram. Desktop adds inline nav.~~ |
| 1.2 | ~~**App shell — bottom tabs**~~ | ~~Four tabs under 900px; active item marked by the yellow rule. Unbuilt destinations are `aria-disabled`, not dead links.~~ |
| 1.3 | ~~**App shell — primary action band**~~ | ~~Full-width red band above the tabs on mobile; red button in the masthead on desktop. Currently a button with no target.~~ |
| 1.4 | **Tenant switcher** | Only matters once a user belongs to more than one tenant. Post-launch with invites. |
| 1.5 | ~~**Global notifications — critical popup**~~ | ~~Fires for one case only: a write that did not persist. Torn-sheet mark, structured text, `נסה שוב` re-runs the failed mutation, always dismissible.~~ |
| 1.6 | ~~**Global notifications — toast stack**~~ | ~~Success, info, recoverable failures, and the checklist nudge, which shares the stack. Max 3, auto-dismiss, holds on hover/focus.~~ |
| 1.7 | ~~**Offline banner**~~ | ~~Ink strip under the masthead that pushes content; writes are blocked with an explanation while it is up; confirms on reconnect.~~ |

## 2. Dashboard (PRD pillar 1)

| # | Screen | Notes |
|---|---|---|
| 2.1 | ~~**Dashboard — day sheet**~~ | ~~The yellow sheet: open items at display scale, per-item action, snooze, cleared-today strikethrough, show-all, pasted explainer.~~ |
| 2.2 | ~~**Dashboard — register (list view)**~~ | ~~Attention flags, stage tags, values, last touch, per-row menu. Real columns at ≥900px.~~ |
| 2.3 | ~~**Dashboard — board (kanban)**~~ | ~~Six columns RTL, CDK drag-and-drop, drop placeholder, per-card stage menu. Activates at ≥768px only.~~ |
| 2.4 | ~~**Dashboard — search & stage filters**~~ | ~~Search across name, company, phone, email; stage chip strip with counts.~~ |
| 2.5 | ~~**Dashboard — empty & no-results states**~~ | ~~Dashed container, geometric mark, one action. Separate copy for "no leads yet" vs "nothing matched".~~ |
| 2.6 | ~~**Dashboard — checklist nudge**~~ | ~~Pasted advisory after a stage move with open questions. Always carries `לא עכשיו`.~~ |
| 2.7 | ~~**Dashboard — loading skeleton**~~ | ~~Opaque `--lf-skeleton` bars that breathe, never a shimmer sweep. Day sheet and register both. Shows only on the first read, not after a write.~~ |
| 2.8 | ~~**Dashboard — sort control**~~ | ~~Four sorts — דחיפות (default), שווי, מי שקט מזמן, תאריך הוספה. Native select: on a phone the OS picker beats a custom menu and is accessible for free.~~ |
| 2.9 | ~~**Dashboard — load failure**~~ | ~~A failed read used to render "you have no leads yet". Now its own state, with a retry, replacing both regions so there is one message rather than two.~~ |

## 3. Lead capture & administration (PRD pillars 2 & 3)

| # | Screen | Notes |
|---|---|---|
| 3.1 | **Add lead** | Bottom drawer on mobile, dialog on desktop. Essential fields with per-field tooltips, source selection, inline validation. The `ליד חדש` action has nothing behind it today. |
| 3.2 | **Lead detail** | The biggest unbuilt surface: header, fields, stage control, qualification checklist, activity timeline, reminders. |
| 3.3 | **Edit lead** | Same form as 3.1 in edit mode; decide whether it is a separate route or an inline mode on 3.2. |
| 3.4 | **Qualification checklist** | Fixed 5 items, tri-state (`yes` / `no` / `unknown`), stored per lead. Lives inside 3.2 but is its own design problem. |
| 3.5 | **Log activity** | Call · email · meeting · note. Reachable from the day sheet, the row menu, and lead detail — one surface, three entries. |
| 3.6 | **Close lead (won / lost)** | Won confirmation; Lost requires a reason, per the PRD's Close step. |
| 3.7 | **Delete lead confirmation** | Destructive, so it confirms. Demo leads delete without ceremony. |

## 4. Reminders

| # | Screen | Notes |
|---|---|---|
| 4.1 | **Reminders list** | Compact density. Due / overdue / upcoming. The badge in the masthead already counts them. |
| 4.2 | **Snooze / reschedule** | Currently a one-tap "tomorrow" in the store; needs a real date choice. |
| 4.3 | **Login toast** | In-app only at launch — no email digest, no push (`docs/ARCHITECTURE.md` §6). |

## 5. Analytics (PRD pillar 4)

| # | Screen | Notes |
|---|---|---|
| 5.1 | **Insights overview** | Total leads, conversion rate, pipeline value. Each metric ships with a plain-language explanation — the PRD's "educational insights". |
| 5.2 | **Pipeline progression** | Leads through stages over time. RTL time axis. |
| 5.3 | **Source breakdown** | Which sources actually convert. |
| 5.4 | **Analytics empty state** | A new user has no data; this must teach rather than show zeros. |

## 6. Auth & account

| # | Screen | Notes |
|---|---|---|
| 6.1 | ~~**Sign in**~~ | ~~Email/password. Built out of necessity: every lead policy is `to authenticated`, so without it the dashboard reads an empty pipeline. Minimal — not the finished auth surface.~~ |
| 6.2 | **Sign up** | Trigger creates the personal tenant plus the demo lead. |
| 6.3 | **Password reset — request** | |
| 6.4 | **Password reset — set new** | Deep-linked from the email. |
| 6.5 | **Email confirmation landing** | |
| 6.6 | **Profile / account settings** | Display name, theme, delete account. |
| 6.7 | **First-run welcome** | Optional. The demo lead plus the sheet explainer may already cover activation — decide before building. |

## 7. Legal & compliance

| # | Screen | Notes |
|---|---|---|
| 7.1 | **Privacy notice** | Required by Israeli Amendment 13 (`docs/ARCHITECTURE.md` §9): what lead data is stored, why, where, and how it is deleted. |
| 7.2 | **Terms** | |
| 7.3 | **Delete account / tenant** | Cascade delete of all tenant data. Destructive and irreversible — confirms explicitly. |

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
| Built | 16 |
| Remaining in scope (§1–§7) | 23 |
| Deferred (§8) | 4 |

Sign-in (6.1) is built because RLS made it a prerequisite, not because auth was scheduled.
Lead detail (3.2) has a confirmed brief and is parked.

**Nearest useful next screen: 3.2 lead detail** — every row, card and day-sheet item already points at it, and today they point at nothing.
