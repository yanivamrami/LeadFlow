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
| G-7 | `reminders.assigned_to` was never read or written | **Write half fixed, read half deferred.** All three writers now record who scheduled the reminder: `RemindersStore.create`, `save_lead` (`auth.uid()`, so the server decides), and the day-sheet snooze — that last one was still inserting null and was fixed on 2026-08-03. Nothing *reads* it yet, and nothing should: with one member per tenant, "assigned to Yaniv" on every row is noise. It becomes a real display when invites land (8.3) — see G-34. Writing it now is what makes that possible, because it cannot be backfilled without inventing history |
| G-9 | PRD's "customizable notification options" narrowed to in-app only | closed |
| G-26 | **Closed 2026-08-03, applied.** `save_lead` closes open reminders after writing a note, gated on `p_note_type in (call, email, meeting)` — a plain internal note is not evidence of contact. `LeadsStore.logActivity` is gated on the same three types (`CONTACT_TYPES`) so the two entry points cannot disagree. Migration `20260803150100` is applied and verified in a schema dump. | backend | closed |
| G-32 | **Closed 2026-08-03.** The day sheet, the register row menu and the board card menu all open `lf-due-picker`: inline in the row on the sheet (nothing may cover the yellow field), and as a second page of the same overlay panel in the kebab — never a stacked overlay. `snooze()` takes a date, guards a past one, and the toast names the day it landed on. `sheet.snooze` / `menu.snooze` are now `דחה`, since the label no longer promises one day | closed |
| G-33 | **`/reminders` has not been opened by a human.** Same standing lesson as G-17: code-complete, type-checked, 49 unit tests green, never seen at 390px or on desktop | decision · open |
| G-34 | **Nothing displays or edits `assigned_to`** — the read half of G-7. Needs, in order: the assignee's name on the reminder row, a member picker on that row and on the follow-up line, and an "assigned to me / to anyone" filter on `/reminders`. All three are meaningless until a tenant has two members, so this is blocked on invites (8.3) rather than open work. The data will be there when it lands, which is the entire point of writing it now | screen · deferred — with invites (8.3) |

---

## 2. Doc-vs-code drift

| ID | Gap | Detail | Size | State |
|---|---|---|---|---|
| G-10 | ARCHITECTURE described a reminder writer that does not exist | **Closed.** §3 step 4 and §6's `reminders-due` are struck through in the document itself and replaced by `docs/ARCHITECTURE.md` §6.1, which records why derived urgency replaced the generator and when to revisit. See G-5. | decision | closed |
| G-11 | Conversion is `won ÷ decided`, not the PRD's "Won vs. Total" | Deliberate, reasoned in SCREENS §5, and the figure names its own denominator on screen. Logged so nobody "fixes" it back from the PRD alone. | decision | closed |
| G-12 | Charts are semantic HTML, not `p-chart` | ARCHITECTURE maps analytics to PrimeNG charts; six labelled bars are a list, so they stay screen-readable and printable. Chart.js earns its place at the first real time-series. | decision | closed |
| G-31 | **Closed 2026-08-03.** Row and card menus navigate to `/lead/:id?at=note` and the composer takes focus, instead of writing the button label as the note body. The day sheet keeps its one tap where the verb names a concrete act — `חייג` rows log a typed **call with a null body**, so the timestamp and type carry the fact — and navigates to the composer for the two reasons whose verb names nothing. `logActivity(leadId, type, body)` replaced the old label-as-body signature | closed |
| G-30 | **Closed 2026-08-03.** `PRODUCT.md` no longer claims the app runs on authored demo data with no Supabase connection, and SCREENS.md was reconciled row by row against the code — including a count that read 32 built screens and a closing paragraph recommending a screen that already existed. Lesson recorded: a subagent ran a repo-wide `git stash` mid-session and swept every uncommitted change in the tree, which is what destroyed the first reconciliation. Agent briefs must forbid repo-wide git commands | closed |
| G-18 | **Closed 2026-08-03, applied.** `lead_stats` filters `is_demo = false` in its `mine` CTE; the exclusion propagates to `reached` and `sources` because both derive from it. The dashboard deliberately still shows demo leads. Migration `20260803150000` is applied to the dev project and verified in a schema dump, not just in the migration ledger. | backend | closed |

---

## 3. Deploy & config debt

