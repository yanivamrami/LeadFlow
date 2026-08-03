-- Per-stage automations — schema.
--
-- documents/PLAN-automations.md §1: only actions that leave the database need a worker. A
-- reminder, a note and an assignment are single SQL statements and can run inside the same
-- transaction that moves the lead. A webhook is an HTTP call to a host we do not control and
-- needs an outbox, so this phase splits into tier A (this file's tables, executed in
-- 20260804091100) and tier B (webhook sending, a separate migration by another agent). Both
-- tiers share the two tables defined here.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

create type public.automation_trigger as enum (
  'lead_enters_stage',   -- fires the moment the lead lands on the stage
  'lead_idle_in_stage'   -- fires N days later, only if the lead is still there
);

-- `suggest_advance`, not `advance_stage`. Decided by the user on 2026-08-03: a rule *offers* a
-- stage move, it never performs one. This product's stated principle is advisory-never-blocking,
-- and a rule that silently moves a lead on someone's pipeline is the closest thing to a gate this
-- codebase has — so it doesn't exist. Do not rename this back to `advance_stage` and do not add
-- code that sets `leads.stage_id` from an automation; see the comment on that action's handling
-- in 20260804091100 for where this is enforced.
--
-- 'send_email' and 'send_whatsapp' are deliberately not here — each has a prerequisite (a
-- transactional sender; a legal opinion) outside this codebase. See PLAN-automations.md §9.
create type public.automation_action as enum (
  'set_reminder', 'assign_member', 'add_note', 'suggest_advance', 'webhook'
);

-- ---------------------------------------------------------------------------
-- 2. automations
-- ---------------------------------------------------------------------------

create table public.automations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  stage_id     uuid not null,
  trigger      public.automation_trigger not null,
  -- Required exactly when trigger = 'lead_idle_in_stage' — see the check constraint below.
  idle_days    integer,
  action       public.automation_action not null,
  -- Per-action shape, validated at fire time in 20260804091100 rather than here: a jsonb check
  -- constraint would have to know about every action's fields and would fight every future one.
  config       jsonb not null default '{}'::jsonb,
  enabled      boolean not null default true,
  -- Set when this rule's stage is archived (trigger at the bottom of this file). Deliberately
  -- distinct from `enabled`: a stage manager that silently orphans a rule when its stage is
  -- archived is the fastest way to lose a user's trust in this whole feature (PLAN §1). Keeping
  -- the two columns separate means the UI can say "suspended because its stage is archived"
  -- instead of just showing a rule that quietly stopped working, and means un-archiving the
  -- stage does not silently re-enable rules the user never touched (PLAN §5, open question 4).
  suspended_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  -- Composite FK, same pattern as leads_stage_fkey (20260804090000): a child row cannot claim a
  -- tenant_id that differs from its stage's, even if a client forges the column.
  constraint automations_stage_fkey
    foreign key (stage_id, tenant_id)
    references public.pipeline_stages (id, tenant_id) on delete restrict,

  constraint automations_idle_days_ck
    check ((trigger = 'lead_idle_in_stage') = (idle_days is not null)),

  constraint automations_idle_days_positive_ck
    check (idle_days is null or idle_days > 0)
);

create index automations_tenant_id_idx on public.automations (tenant_id);

-- Unconditional, covering every row: the composite FK below checks this column on every
-- pipeline_stages delete (rare — stages are archived, not deleted, but `restrict` still needs
-- somewhere to look), same convention as reminders_lead_id_idx (20260802154958).
create index automations_stage_id_idx on public.automations (stage_id);

-- The lookup every stage move and every cron tick does: "which live rules exist for this
-- stage". Partial on the same predicate run_stage_automations filters on, so the index only
-- carries rows that are actually eligible to fire; the unconditional index above is what a
-- pipeline_stages delete check falls back to for the rows this one excludes.
create index automations_stage_lookup_idx
  on public.automations (stage_id, tenant_id)
  where enabled and suspended_at is null;

-- RLS: read for members, write for owners only — same deviation as pipeline_stages
-- (20260804090000 §4). A rule changes what happens to every lead that passes through a stage;
-- that is not a member-level decision any more than reshaping the pipeline itself is.

alter table public.automations enable row level security;

create policy automations_select on public.automations
  for select to authenticated
  using ( (select private.is_tenant_member(tenant_id)) );

create policy automations_insert on public.automations
  for insert to authenticated
  with check ( (select private.is_tenant_owner(tenant_id)) );

create policy automations_update on public.automations
  for update to authenticated
  using      ( (select private.is_tenant_owner(tenant_id)) )
  with check ( (select private.is_tenant_owner(tenant_id)) );

create policy automations_delete on public.automations
  for delete to authenticated
  using ( (select private.is_tenant_owner(tenant_id)) );

grant select, insert, update, delete on public.automations to authenticated;

