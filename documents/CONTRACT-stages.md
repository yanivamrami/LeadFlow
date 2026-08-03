# Contract — stages & automations

> **Binding.** Phase 1 and Phase 2 are being implemented in parallel by several agents. This file
> is the single source of truth for names, shapes and boundaries. If an agent needs to deviate,
> it reports the deviation rather than deviating silently — a contract that drifts per-agent
> produces code that compiles and disagrees.
>
> Rationale for every decision lives in `PLAN-stages.md` and `PLAN-automations.md`. This file is
> the *interface*, not the argument.
>
> Branch: `feat/stages-and-automations`. Worktree: `.claude/worktrees/stages-and-automations`.

---

## 0. Two things that must not be reverted

The tree this branch is based on contains work from a **concurrent workstream**. Phase 1 rewrites
the same two database functions. Both behaviours must survive:

1. **`lead_stats` excludes demo leads** — `20260803150000_stats_exclude_demo_leads.sql` adds
   `and is_demo = false` to the `mine` CTE. The rewritten function keeps it.
2. **`save_lead` closes open reminders after real contact** —
   `20260803150100_save_lead_closes_reminders.sql`, fired only when a note was actually written
   *and* `p_note_type in ('call','email','meeting')`. The re-created function keeps that block
   verbatim, including its two guards.

Also present and not to be disturbed: the offline banner extracted to `shared/offline-banner`,
per-field lead help (G-23), store `reset()` on `sessionEpoch`, the day-sheet day chooser, and the
`?source=` filter chip.

---

## 1. Database — Phase 1

### Enum

```sql
create type public.stage_kind as enum ('open', 'won', 'lost');
```

### Table

```sql
create table public.pipeline_stages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  name          text not null,
  short_name    text,
  position      integer not null,
  kind          public.stage_kind not null default 'open',
  swatch        text not null default 'slate',
  meaning       text,
  guidance      text,
  drift_days    integer,
  expects_reply boolean not null default false,
  is_system     boolean not null default false,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint pipeline_stages_id_tenant_key unique (id, tenant_id)
);
```

Indexes and guards, all named exactly as below:

| Object | Definition |
|---|---|
| `pipeline_stages_tenant_position_idx` | unique on `(tenant_id, position)` where `archived_at is null` |
| `pipeline_stages_one_won_idx` | unique on `(tenant_id)` where `kind = 'won' and archived_at is null` |
| `pipeline_stages_one_lost_idx` | unique on `(tenant_id)` where `kind = 'lost' and archived_at is null` |
| `pipeline_stages_tenant_id_idx` | plain on `(tenant_id)` |
| `pipeline_stages_shape` | **constraint trigger**, deferrable initially deferred, calling `private.assert_pipeline_shape()`. Enforces at-least-one live open stage and exactly-one live won and lost. The partial indexes above give *at most* one; the product needs *exactly* one, and that is a cross-row assertion. Skips tenants that no longer exist so a cascading tenant delete is not blocked. |

RLS: enabled. `select` for `private.is_tenant_member(tenant_id)`. `insert` / `update` / `delete`
for **`private.is_tenant_owner(tenant_id)`** — reshaping a pipeline changes every number the owner
sees, so it is not a member-level action.

### Column swaps

| Table | From | To |
|---|---|---|
| `leads` | `status public.lead_status not null default 'new'` | `stage_id uuid not null`, composite FK `(stage_id, tenant_id)` → `pipeline_stages (id, tenant_id)` `on delete restrict` |
| `activities` | `from_status`, `to_status` | `from_stage_id`, `to_stage_id` uuid, nullable, same composite FK, `on delete restrict` |
| index | `leads_tenant_status_idx` | `leads_tenant_stage_id_idx` on `(tenant_id, stage_id)` |

`leads.sort_order` is untouched — it exists, defaults to 0, and nothing reads it.

### Seed — the six system stages, per tenant

Copy comes out of `core/copy.ts` as it stands today. Do not reword it; this is a move, not a
rewrite.

| pos | name | short_name | kind | drift_days | expects_reply | swatch |
|---|---|---|---|---|---|---|
| 0 | ליד חדש | חדש | open | 3 | false | `chalk` |
| 1 | יצרנו קשר | קשר | open | 7 | false | `sky` |
| 2 | כשיר | כשיר | open | 7 | false | `moss` |
| 3 | נשלחה הצעה | הצעה | open | 3 | **true** | `amber` |
| 4 | נסגר בהצלחה | נסגר | **won** | null | false | `clay` |
| 5 | לא יצא לפועל | לא יצא | **lost** | null | false | `slate` |

`meaning` ← `STATUS_MEANING`, `guidance` ← `STATUS_GUIDANCE`, both from `copy.ts`, matched by the
old enum key. `is_system = true` on all six.

