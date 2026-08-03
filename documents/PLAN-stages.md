# Implementation plan — Phase 1: user-defined pipeline stages

> Turns the six hardcoded stages into per-tenant rows the user can rename, reorder, add and
> archive, without losing a single number on `/insights` or a single rule in the attention
> engine.
>
> Written against the code as of 2026-08-03. Every file and line reference below was read, not
> recalled. Nothing here is built yet.
>
> Companion: `documents/PLAN-automations.md` (Phase 2) depends on this one — automations attach
> to a stage row, so stages must be rows first.

---

## 1. The decision this plan turns on

**A stage row carries a `kind`: `open` | `won` | `lost`. The name is the user's; the meaning is
the kind's.**

Everything in the product that reasons about "closed" reasons about `won` or `lost` *by name*
today. Rename `נסגר בהצלחה` without a kind column and all of this silently breaks:

| What breaks | Where it lives now |
|---|---|
| Conversion, decided count, open value vs won value | `lead_stats`, `20260803120000_stage_history_and_stats.sql:108-115` |
| Lost-reason required; won-amount confirmation block | `lead-sheet.html:111`, `:143` |
| Closed leads stop being flagged for attention | `leads.store.ts:265`, `:306` |
| Checklist nudge suppressed on a close | `leads.store.ts:377` |
| Won/lost card and column styling | `board.html:19-20`, `board.scss:42-51` |
| Lost-reason validation | `lead-validation.ts:49` |

With `kind`, every one of those becomes a property lookup and the user can call the stage
whatever they like — `סגור`, `לקוח`, `שילם`.

**Reserved rules, enforced in the database, not by hope:**

| Rule | Why |
|---|---|
| Exactly one `won` stage and one `lost` stage per tenant | Zero breaks conversion; two makes "decided" ambiguous and every insights figure a guess. |
| At least one `open` stage | A pipeline with no open stage cannot accept a lead. |
| `won` / `lost` are **renamable and reorderable, never deletable** | The words are the user's; the concept is the product's. |
| Stages are **archived, never deleted** | `activities.to_status` is the funnel's only memory of where leads have been. Deleting a stage deletes history. |

**Second decision: archive, not delete.** A hard delete would either orphan history rows or
cascade them away, and the `reached` funnel (`…stage_history_and_stats.sql:85-105`) is built
entirely from those rows. Archived stages vanish from the board, the filter strip and the move
menu, but still resolve for a stage tag on an old activity.

---

## 2. Data & backend

### New enum and table

```sql
create type public.stage_kind as enum ('open', 'won', 'lost');

create table public.pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  name         text not null,
  short_name   text,                    -- board headers and filter chips; falls back to name
  position     integer not null,
  kind         public.stage_kind not null default 'open',
  swatch       text not null default 'slate',   -- one of a fixed set, §4.3
  meaning      text,                    -- "where you are"  (STATUS_MEANING today)
  guidance     text,                    -- "what to do next" (STATUS_GUIDANCE today)
  drift_days   integer,                 -- null = never drifts (today's won/lost Infinity)
  expects_reply boolean not null default false,  -- generalises `proposal_silent`, §4.2
  is_system    boolean not null default false,   -- seeded by signup; blocks nothing but rename
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),

  -- Mirrors leads_id_tenant_key (init_schema:88) so the composite FK below can stop a
  -- lead from pointing at another tenant's stage even if a client forges the column.
  constraint pipeline_stages_id_tenant_key unique (id, tenant_id)
);

create unique index pipeline_stages_tenant_position_idx
  on public.pipeline_stages (tenant_id, position) where archived_at is null;

-- One won and one lost per tenant, enforced rather than assumed.
create unique index pipeline_stages_one_won_idx
  on public.pipeline_stages (tenant_id) where kind = 'won' and archived_at is null;
create unique index pipeline_stages_one_lost_idx
  on public.pipeline_stages (tenant_id) where kind = 'lost' and archived_at is null;
```

RLS: same four policies as the other business tables (`init_schema:282-300`) — membership on
read and write. **One deviation: `insert`, `update` and `delete` require `is_tenant_owner`, not
just membership.** Reshaping the pipeline is not a member-level action; a member who renames the
won stage changes every number the owner sees.

### Column changes on existing tables

| Table | Change | Note |
|---|---|---|
| `leads` | `status public.lead_status` → `stage_id uuid not null`, composite FK `(stage_id, tenant_id)` → `pipeline_stages (id, tenant_id)` `on delete restrict` | `restrict` is the point: it makes an accidental stage delete fail loudly instead of taking leads with it. |
| `activities` | `from_status` / `to_status` → `from_stage_id` / `to_stage_id` uuid, same composite FK, `on delete restrict` | Added by `20260803120000…sql:12-13`; the funnel reads `to_status` at `:100`. |
| indexes | `leads_tenant_status_idx` → `(tenant_id, stage_id)` | `init_schema:141`. |