-- ---------------------------------------------------------------------------
-- 3. automation_runs
-- ---------------------------------------------------------------------------
-- One row per (automation, lead, stage-entry). Written only by the security-definer functions
-- in 20260804091100 and by the tier-B sender — never directly by a client. See the RLS note
-- below for why there is no insert/update policy at all.

create table public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.automations (id) on delete cascade,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  lead_id         uuid not null,
  status          text not null,
  attempt         integer not null default 0,
  -- Human-readable, shown in the run log (SCREENS 9.4): why nothing happened.
  skip_reason     text,
  error           text,
  -- Set by the tier-B sender when it hands a webhook to pg_net; nullable and untouched by tier
  -- A. Exists here so the later reconciler (20260804091200) has a column to store it in without
  -- another migration widening this table.
  request_id      bigint,
  run_after       timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- The idempotency key: automation_id || ':' || lead_id || ':' || <the activities.id of the
  -- stage-move row>, built by the caller (20260804091100) and handed to us as an opaque string.
  -- log_lead_status_change (20260804090100) already writes exactly one activity row per stage
  -- move, and it is unique and persisted before this key is ever built — so it is a ready-made,
  -- natural identity for "this entry into this stage". A double-fire of the trigger, or a
  -- retried call, produces the same key and is rejected here rather than by application logic.
  -- Re-entering the same stage later writes a *different* activity row, so the automation
  -- correctly fires again — the key does not need to encode the stage id itself, because a
  -- fresh activity id already implies a fresh entry.
  idempotency_key text not null,

  constraint automation_runs_idempotency_key_uq unique (idempotency_key),

  constraint automation_runs_status_ck
    check (status in ('queued', 'sending', 'done', 'failed', 'skipped')),

  constraint automation_runs_lead_fkey
    foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete cascade
);

-- Sweep target: pg_cron scans exactly this shape every tick (20260804091100). Partial so the
-- index stays small as runs pile up in 'done'/'failed'/'skipped' over time.
create index automation_runs_pending_idx
  on public.automation_runs (run_after)
  where status = 'queued';

create index automation_runs_tenant_id_idx on public.automation_runs (tenant_id);

-- The run log (SCREENS 9.4): last 50 runs for one automation, newest first.
create index automation_runs_automation_id_idx
  on public.automation_runs (automation_id, created_at desc);

-- Composite FK column, same convention as reminders_lead_id_idx (20260802154958): without an
-- index leading with lead_id, every lead delete forces a sequential scan to check the FK.
create index automation_runs_lead_id_idx on public.automation_runs (lead_id, tenant_id);

alter table public.automation_runs enable row level security;

create policy automation_runs_select on public.automation_runs
  for select to authenticated
  using ( (select private.is_tenant_member(tenant_id)) );

-- No insert, update or delete policy at all — deliberately, and not an oversight. Only the
-- security-definer functions in 20260804091100 (and the tier-B sender) write this table; they
-- execute as their owner, which owns this table too, so Postgres lets them write regardless of
-- RLS (row security applies to the *querying* role, and the table owner is exempt from its own
-- table's policies unless FORCE ROW LEVEL SECURITY is set, which it is not here). Ordinary
-- clients hold only the `authenticated` role, which has no policy path to INSERT, UPDATE or
-- DELETE this table at all — a client that could forge a run row could make the product send a
-- webhook of its choosing, or fabricate a "done" reminder that was never sent. Matching that,
-- the table-level grant below is SELECT only: even if a policy were added here by mistake later,
-- there would still be nothing to grant it against.
grant select on public.automation_runs to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Archiving a stage suspends its rules, loudly and by name
-- ---------------------------------------------------------------------------
-- PLAN §1: "archiving a stage disables its rules loudly. Not silently, not by cascade." This is
-- the mechanism: the moment archived_at is set on pipeline_stages, every one of its still-active
-- automations is marked suspended in the same statement, so the stage manager and the
-- automations list both have a real timestamp to show ("2 אוטומציות מושהות") rather than having
-- to infer suspension from the stage's own archived state. It lives in this migration, not
-- 20260804090000, because public.automations does not exist until this file.
--
-- Un-suspending is not automatic and not this trigger's job: unarchiving a stage clears
-- archived_at but never touches suspended_at, so a rule that was suspended stays suspended until
-- an owner deliberately re-enables it. A surprise reactivation is worse than a rule staying off.

create or replace function public.pipeline_stages_suspend_automations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    update public.automations
       set suspended_at = now()
     where stage_id = new.id
       and suspended_at is null;
  end if;
  return new;
end;
$$;

create trigger pipeline_stages_archived_suspend_automations
  after update of archived_at on public.pipeline_stages
  for each row execute function public.pipeline_stages_suspend_automations();

revoke execute on function public.pipeline_stages_suspend_automations() from public, anon, authenticated;