| ID | Gap | Detail | Size | State |
|---|---|---|---|---|
| G-13 | Production build crashes at bootstrap | `environment.ts` (production) has empty `supabaseUrl` / `supabasePublishableKey`; `SupabaseService` is injected eagerly and refuses to construct unconfigured. | backend | deferred — no prod deployment planned |
| G-14 | `delete-account` Edge Function not deployed | The function **exists and is written** (`client/supabase/functions/delete-account/index.ts`): JWT-verified, identity from the token never the body, secret key from env. It has simply never been deployed, so screen 7.3's button reaches nothing. Needs `functions deploy` + one secret. **Now in scope** — and the deploy process gets a walkthrough, see PLAN-gaps §2. | backend | open |
| G-15 | No SMTP sender | Blocks password reset delivery (6.3/6.4), email confirmation (6.5), email change (6.6). | backend | deferred — self-use, no sign-ups |
| G-16 | `lead_stats` arithmetic never executed | **Now unblocked and worth doing:** the demo-lead fix is live and the pipeline has been pruned to two leads, so the figures are small enough to check by hand against `MANUAL-TESTS.md` §3. Still never validated against real rows. | backend | open |
| G-17 | No visual/manual round on §3 or §6 | Fourteen screens are code-complete, type-checked, and have never been opened by a human. Scenarios now written: `documents/MANUAL-TESTS.md`. | decision | open |

---

## 4. Feature gaps — real, not blocking self-use

| ID | Gap | Detail | Size | State |
|---|---|---|---|---|
| G-19 | **Privacy notice (SCREENS 7.1)** | Required by Israeli Amendment 13 (ARCHITECTURE §9): what lead data is stored, why, where, how it is deleted. Nothing exists, and nothing links to it from sign-up or profile. Must exist **before any real user other than you**. | screen | deferred — before first external user |
| G-20 | **Terms (SCREENS 7.2)** | Same timing as G-19. | screen | deferred |
| G-21 | **Email confirmation landing (SCREENS 6.5)** | `enable_confirmations = false` in `config.toml:226` and no sender exists, so the screen has nothing to land. Also makes sign-up's `emailNotConfirmed` branch unreachable — it has never run. | screen | deferred — with G-15 |
| G-22 | **Tenant switcher (SCREENS 1.4)** | Only matters when a user belongs to more than one tenant. The client already resolves "a" tenant with `.limit(1)` (`leads.store.ts:232`) — correct for one, silently arbitrary for two. | screen | deferred — with invites (8.3) |
| G-23 | **Closed 2026-08-03.** A `למה זה חשוב?` toggle sits beside each of the seven field labels and reveals one line beneath the field, one open at a time — generalised into `TextField` with `aria-expanded`, `aria-controls` and `aria-describedby`, so the line is announced when the input takes focus, not only when the toggle is pressed. Not a hover tooltip and not a `title`: the primary device has neither. Nothing is expanded by default | closed |
| G-24 | **Closed 2026-08-03.** A business-name field sits under the display name on the profile screen, saving through `SupabaseService.updateTenantName`. No migration was needed — `tenants_update` was already owner-only via `private.is_tenant_owner`, and a non-owner denial (`42501`) already maps to a readable Hebrew message | closed |
| G-25 | **Closed 2026-08-03.** The banner is a standalone `shared/offline-banner` rendered by `AuthPage`, so all four signed-out screens carry it; `Shell` keeps it under the masthead exactly as before. A failed auth submit while offline now says so in the same words `blockedOffline` uses, instead of a generic error | closed |
| G-27 | **Closed 2026-08-03.** `LeadsStore.sourceFilter` scopes `visibleLeads`, the stage-chip counts and the total through one `sourceScopedLeads` computed, so every figure in the filter row agrees. `dashboard.ts` reads `?source=` reactively (not a constructor snapshot), validates against `LEAD_SOURCES`, and falls back to everything on an unrecognised value. The register names the active filter in a removable chip that also strips the query param. **Board view still has no chip** — list-only, see G-40 | closed |
| G-43 | **Post-action logging prompt still unbuilt** | PRD §2 asks the app to prompt for an activity after certain actions. Moving a lead to `contacted` asserts contact happened and records nothing about it. Deliberately excluded from the guidance work: *which* move earns a prompt is a judgement worth making after using the app, and a prompt on every move is the fastest route to nagging. | screen | open |
| G-44 | **The stage-guidance toast only ever fired for a completed checklist** | `STATUS_GUIDANCE[status]` sat in the `else` branch of `moveToStage` (`leads.store.ts`) — a beginner with open questions got the checklist nudge instead, so the line telling them what a stage means was never on screen. It is what the user asked a human for on 2026-08-03. **Resolved by design, not by a second toast:** the live stage line under the dropdown and the next-step line on the lead sheet now carry the teaching permanently. Do not "fix" this later by stacking two interruptions. | decision | closed |
| G-45 | **Guidance verbosity is per-browser, not per-account** | `GuidanceService` keeps the level in `localStorage`, so it cannot tell "just signed up" from "existing account that never touched the setting" — both resolve to `full`. Accepted: an existing beginner needs the teaching no less than a new one, and the value has to be readable before any network call. If it ever must be per-account, it needs a `profiles` column written at signup. | decision | closed |
| G-40 | **No source-filter indicator in board view** | The register names an active `?source=` filter in a removable chip; the board does not, so a user who arrives from insights and switches to board sees a silently narrowed pipeline with nothing saying why. Surfaced while closing G-27. Either add the chip above the columns or let the filter strip carry it for both views. | wiring | open |
| G-41 | **Sign-out did not clear in-memory state** | **Closed 2026-08-03.** `LeadsStore`, `RemindersStore` and `InsightsStore` are root singletons and kept the previous user's leads, follow-ups and aggregates after sign-out; the cached `tenantId` also sent the next sign-in's first query to the *previous* tenant (RLS returned no rows, so not a leak — but a stale or wrongly-empty board). `SupabaseService` now increments a `sessionEpoch` on `SIGNED_OUT` and each store resets itself from an effect watching it. Deliberately a signal the stores watch rather than the service calling into them: the stores depend on the service, so the reverse would be a dependency cycle. | wiring | closed |
| G-42 | **New logic has no unit cover** | `snooze`, the retyped `logActivity`, `sourceFilter`, the dashboard's query-param handling and the three store resets are all untested — the suite is still 49 specs, none of them touching this session's work. The store logic is now non-trivial enough that a regression would be silent. | decision | open |
| G-28 | **OAuth is a config-level promise only** | ARCHITECTURE calls auth "email/password + OAuth-ready" and PRODUCT.md's stack line implies it. Reality: every `[auth.external.*]` provider in `config.toml` is `enabled = false`, there are no provider buttons on 6.1/6.2, and no callback route exists. "OAuth-ready" means the platform supports it, not that the product does. | screen | deferred — self-use |