`leads.sort_order` (`init_schema:82`) exists, defaults to 0 and **is read by nothing in the
client**. Leave it; it is the obvious home for within-column ordering later, and this plan does
not need it.

### Functions to rewrite

| Function | File | What changes |
|---|---|---|
| `log_lead_status_change` | `init_schema:370-393`, hardened in `20260802154552…sql` | Compares `stage_id`; writes `from_stage_id` / `to_stage_id`. The `body` text stays for readability but stops being the source of truth. Trigger becomes `after update of stage_id`. |
| `lead_stats` | `20260803120000…sql:75-135` | **Rewritten, not edited.** `unnest(enum_range(null::public.lead_status))` (`:104`) becomes a join on `pipeline_stages` ordered by `position`. `'new' → every lead` (`:87-90`) becomes "the first open stage by position". `where status in ('won','lost')` becomes `join … where kind <> 'open'`. |
| `save_lead` | `20260803140000_save_lead_reminder.sql` | `p_status public.lead_status` → `p_stage_id uuid`. **Drop and recreate** — a changed parameter type is an overload PostgREST cannot disambiguate, the same lesson the reminder parameters already taught. |
| `create_lead` | `20260803093000_lead_write_rpcs.sql` | Same. |
| `handle_new_user` | `init_schema:398-445` | Must seed the six default stages **before** the demo lead, then point that lead at the first one. This function failing means signup failing — the riskiest edit in the migration. |

### No Edge Function, no server logic

Everything in this phase is Postgres plus the Angular client. No Edge Function, no cron, no
extension, no deploy step. `ARCHITECTURE.md` §6's "no server logic exists at launch" survives
Phase 1 untouched — worth stating because the phase touches five database functions and a
trigger, and that can read like server-side work. It is not: it is all in the request path of a
normal PostgREST call.

### Migration order (one transaction, and it must be exactly this order)

1. Create `stage_kind`, `pipeline_stages`, its indexes, RLS and policies.
2. For **every existing tenant**, insert six stages from today's constants — names, meanings,
   guidance and drift days copied out of `copy.ts:21-62` and `lead.model.ts:90-97` so nobody
   loses the teaching copy that already exists.
3. Add `leads.stage_id` nullable; `update` it by matching the old enum value to the seeded
   stage; then `set not null` and add the FK.
4. Same for `activities.from_stage_id` / `to_stage_id` (nullable stays nullable — old rows
   predate the column).
5. Rewrite the five functions and the trigger.
6. Drop `leads.status`, `activities.from_status`, `activities.to_status`, then
   `drop type public.lead_status`. The type will refuse to drop while any dependent remains,
   which is the check that step 5 was complete.

**Verify before dropping the type**, on dev, with real rows: every lead has a `stage_id`, and
`select count(*) from leads where stage_id is null` returns 0. Once the enum is gone, the old
column is unrecoverable except from a backup.

---

## 3. Client model

### The store

New root-provided `StagesStore` (`core/stages.store.ts`), same shape as `RemindersStore`: own
`load`, `loading` / `loaded` / `loadFailed`, its own writes. It is **not** part of `LeadsStore`
— the lead sheet, the board, the filter strip, the register menu, the insights funnel and the
stage manager all need the stage list, and three of those routes never load the pipeline.

```ts
export interface Stage {
  id: string;
  name: string;
  shortName: string | null;
  position: number;
  kind: 'open' | 'won' | 'lost';
  swatch: SwatchName;
  meaning: string | null;
  guidance: string | null;
  driftDays: number | null;
  expectsReply: boolean;
  archivedAt: Date | null;
}
```

Derived: `active` (unarchived, by position), `byId` (a `Map`, including archived — history needs
them), `wonStage`, `lostStage`, `firstOpen`.

**Every screen reads `stages.active()` instead of `STAGE_ORDER`.** Six call sites:
`dashboard.ts:44`, `lead-menu.ts:164`, `lead-sheet.ts:102`, `leads.store.ts:106` and `:186`,
`insights.store.ts:65`.

### The type change

`LeadStatus` (`lead.model.ts:4-9`) — a six-member union — becomes `type StageId = string`. That
is a real loss: today the compiler catches a typo in a stage name, and after this it cannot.
Compensation: `Lead.stage` resolves to a `Stage` object at fold time in `toLead`
(`leads.store.ts:276`), so components hold objects rather than loose ids, and a missing stage
becomes a load-time failure rather than a blank tag.