`drift_days = null` means never drifts — it replaces today's `Number.POSITIVE_INFINITY` on
won/lost in `DRIFT_DAYS`.

### Functions

| Function | Change | Recreate how |
|---|---|---|
| `log_lead_status_change` | compares `stage_id`; writes `from_stage_id` / `to_stage_id`; keeps a readable `body`; trigger becomes `after update of stage_id` | `create or replace` |
| `lead_stats` | dynamic stages; `is_demo = false` kept (§0) | `create or replace` |
| `save_lead` | `p_status public.lead_status` → `p_stage_id uuid`; reminder-closing block kept verbatim (§0) | **drop and recreate** — changed parameter type would leave an unresolvable overload |
| `create_lead` | same | **drop and recreate** |
| `handle_new_user` | seeds the six stages **before** the demo lead, then points that lead at position 0 | `create or replace` |

`lead_stats` output keys stay **exactly** as they are so the client's `LeadStats` interface does
not churn: `total`, `won`, `lost`, `decided`, `open`, `open_value`, `won_value`, `by_status`,
`reached`, `sources`. `by_status` and `reached` are keyed by **stage id** now, not by an enum
name, and the client resolves ids through `StagesStore`.

### Migration file order

One file per concern, timestamps ascending, all on `2026-08-04`:

| File | Owner | Contents |
|---|---|---|
| `20260804090000_pipeline_stages.sql` | me | enum, table, indexes, RLS, seed for existing tenants, `leads.stage_id` + `activities.*_stage_id` backfill, FKs, index swap |
| `20260804090100_stage_functions.sql` | me | `log_lead_status_change` + trigger, `handle_new_user` |
| `20260804090300_lead_stats_stages.sql` | W1-B | `lead_stats` rewrite |
| `20260804092000_lead_rpcs_stage_id.sql` | W2-A | `save_lead` + `create_lead`, drop-and-recreate |
| `20260804095000_drop_lead_status.sql` | me | drops the three old columns, then `drop type public.lead_status`. **Last, and separate on purpose** — the only irreversible step, applied after every function above is verified to no longer reference the enum. |

**Migration filenames are `YYYYMMDDHHMMSS` and the CLI parses them.** `20260804099000` was rejected
as a timestamp (minute 90 does not exist) and silently listed unparsed — keep every field in range.
Applied remote state at the start of this branch is `20260803150100`; everything on `20260804*` is
pending.

---

## 2. Database — Phase 2

```sql
create type public.automation_trigger as enum ('lead_enters_stage', 'lead_idle_in_stage');
create type public.automation_action  as enum (
  'set_reminder', 'assign_member', 'add_note', 'suggest_advance', 'webhook'
);
```

**`suggest_advance`, not `advance_stage`.** Decided by the user on 2026-08-03: the rule *offers*
the move, it never performs it. Nothing in this phase moves a lead on the user's behalf.

Tables `automations` and `automation_runs` exactly as specified in `PLAN-automations.md` §2, with:

- `automations.stage_id` composite FK to `pipeline_stages (id, tenant_id)` `on delete restrict`.
- `automations.suspended_at` — set when the stage is archived. Distinct from `enabled`.
- `automation_runs.idempotency_key text not null unique` =
  `automation_id || ':' || lead_id || ':' || <activities.id of the stage-move row>`.
- `automation_runs.status text` ∈ `queued` | `sending` | `done` | `failed` | `skipped`.
- RLS: read for members, write for owners on `automations`; on `automation_runs` **no insert or
  update policy at all** — only `security definer` code writes it.

Migration files: `20260804091000_automations.sql`, `20260804091100_automation_tier_a.sql`,
`20260804091200_automation_webhook.sql`.

---

## 3. Client — TypeScript

### `core/lead.model.ts`

```ts
export type StageKind = 'open' | 'won' | 'lost';

export interface Stage {
  id: string;
  name: string;
  shortName: string | null;
  position: number;
  kind: StageKind;
  swatch: SwatchName;
  meaning: string | null;
  guidance: string | null;
  driftDays: number | null;
  expectsReply: boolean;
  isSystem: boolean;
  archivedAt: Date | null;
}

export type SwatchName =
  | 'chalk' | 'sky' | 'moss' | 'amber' | 'plum' | 'clay' | 'slate' | 'sand';
```

`Lead` changes **one field**: `status: LeadStatus` → `stage: Stage`. Not `stageId` — components
that hold a lead need its name, kind and swatch, and an id would send every one of them back to
the store. `LeadStatus`, `STAGE_ORDER` and `DRIFT_DAYS` are deleted.

`Reminder.leadStatus` in `core/reminders.store.ts` becomes `leadStage: Stage`.

