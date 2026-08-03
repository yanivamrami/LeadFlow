# Gaps & open work — LeadFlow Manager

> The cross-cutting register: **doc-vs-code drift**, **promises with no implementation**, and
> **deploy/config debt**. It holds what `documents/SCREENS.md` cannot — SCREENS.md tracks one
> screen at a time in its TODO column; this file tracks the things that span screens, span
> documents, or live entirely outside the client.
>
> Every item carries: what the docs promise, what the code actually does, and the decision
> still open. An item is deleted only when the gap is closed in code *or* the promise is
> withdrawn from the document that made it — never because it stopped being interesting.
>
> **How to implement each open item: `documents/PLAN-gaps.md`.**
> **How to test the screens by hand: `documents/MANUAL-TESTS.md`.**
> Reminders (§1) were built on 2026-08-03 — the plan that produced them is
> `documents/PLAN-reminders.md`, kept for the decisions it records.
>
> Not a scope document: `documents/Product Requirements Document LeadFlow Manager.md` remains
> the source of truth for what the product is.
>
> Last updated: 2026-08-03

---

## Standing project decisions (2026-08-03)

These reframe several items below. Recorded here so nothing is treated as urgent that isn't:

- **No production deployment is near.** Prod config, hosting and prod-only crashes are real but
  not blocking. Dev Supabase project only.
- **Single-user, self-use for now.** Tenants exist in the schema and work, but sign-ups, email
  delivery, invites and multi-tenant switching are not in the near path.
- **Legal screens are still tracked**, because they are legally required *before* real users —
  not because they are needed this week.

---

## Legend

| Field | Meaning |
|---|---|
| **ID** | Stable reference (`G-n`). Never reused after deletion. |
| **Size** | `wiring` = minutes, one file. `screen` = a whole surface. `backend` = migration or Edge Function. `decision` = nothing to build until someone chooses. |
| **State** | `open` · `deferred` (real, deliberately not now) · `closed` (resolved; kept as a record so it is not re-raised). |

---

## 1. Reminders

Built 2026-08-03 per `documents/PLAN-reminders.md`: `/reminders` with four bands, the shared
`lf-due-picker`, set/clear on lead detail through `save_lead`, and the login digest. **G-1, G-2,
G-3, G-4, G-6 and G-8 are closed and deleted** — the wiring they described exists.

Still tracked:

| ID | Gap | State |
|---|---|---|
| G-5 | ARCHITECTURE §3/§6 described a reminder-generating trigger + `reminders-due` cron that were never built; `openReason()` replaced them | **closed by decision** — the generator is deliberately not built, and the reasoning is now recorded in `docs/ARCHITECTURE.md` §6.1, which supersedes both promises. Revisit only when the email digest arrives, because a client rule cannot send mail |
| G-7 | `reminders.assigned_to` | **closed by decision** — written with the creator's id on every client-created reminder, read nowhere yet. It cannot be backfilled once rows exist without inventing history, and it costs one column value now. Recorded in ARCHITECTURE §6.1 |
| G-9 | PRD's "customizable notification options" narrowed to in-app only | closed |
| G-26 | **`save_lead` does not close open reminders.** Logging a note from the day sheet clears the follow-up (`logActivity` → `closeOpenReminders`); logging the same note from the lead sheet does not. Same user action, two different outcomes. **Now partly reachable from the sheet** — the follow-up line can clear a reminder explicitly, but typing a note there still leaves it open | open |
| G-32 | **The day sheet's `דחה` still pushes a fixed one day.** `lf-due-picker` now exists and is the intended target (`PLAN-reminders.md` §4.2, overridden by the user in `PLAN-gaps.md` §1c): the button should open the chooser anchored to the row and lose its `ליום`. Deliberately out of scope for the reminders build — it is a day-sheet change | wiring · open |
| G-33 | **`/reminders` has not been opened by a human.** Same standing lesson as G-17: code-complete, type-checked, 49 unit tests green, never seen at 390px or on desktop | decision · open |

---

## 2. Doc-vs-code drift