### Copy that moves into the database

`STATUS_LABEL` / `STATUS_SHORT` / `STATUS_MEANING` / `STATUS_GUIDANCE` (`copy.ts:21-62`) stop
being runtime constants and become **the seed data of the migration**. Keep the file's block as
a commented seed reference, then delete the runtime use — four `Record<LeadStatus, string>`
maps cannot survive a union that no longer exists.

`OPEN_REASON` and `OPEN_ACTION` (`copy.ts:72-91`) survive unchanged: they key off `OpenReason`,
not off a stage.

---

## 4. The five problems that are not mechanical

### 4.1 Archiving a stage that has leads in it

Blocking UX, so decide it here: **archiving asks where the leads go.** The stage manager shows
`4 לידים בשלב הזה` and requires a destination stage before the archive button enables. That is
one `update leads set stage_id = …` plus the archive, in an RPC so it cannot half-happen —
the same reasoning that produced `save_lead`.

Refuse outright, with an explanation rather than a disabled button: archiving the only open
stage, the won stage, or the lost stage.

### 4.2 The attention engine is stage-literal

`openReason()` (`leads.store.ts:306-320`) special-cases two stages by name:

- `proposal_sent` + 3 silent days → `proposal_silent` (`:311`)
- `new` + zero checklist answers + 1 day → `unqualified` (`:314`)

Generalise both instead of dropping them:

| Reason | Today | After |
|---|---|---|
| `proposal_silent` | `status === 'proposal_sent'` | `stage.expectsReply === true` — a stage where the ball is in their court. Seeded true on the proposal stage, and offered as a checkbox on any stage the user creates. |
| `unqualified` | `status === 'new'` | `stage.id === firstOpen().id` + zero answers. "The stage leads arrive in" is a position, not a name. |
| `drifting` | `DRIFT_DAYS[status]` (`lead.model.ts:90-97`) | `stage.driftDays`, null meaning never. |

`expects_reply` is the one genuinely new product concept in this plan, and it is worth it: it is
what lets a user's own `ממתין לחתימה` stage behave like the built-in proposal stage without
writing any code.

### 4.3 Colour, in a world with a deliberately tight palette

13 `--lf-stage-*` tokens today, one pair per stage, hand-checked for contrast
(`stage-tag.ts:30-42`, `tokens.css`). An arbitrary colour picker would wreck the שלט־שוק palette
and quietly reintroduce contrast failures the design system already paid for.

**Ship a fixed set of eight swatches**, each a pre-checked `bg`/`fg` token pair, named in the
picker by what they read as rather than by hex. `swatch` stores the name; `stage-tag` renders
`tag--sw-{{ swatch }}`. Won and lost keep their reserved treatments — red fill and a dashed
outline — driven by `kind`, so a renamed won stage still looks closed.

### 4.4 Guidance copy for stages the user invented

This is the product problem, not a code problem. `STATUS_MEANING` and `STATUS_GUIDANCE` are the
teaching layer, and the PRD's whole positioning is guided-for-beginners. A stage the user
invented has neither.

**Recommendation: a template picker on stage creation.** Adding a stage offers a short list of
common ones — `ממתין להצעה`, `ממתין לחתימה`, `בהמתנה מהלקוח`, `לא בזמן הנכון`, plus `שלב משלי` —
each arriving with `meaning`, `guidance`, a sensible `drift_days` and `expects_reply` already
set. Only `שלב משלי` leaves the copy empty, and the manager shows the empty guidance as an
optional prompt, never a required field. Rejected alternatives: requiring the user to write
guidance (they do not know what to write — that is why they bought this), and shipping custom
stages with no guidance at all (the positioning erodes one stage at a time).

### 4.5 The board with twelve columns

Better than feared: `.board` is already `display: flex` with `overflow-x: auto` and
`.col { flex: 1 1 0; min-inline-size: 200px }` (`board.scss:7-18`), so N columns scroll today.

Two changes: past six stages the columns should stop shrinking — `flex: 0 0 232px` — so the
seventh scrolls into view rather than squeezing the first six; and the RTL scroll position must
start at the **first** stage, which under RTL is the right edge. Also verify CDK drag between
columns still works while the container scrolls — `cdkDropListGroup` handles it, but this is
exactly the class of thing that broke the row menu at 900-1200px.

---

## 5. New screen — 9.1 Stage manager

Route `/settings/stages`, inside `Shell`, behind `authGuard`, owner-only. Reached from the
profile screen and from an edit affordance on the board's column headers.