### `core/stages.store.ts` — new, root-provided

```ts
readonly stages:    Signal<Stage[]>;          // everything, including archived
readonly active:    Signal<Stage[]>;          // unarchived, by position
readonly loading / loaded / loadFailed: Signal<boolean>;
readonly firstOpen: Signal<Stage | null>;     // lowest position with kind 'open'
readonly wonStage:  Signal<Stage | null>;
readonly lostStage: Signal<Stage | null>;
byId(id: string): Stage | undefined;          // includes archived — history resolves through it
load(): Promise<void>;
reset(): void;                                // called on sessionEpoch, like the other stores
create / rename / reorder / archive / update(...)
```

`reset()` on `sessionEpoch` is **required** — the concurrent workstream added it to the other
stores for a real reason: a root singleton otherwise hands the next user the previous one's data.

### Pure functions, exported and unit-tested

| Function | Where | Why pure |
|---|---|---|
| `openReasonFor(lead, stage, now, firstOpenId)` | `core/attention.ts` (new) | The day sheet, badge, register flags and urgency sort all depend on it; it must be testable without a store. |
| `archiveCheck(stage, leadCount, all)` → `'ok' \| 'needs-destination' \| { refused: string }` | `core/stages.rules.ts` (new) | Three branches, all worth asserting. |
| `webhookUrlCheck(url)` → `'ok' \| { refused: string }` | SQL **and** a TS mirror for save-time UX | Security rule; the SQL one is authoritative. |

### Attention rules, generalised

| Reason | Old | New |
|---|---|---|
| `proposal_silent` | `status === 'proposal_sent'` | `stage.expectsReply === true` |
| `unqualified` | `status === 'new'` | `stage.id === firstOpen.id` and zero checklist answers |
| `drifting` | `DRIFT_DAYS[status]` | `stage.driftDays`, null = never |
| no reason at all | `won` / `lost` | `stage.kind !== 'open'` |

`OpenReason` keeps its four values and `OPEN_REASON` / `OPEN_ACTION` copy is unchanged.

### Swatches

Eight pairs, `--lf-sw-<name>-bg` / `--lf-sw-<name>-fg` in `theme/tokens.css`, both themes.
`chalk`, `sky`, `moss` and `amber` **reuse the four existing open-stage colours** so their
contrast is already proven. `plum`, `clay`, `slate`, `sand` are new and their contrast ratios
must be **measured and reported**, not eyeballed — ≥4.5:1 for the label.

`stage-tag` renders `class="tag tag--sw-{{ swatch }}"`, and `kind` overrides: `won` takes the red
fill, `lost` the dashed outline. Colour never carries meaning alone; the Hebrew label is always
present.

---

## 4. Ownership — no two agents touch one file

| Agent | Owns (may edit) | Must not touch |
|---|---|---|
| **W1-A** | `core/stages.store.ts` (new), `core/lead.model.ts`, `core/copy.ts`, `shared/stage-tag.ts`, `theme/tokens.css`, `core/stages.rules.ts` (new) | anything under `features/`, `core/leads.store.ts`, `core/insights.store.ts`, any migration |
| **W1-B** | `20260804*_lead_stats*.sql`, `core/insights.store.ts`, `features/insights/*` | `core/lead.model.ts`, `core/copy.ts`, `core/leads.store.ts` |
| **W1-C** | `20260804091000_automations.sql`, `20260804091100_automation_tier_a.sql` | every client file |
| **W2-A** | `core/leads.store.ts`, `core/attention.ts` (new), `core/reminders.store.ts`, `core/lead-validation.ts`, `features/dashboard/*`, `features/lead/*`, `shared/lead-menu.ts`, `shared/legend-dialog.ts`, `20260804092000_lead_rpcs_stage_id.sql` | `core/lead.model.ts`, `core/copy.ts`, `core/stages.store.ts`, `features/insights/*` |
| **W2-B** | `features/settings/*` (new), `app.routes.ts`, `features/profile/*` (one link only) | every `core/` file except reading them |
| **W3-A** | `features/settings/automations*` (new) | `features/settings/stages*` beyond adding one section outlet |
| **W3-B** (me) | `20260804091200_automation_webhook.sql` | everything else |

Cross-file needs go through the store's public API. An agent that believes it must edit a file it
does not own **stops and reports** instead.

---

## 5. Definition of done, per agent

Every agent reports: files inspected, files changed, validation actually run with its output,
assumptions made, and anything it could not finish. `ng build` must be green at the end of each
**wave**, not each agent — W1-A deliberately breaks the build for W2-A to repair.

Nobody claims a test passed without running it. Nobody claims a screen works — none of these have
been opened by a human, and that is recorded as a gap, not hidden.