| ID | Gap | Detail | Size | State |
|---|---|---|---|---|
| G-10 | ARCHITECTURE described a reminder writer that does not exist | **Closed.** §3 step 4 and §6's `reminders-due` are struck through in the document itself and replaced by `docs/ARCHITECTURE.md` §6.1, which records why derived urgency replaced the generator and when to revisit. See G-5. | decision | closed |
| G-11 | Conversion is `won ÷ decided`, not the PRD's "Won vs. Total" | Deliberate, reasoned in SCREENS §5, and the figure names its own denominator on screen. Logged so nobody "fixes" it back from the PRD alone. | decision | closed |
| G-12 | Charts are semantic HTML, not `p-chart` | ARCHITECTURE maps analytics to PrimeNG charts; six labelled bars are a list, so they stay screen-readable and printable. Chart.js earns its place at the first real time-series. | decision | closed |
| G-31 | **`רשום פעילות` logs its own label as the note body** | The row menu, the board card menu and the day sheet all call `logActivity(id, <the button's label>)` (`register.ts:68`, `board.ts:58`, `day-sheet.ts:58`), so the timeline records entries reading `רשום פעילות` / `חייג` — imperatives addressed to the user, stored as if they were a record of what happened. Side effects are correct (last touch resets, the item clears, reminders close); the content is a placeholder, on the one screen whose job is to say what happened. Fix in `PLAN-gaps.md` §1d. | wiring | open |
| G-30 | **Stale statements in the docs themselves** | Three, found while writing this file. (a) `PRODUCT.md:73` says the app "runs the dashboard route against authored demo data in `client/src/app/core/demo-leads.ts` — no Supabase connection yet"; that file **no longer exists** and the store reads real rows. (b) SCREENS 2.1/2.2/2.3 TODOs say items "point at lead detail (3.2), which does not exist" — 3.2 is built and all three entry points are wired (`register.html:53`, `board.html:28`, `day-sheet.html:32`). (c) SCREENS 1.3 says the action band "has no target"; `shell.html:22` routes to `/lead/new`. A reader trusting these plans the wrong work. | wiring | open |
| G-18 | **Demo leads are counted in analytics** | PRODUCT.md:35 and ARCHITECTURE §5 both state demo leads are *excluded from analytics*. `lead_stats` (`20260803120000_stage_history_and_stats.sql:82`) selects `from public.leads where tenant_id = p_tenant_id` with **no `is_demo` filter**, so the signup trigger's sample lead inflates total, open value, stage reach and its source's row. On a fresh account with 1 real lead the insights screen is 50% fiction. | backend | open |

---

## 3. Deploy & config debt

| ID | Gap | Detail | Size | State |
|---|---|---|---|---|
| G-13 | Production build crashes at bootstrap | `environment.ts` (production) has empty `supabaseUrl` / `supabasePublishableKey`; `SupabaseService` is injected eagerly and refuses to construct unconfigured. | backend | deferred — no prod deployment planned |
| G-14 | `delete-account` Edge Function not deployed | The function **exists and is written** (`client/supabase/functions/delete-account/index.ts`): JWT-verified, identity from the token never the body, secret key from env. It has simply never been deployed, so screen 7.3's button reaches nothing. Needs `functions deploy` + one secret. **Now in scope** — and the deploy process gets a walkthrough, see PLAN-gaps §2. | backend | open |
| G-15 | No SMTP sender | Blocks password reset delivery (6.3/6.4), email confirmation (6.5), email change (6.6). | backend | deferred — self-use, no sign-ups |
| G-16 | `lead_stats` arithmetic never executed | Accepted by Postgres at creation, never run against real rows. See MANUAL-TESTS §3 for how to verify it by hand. | backend | open |
| G-17 | No visual/manual round on §3 or §6 | Fourteen screens are code-complete, type-checked, and have never been opened by a human. Scenarios now written: `documents/MANUAL-TESTS.md`. | decision | open |

---

## 4. Feature gaps — real, not blocking self-use