Per row: name (inline edit), short name, swatch, kind badge, drift days, `expects_reply`
checkbox, guidance text, lead count, drag handle, archive. Plus `הוסף שלב` (opens the §4.4
template picker) and an archived section, collapsed.

Reorder writes `position` for the affected rows in one RPC — a reorder that half-applies leaves
a pipeline with two stages claiming position 3, which the unique index would reject anyway.

Design constraints from `docs/DESIGN-SYSTEM.md` v2.0 apply unchanged: logical properties, ≥44×44
targets, no colour-only meaning, reduced motion collapses the drag animation. Reuse the register's
drag mechanics rather than inventing a second pattern.

---

## 6. Tests

Precedent: `reminders.store.spec.ts`, `insights.store.spec.ts`, `supabase.service.spec.ts`.

- `stages.store.spec.ts` — `active` excludes archived and sorts by position; `byId` **includes**
  archived, because history resolves through it; `firstOpen` ignores won/lost; a tenant with a
  renamed won stage still returns it from `wonStage`.
- Attention engine, rewritten cases: `expects_reply` produces `proposal_silent` on a
  user-created stage; the first open stage produces `unqualified`; `driftDays === null` never
  drifts; a lead in a won-kind stage produces no reason at all (today's `leads.store.ts:306`).
- Archive guard as a pure function of `(stage, leadCount, allStages)` → allowed | needs a
  destination | refused-with-reason, so all three branches are testable without a component.
- `lead_stats` against a tenant with **seven** stages, one renamed won, and one archived stage
  that still has history rows — by hand per `MANUAL-TESTS.md` §3, since G-16 is still open.

---

## 7. Order of work

| Step | Delivers | Size | Why here |
|---|---|---|---|
| 1 | Migration: table, RLS, seed, backfill, drop the enum | 1 day | Nothing above it compiles until the shape exists. Do it on dev with real rows and verify before dropping the enum. |
| 2 | `StagesStore`, `Stage`, `toLead` resolving a stage object | half day | Every screen reads from it. |
| 3 | Six call sites off `STAGE_ORDER`; stage-tag swatches; board column sizing | 1 day | Mechanical but wide — this is the bulk of the 73 client occurrences. |
| 4 | Attention engine generalised (`expects_reply`, first-open, per-stage drift) | half day | Load-bearing: drives the day sheet, badge, register flags and urgency sort. |
| 5 | `lead_stats` rewrite + insights funnel reading dynamic stages | half day | Do it with the migration fresh in mind. Natural moment to also fix G-18's missing `is_demo` filter — same function, separate commit. |
| 6 | RPC signatures: `save_lead`, `create_lead` | half day | Follows the client work that defines what they need. |
| 7 | Stage manager screen (9.1) + template picker | 1.5 days | The user-facing feature. Last, because everything it edits must already work. |
| 8 | Specs, docs (SCREENS, GAPS, ARCHITECTURE §3/§5), manual round | 1 day | The docs are wrong until this runs. |

**~6 days.** Steps 1-6 are invisible to the user and ship nothing on their own; the feature
arrives at step 7. That is unavoidable — the refactor is the feature's cost.

---

## 8. Definition of done

- Renaming, reordering, adding and archiving stages all work, and `/insights` reports the same
  numbers before and after a **rename** (a rename must change no arithmetic at all — the best
  single test of whether `kind` was wired properly).
- A tenant with seven stages, one of them user-created with `expects_reply`, produces day-sheet
  items for it.
- `select count(*) from public.leads where stage_id is null` → 0, and `public.lead_status` no
  longer exists.
- Archiving a stage with leads in it is impossible without choosing a destination; archiving the
  won, lost or only open stage is refused with an explanation.
- Verified at 390px and desktop. Code-complete and type-checked is not done — the standing
  lesson from G-17 and G-33.

---

## 9. Open questions (PM, not engineering)

1. **Do stages become per-tenant or per-tenant-and-shared-template?** This plan says per-tenant
   rows seeded from one default set. A "pipeline template" concept (choose freelancer / agency /
   retail at signup) is a natural extension and costs nothing to add later.
2. **Is `expects_reply` exposed to the user, or inferred?** Exposed, in this plan, as one
   checkbox with a plain-language label. It could be inferred from the stage's position instead,
   but inference that drives the day sheet is a rule nobody can see.
3. **Owner-only, or any member?** This plan says owner-only for writes. Only matters once
   invites land (8.3), but the policy should be right from the first migration.
4. **The eight swatches** — a design call. Contrast must be measured per pair, on both themes,
   the way the existing 13 tokens were.
