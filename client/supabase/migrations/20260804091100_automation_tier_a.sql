-- Per-stage automations — tier A execution.
--
-- PLAN-automations.md §1's whole shape rests on one observation: a reminder, an internal note
-- and an assignment are each a single SQL statement, already transactional and already
-- RLS-covered, so they can run *inside* the same transaction that moves the lead between stages.
-- No queue, no Edge Function, no HTTP, no secrets. That is what this file wires up. A webhook is
-- the one action that leaves the database and needs an outbox — that is a separate migration
-- (20260804091200) by another agent; this file only enqueues webhook runs, never sends them.
--
-- The property this buys for free: because tier A runs inline, a stage move that gets rolled
-- back (a later statement in the same transaction fails, a constraint trips, anything) rolls
-- back its automation runs with it. Nothing was sent, because nothing outside the database was
-- ever touched. An outbox exists specifically to buy this guarantee for actions that can't run
-- inline; tier A gets it without one.
--
-- pg_cron is the first extension this product has needed (ARCHITECTURE §6 previously said "no
-- server logic exists" and meant it literally). It earns its place here because
-- 'lead_idle_in_stage' is a trigger that fires N days from now, and there is no request in
-- flight N days from now for a trigger to hang off — nothing in the request path can wait that
-- long, so something has to wake up on a schedule and check. That is the one job pg_cron does in
-- this file: sweep due, still-queued tier-A runs once a minute.

-- ---------------------------------------------------------------------------
-- 0. Extension
-- ---------------------------------------------------------------------------
-- Ships with Supabase and is enabled with one statement; config.toml:15 already carries
-- `extensions` on the search path. NOTE: enabling an extension can require elevated privileges
-- depending on the project/role this migration runs as — confirm on the actual Supabase project
-- that the migration role is allowed to run CREATE EXTENSION before applying this file for real.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1. fire_automation_run — perform one tier-A action and finalize its run row
-- ---------------------------------------------------------------------------
-- The single place that actually *does* something. Called two ways:
--   - synchronously, right after the run row is inserted, for 'lead_enters_stage' (below in
--     run_stage_automations) — the action happens now, in the caller's transaction.
--   - later, by the cron sweep at the bottom of this file, for 'lead_idle_in_stage' runs whose
--     run_after has arrived.
-- Sharing one function means the precondition re-check, the demo guard and the action logic
-- itself are written once and can't drift between the "now" path and the "later" path.

create or replace function public.fire_automation_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run           public.automation_runs%rowtype;
  v_auto          public.automations%rowtype;
  v_lead_stage_id uuid;
  v_lead_is_demo  boolean;
  v_lead_assigned uuid;
  v_days          int;
  v_title         text;
  v_due           timestamptz;
  v_existing      uuid;
  v_body          text;
  v_user_id       uuid;
  v_is_member     boolean;
  v_target_stage  uuid;
  v_target_name   text;
begin
  -- Lock the run row. This is also what makes a double-fire impossible even without the
  -- idempotency key: if the cron sweep and a concurrent call ever raced on the same id, the
  -- second one blocks here, then sees status is no longer 'queued' below and does nothing.
  select * into v_run
    from public.automation_runs
   where id = p_run_id
   for update;

  if not found then
    return;
  end if;

  if v_run.status <> 'queued' then
    -- Already handled (or being handled right now by whoever holds this lock next). Re-running
    -- it would be exactly the double-fire the idempotency key and this lock both exist to stop.
    return;
  end if;

  select * into v_auto from public.automations where id = v_run.automation_id;

  if not found or v_auto.action = 'webhook' then
    -- Callers below filter webhook rows out before ever calling this function; this is a
    -- defensive no-op rather than a guess at HTTP semantics that belong to 20260804091200.
    return;
  end if;

  if not v_auto.enabled or v_auto.suspended_at is not null then
    update public.automation_runs
       set status = 'skipped',
           skip_reason = 'האוטומציה כבויה או מושהית',
           completed_at = now()
     where id = p_run_id;
    return;
  end if;

  select stage_id, is_demo, assigned_to
    into v_lead_stage_id, v_lead_is_demo, v_lead_assigned
    from public.leads
   where id = v_run.lead_id
     and tenant_id = v_run.tenant_id;

  if not found then
    update public.automation_runs
       set status = 'skipped', skip_reason = 'הליד נמחק', completed_at = now()
     where id = p_run_id;
    return;
  end if;

  -- Demo leads never fire a real automation (task guard / PLAN §2 "never fires"). Checked again
  -- here, not only at insert time in run_stage_automations, because a lead_idle_in_stage run can
  -- sit queued for days — re-checking every guard at fire time, not just the stage, is what
  -- keeps a demo lead's queued automations inert even if something upstream changes in between.
  if v_lead_is_demo then
    update public.automation_runs
       set status = 'skipped',
           skip_reason = 'ליד לדוגמה — אוטומציות לא פועלות עליו',
           completed_at = now()
     where id = p_run_id;
    return;
  end if;

  -- Precondition re-check (PLAN §2 / task guard): a 'lead_idle_in_stage' run was queued the
  -- moment the lead entered the stage, and idle_days may have passed since. If the lead has
  -- since moved on, the silence this rule exists to notice is over, and firing it now would
  -- surprise the user with an action about a stage the lead isn't even in. Nothing is written.
  if v_auto.trigger = 'lead_idle_in_stage' and v_lead_stage_id <> v_auto.stage_id then
    update public.automation_runs
       set status = 'skipped', skip_reason = 'הליד כבר לא בשלב הזה', completed_at = now()
     where id = p_run_id;
    return;
  end if;

  -- The action itself. Wrapped in its own BEGIN/EXCEPTION: for 'lead_enters_stage' this function
  -- runs inline, inside the same transaction as the stage move (that inline-ness is the whole
  -- point of tier A — see the header). An uncaught exception here — a malformed config, a bad
  -- cast — would propagate out and roll back the user's legitimate stage change because of
  -- somebody else's misconfigured rule. That is never acceptable, so every failure this block
  -- can produce is caught, recorded on the run row as 'failed', and swallowed.
  begin
    if v_auto.action = 'set_reminder' then
      -- config: { days: int, title?: text }
      v_days  := coalesce((v_auto.config ->> 'days')::int, 0);
      v_title := coalesce(nullif(btrim(v_auto.config ->> 'title'), ''), 'תזכורת אוטומטית');
      v_due   := make_timestamptz(
                   extract(year  from ((now() at time zone 'Asia/Jerusalem')::date + v_days))::int,
                   extract(month from ((now() at time zone 'Asia/Jerusalem')::date + v_days))::int,
                   extract(day   from ((now() at time zone 'Asia/Jerusalem')::date + v_days))::int,
                   9, 0, 0, 'Asia/Jerusalem'
                 );

      -- Same one-open-reminder-per-lead rule save_lead enforces (20260803140000): reschedule the
      -- existing open reminder rather than stacking a second one that the day sheet, the badge
      -- and the attention rules aren't built to reason about.
      select id into v_existing
        from public.reminders
       where lead_id = v_run.lead_id
         and done_at is null
       order by due_at
       limit 1;

      if v_existing is null then
        insert into public.reminders (lead_id, tenant_id, assigned_to, title, due_at)
        values (v_run.lead_id, v_run.tenant_id, v_lead_assigned, v_title, v_due);
      else
        update public.reminders
           set due_at = v_due,
               title  = v_title
         where id = v_existing;
      end if;

      update public.automation_runs
         set status = 'done', completed_at = now()
       where id = p_run_id;

    elsif v_auto.action = 'add_note' then
      -- config: { body: text }
      v_body := btrim(coalesce(v_auto.config ->> 'body', ''));

      if v_body = '' then
        update public.automation_runs
           set status = 'skipped',
               skip_reason = 'לכלל האוטומציה אין תוכן הערה',
               completed_at = now()
         where id = p_run_id;
      else
        -- Marked plainly as automated, not typed by a person: an automated note that reads as
        -- hand-written is a lie about the record. created_by is left null on purpose — nobody
        -- typed this, so attributing it to whichever human authored the *rule* would be its own
        -- small dishonesty.
        insert into public.activities (lead_id, tenant_id, created_by, type, body)
        values (
          v_run.lead_id, v_run.tenant_id, null, 'note',
          '[הערה אוטומטית מכלל אוטומציה] ' || v_body
        );

        update public.automation_runs
           set status = 'done', completed_at = now()
         where id = p_run_id;
      end if;

    elsif v_auto.action = 'assign_member' then
      -- config: { user_id: uuid }. Validated here, at fire time, against current membership —
      -- not just at save time — because a rule can sit on a stage for months and the member it
      -- names can leave the tenant in the meantime.
      v_user_id := (v_auto.config ->> 'user_id')::uuid;

      select exists (
        select 1 from public.memberships
         where tenant_id = v_run.tenant_id and user_id = v_user_id
      ) into v_is_member;

      if v_user_id is null or not v_is_member then
        update public.automation_runs
           set status = 'skipped',
               skip_reason = 'המשתמש שנבחר כבר לא חבר בצוות',
               completed_at = now()
         where id = p_run_id;
      else
        update public.leads
           set assigned_to = v_user_id
         where id = v_run.lead_id and tenant_id = v_run.tenant_id;

        update public.automation_runs
           set status = 'done', completed_at = now()
         where id = p_run_id;
      end if;

    elsif v_auto.action = 'suggest_advance' then
      -- config: { stage_id: uuid }. Writes a SUGGESTION only, as an activity note the user reads
      -- and acts on (or doesn't) — it deliberately never touches leads.stage_id. There is no
      -- suggestions table; a note is the whole mechanism. This is the same 2026-08-03 decision
      -- recorded on the automation_action enum: nothing in this product moves a lead on the
      -- user's behalf, and this is the one place in this file that could tempt someone to do
      -- exactly that. Do not add an UPDATE of leads.stage_id to this branch.
      v_target_stage := (v_auto.config ->> 'stage_id')::uuid;

      select name into v_target_name
        from public.pipeline_stages
       where id = v_target_stage and tenant_id = v_run.tenant_id;

      if v_target_name is null then
        update public.automation_runs
           set status = 'skipped',
               skip_reason = 'שלב היעד של ההצעה כבר לא קיים',
               completed_at = now()
         where id = p_run_id;
      else
        insert into public.activities (lead_id, tenant_id, created_by, type, body)
        values (
          v_run.lead_id, v_run.tenant_id, null, 'note',
          '[הצעה אוטומטית מכלל אוטומציה] כדאי לשקול להעביר את הליד לשלב "' || v_target_name || '"'
        );

        update public.automation_runs
           set status = 'done', completed_at = now()
         where id = p_run_id;
      end if;
    end if;

  exception when others then
    update public.automation_runs
       set status = 'failed', error = sqlerrm, completed_at = now()
     where id = p_run_id;
  end;
end;
$$;

revoke execute on function public.fire_automation_run(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. run_stage_automations — entry point, called once per stage move
-- ---------------------------------------------------------------------------

create or replace function public.run_stage_automations(
  p_lead_id     uuid,
  p_tenant_id   uuid,
  p_stage_id    uuid,
  p_activity_id uuid,
  p_depth       int default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         public.automations%rowtype;
  v_key     text;
  v_run_id  uuid;
  v_is_demo boolean;
begin
  -- Loop guard, depth cap 1: a run created by an automation must not itself trigger
  -- automations (task guard / PLAN §2). No tier-A action moves leads.stage_id today —
  -- suggest_advance deliberately does not, see fire_automation_run above — so nothing in this
  -- migration currently produces a call with p_depth > 0. The parameter and this guard exist so
  -- that if a future action ever does move a lead, whoever writes it is forced to reason about
  -- this the moment they wire it up, instead of quietly reintroducing an infinite loop between
  -- two stages that advance into each other.
  if p_depth > 0 then
    return;
  end if;

  -- Never fire for a demo lead. coalesce(..., true) means a lead that has vanished between the
  -- trigger firing and this select (should not happen inside one transaction, but cheap to be
  -- sure) is treated the same as a demo lead: do nothing.
  select is_demo into v_is_demo from public.leads where id = p_lead_id and tenant_id = p_tenant_id;
  if coalesce(v_is_demo, true) then
    return;
  end if;

  for r in
    select * from public.automations
     where stage_id = p_stage_id
       and tenant_id = p_tenant_id
       and enabled = true
       and suspended_at is null
  loop
    v_key := r.id::text || ':' || p_lead_id::text || ':' || p_activity_id::text;

    if r.trigger = 'lead_enters_stage' then
      insert into public.automation_runs (
        automation_id, tenant_id, lead_id, status, idempotency_key, run_after
      )
      values (r.id, p_tenant_id, p_lead_id, 'queued', v_key, now())
      on conflict (idempotency_key) do nothing
      returning id into v_run_id;

      -- v_run_id is null when the conflict fired: this exact (automation, lead, stage-entry
      -- activity) already has a run, which means the trigger ran twice or this call is being
      -- replayed. Either way, do not fire twice.
      if v_run_id is not null and r.action <> 'webhook' then
        perform public.fire_automation_run(v_run_id);
      end if;
      -- action = 'webhook' stays 'queued', run_after = now(): the tier-B sender
      -- (20260804091200) claims and sends it. Not this function's concern.

      v_run_id := null;

    elsif r.trigger = 'lead_idle_in_stage' then
      insert into public.automation_runs (
        automation_id, tenant_id, lead_id, status, idempotency_key, run_after
      )
      values (
        r.id, p_tenant_id, p_lead_id, 'queued', v_key,
        now() + r.idle_days * interval '1 day'
      )
      on conflict (idempotency_key) do nothing;
      -- Fired later, by the cron sweep below, once run_after has passed — whatever the action
      -- is, tier A or webhook. fire_automation_run itself refuses webhook rows; the sweep query
      -- below filters them out before ever calling it.
    end if;
  end loop;
end;
$$;

revoke execute on function public.run_stage_automations(uuid, uuid, uuid, uuid, int)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wiring — a second trigger on leads, separate from the audit trigger
-- ---------------------------------------------------------------------------
-- A new trigger rather than editing log_lead_status_change (20260804090100), so the audit
-- trigger stays exactly what it is today: simple, and testable on its own without dragging
-- automations into its test story.
--
-- This trigger needs the id of the activity row the audit trigger just wrote. Postgres fires
-- multiple AFTER triggers for the same event on the same relation in alphabetical order by
-- trigger name (documented behaviour, not an assumption) — 'leads_log_status_change' sorts
-- before 'leads_run_stage_automations' ('l' < 'r' at the first differing character), so the
-- audit trigger's insert is guaranteed to have already happened, in this same transaction, by
-- the time this one runs. The defensive fallback below (skip entirely if no matching activity
-- is found) is there in case that ordering assumption is ever wrong, rather than trusting it
-- blindly.

create or replace function public.leads_stage_automations_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid;
begin
  if new.stage_id is distinct from old.stage_id then
    select id into v_activity_id
      from public.activities
     where lead_id = new.id
       and tenant_id = new.tenant_id
       and type = 'status_changed'
       and to_stage_id = new.stage_id
       and from_stage_id = old.stage_id
     order by occurred_at desc
     limit 1;

    if v_activity_id is not null then
      -- p_depth is always 0 here: this trigger is the only caller of run_stage_automations, and
      -- every lead move that reaches it was a real move (nothing in this migration moves a lead
      -- on an automation's behalf — see suggest_advance above). See the depth-cap comment on
      -- run_stage_automations for what a future depth > 0 caller would need to justify.
      perform public.run_stage_automations(new.id, new.tenant_id, new.stage_id, v_activity_id, 0);
    end if;
  end if;

  return new;
end;
$$;

create trigger leads_run_stage_automations
  after update of stage_id on public.leads
  for each row execute function public.leads_stage_automations_trigger();

revoke execute on function public.leads_stage_automations_trigger() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. pg_cron sweep
-- ---------------------------------------------------------------------------
-- Once a minute: pick up queued tier-A runs whose run_after has arrived and fire them.
-- Tier-B (webhook) rows are excluded here — they are claimed and sent by 20260804091200's own
-- job, which also needs `sending`/attempt/backoff machinery this function does not have.

create or replace function public.sweep_due_tier_a_runs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select ar.id
      from public.automation_runs ar
      join public.automations a on a.id = ar.automation_id
     where ar.status = 'queued'
       and ar.run_after <= now()
       and a.action <> 'webhook'
     order by ar.run_after
     -- Bounds a single tick's work so a large backlog drains over several ticks rather than one
     -- long-running transaction holding locks for longer than a one-minute schedule likes.
     limit 200
     for update of ar skip locked
  loop
    perform public.fire_automation_run(r.id);
  end loop;
end;
$$;

revoke execute on function public.sweep_due_tier_a_runs() from public, anon, authenticated;

-- Idempotent scheduling: if this migration is ever re-applied against a database that already
-- has the job (a local reset, for instance), drop the old one first rather than erroring or
-- accumulating a second job with the same name that would double-fire every sweep.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sweep-tier-a-automations') then
    perform cron.unschedule('sweep-tier-a-automations');
  end if;

  perform cron.schedule(
    'sweep-tier-a-automations',
    '* * * * *',
    $sql$select public.sweep_due_tier_a_runs();$sql$
  );
end;
$$;