---

## 4b. Planned phases (specified, not built)

Both plans were written 2026-08-03 and verified against the code. Neither has a line of
implementation yet.

| ID | Item | Detail | Size | State |
|---|---|---|---|---|
| G-35 | **Email automation channel** | Specified in `PLAN-automations.md` §9a, deliberately deferred. **Blocked on the same missing sender as G-15** — solve it once for password reset (6.3/6.4), confirmation (6.5), email change (6.6) and this. Then: verified sending domain with SPF/DKIM/DMARC, tenant-authored templates with lead placeholders, and bounce handling that disables a rule instead of retrying forever. ~3-5 days *after* the sender exists. | backend | deferred — with G-15 |
| G-36 | **WhatsApp automation channel** | Specified in `PLAN-automations.md` §9b, deliberately deferred, and **not an engineering decision to start.** Recipients are leads, who gave a number to get a quote rather than to be messaged; Israel's anti-spam regime (תיקון 40) requires prior consent for advertising messages, and whether a given automated message counts as advertising is counsel's call. That answer decides whether consent capture becomes a field on the lead form, a filter on every send and a column in the audit log — which reaches back into screens that are already built. Technically ordinary (Meta Cloud API or a BSP, WABA, pre-approved templates, per-message cost); the sequence is legal opinion → consent capture → BSP contract → channel. ~2-4 weeks, mostly not code. | backend | deferred — needs legal review first |
| G-37 | **Custom pipeline stages** | `PLAN-stages.md`, whole plan. The six stages are a Postgres enum (`init_schema:24`) referenced 73 times across 5 migrations and 73 times across 14 client files. Becomes per-tenant rows with a reserved `kind` (open/won/lost) so a rename changes no arithmetic. ~6 days. **Cheapest now**: dev-only, one tenant, ~15 leads — the same migration against real multi-tenant data with history costs several times more and carries real risk. | backend + screen | planned |
| G-38 | **Per-stage automations, tiers A and B** | `PLAN-automations.md` steps 1-8. Blocked on G-37, because a rule attaches to a stage row. **No Edge Function in either tier**: tier A (reminder, note, assign, auto-advance) is SQL in the stage-change trigger, and tier B (webhook) sends via `pg_net` + `pg_cron`, so nothing deploys and ARCHITECTURE §6's "no server logic exists" survives. ~8 days, of which the first ~5 ship a complete feature with no outbound traffic at all. **Carries one release condition:** `pg_net` cannot pre-resolve DNS, so the SSRF guard is a string check — before the first external tenant, tier B's sender moves to a function that resolves, or webhook hosts get an allowlist. | backend + screen | planned |
| G-39 | **Inbound HTTP endpoint — the one thing that will force an Edge Function** | Not needed by either planned phase, and worth recording so the question is not re-argued each time. Postgres can *send* (`pg_net`); it cannot *receive*. Three future things need a public endpoint: email bounce and complaint handling (G-35), WhatsApp delivery receipts and inbound messages (G-36 — the 24-hour window opens on the recipient's message, so we must be told it arrived), and the public capture form (SCREENS 8.2, already named `capture-form` in ARCHITECTURE §6). The first one built pays the deploy cost that G-14 has been deferring. | backend | deferred — with G-35 / G-36 / 8.2 |

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

**Next IDs start at G-46.**