| ID | Gap | Detail | Size | State |
|---|---|---|---|---|
| G-19 | **Privacy notice (SCREENS 7.1)** | Required by Israeli Amendment 13 (ARCHITECTURE §9): what lead data is stored, why, where, how it is deleted. Nothing exists, and nothing links to it from sign-up or profile. Must exist **before any real user other than you**. | screen | deferred — before first external user |
| G-20 | **Terms (SCREENS 7.2)** | Same timing as G-19. | screen | deferred |
| G-21 | **Email confirmation landing (SCREENS 6.5)** | `enable_confirmations = false` in `config.toml:226` and no sender exists, so the screen has nothing to land. Also makes sign-up's `emailNotConfirmed` branch unreachable — it has never run. | screen | deferred — with G-15 |
| G-22 | **Tenant switcher (SCREENS 1.4)** | Only matters when a user belongs to more than one tenant. The client already resolves "a" tenant with `.limit(1)` (`leads.store.ts:232`) — correct for one, silently arbitrary for two. | screen | deferred — with invites (8.3) |
| G-23 | **Per-field tooltips on the lead form (SCREENS 3.1)** | PRD §2 asks for tooltips explaining each field's purpose; PRODUCT.md repeats it as a v1 capability. Built: labels plus one help line. This is the guidance layer — the product's whole positioning — missing from the screen where a beginner needs it most. | screen | open |
| G-24 | **Business / tenant name not editable** | `tenants.name` is set once by the signup trigger and no screen can change it. `updateDisplayName` (`supabase.service.ts:271`) deliberately leaves it alone. A user who typed their name wrong at signup, or renamed the business, has no route at all. | wiring | open |
| G-25 | **Signed-out screens have no offline signal** | The offline banner lives inside `Shell` (SCREENS 1.7) because the design puts it under the masthead. `/auth/*` renders bare, so a sign-in attempt with no network surfaces only as a toast, with no standing state — the one moment a user cannot tell "wrong password" from "no internet". | wiring | open |
| G-27 | **Register ignores a `source` query param** | Insights' source rows link to `/?source=…` (`insights.html:113`), but the dashboard never reads query params and `LeadsStore` has no source filter — only search + status (`leads.store.ts:139`). The link lands on an unfiltered board, so "who came from referrals" silently answers with everyone. | wiring | open |
| G-28 | **OAuth is a config-level promise only** | ARCHITECTURE calls auth "email/password + OAuth-ready" and PRODUCT.md's stack line implies it. Reality: every `[auth.external.*]` provider in `config.toml` is `enabled = false`, there are no provider buttons on 6.1/6.2, and no callback route exists. "OAuth-ready" means the platform supports it, not that the product does. | screen | deferred — self-use |

---

## 5. Closed by decision (kept so they are not re-raised)

| ID | Item | Resolution |
|---|---|---|
| G-29 | The impeccable detector flags the toast's `border-inline-start: 4px solid` (`toast-stack.ts:93`) as the "side-tab accent" anti-pattern | **False positive — justified, no change.** `docs/DESIGN-SYSTEM.md` specifies it three times (lines 203, 212, 329): the toast *is* "an ink block with a 4px inline-start rule", and the nudge is the same object so they share one stack. `--lf-rule-w: 4px` is the system's own section-rule width (line 54), not a borrowed Material accent bar. The anti-pattern it resembles is a decorative colour bar carrying meaning alone — here the rule colour encodes kind **and** every kind also carries a Lucide mark, so colour never signals alone. Suppress the rule for `lf-toast-stack` rather than re-litigating it per audit. |
| G-9 | "Customizable notification options" (PRD §2) | Narrowed to in-app only for v1 (PRODUCT.md:36, :60). |
| G-11 | Conversion formula | See §2. |
| G-12 | Chart implementation | See §2. |

---

## 6. Where the rest lives

Per-screen open items stay in `documents/SCREENS.md`'s TODO column — 30 of the 32 built screens
still carry one. This file does not mirror them. If an item there turns out to span screens or
to contradict a document, promote it here with a new ID and leave a pointer behind.

**Next IDs start at G-34.**
