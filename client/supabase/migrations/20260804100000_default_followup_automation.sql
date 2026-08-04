-- Default follow-up automation: a stage that waits on the customer schedules the chase.
--
-- The engine, the actions and the settings UI for automations all shipped in
-- 20260804091000/091100 — but no tenant has ever had a single automation row, because nothing
-- creates one. So `נשלחה הצעה` tells the user "אם לא חוזרים אליכם תוך 3 ימים — הרימו טלפון"
-- and then nothing schedules that call. The advice was real; the follow-up was not.
--
-- WHICH STAGES GET A RULE, AND WHY THAT PREDICATE
--
-- `expects_reply`, not "every stage with drift_days". drift_days is on four of the six seeded
-- stages, so keying off it would create or reschedule a reminder on nearly every stage move and
-- turn the reminders list into a log of stage changes. `expects_reply` marks the narrower thing
-- this is actually for: the ball is in the customer's court, so the only way the lead moves is
-- if the user chases it. In the seeded pipeline that is exactly one stage — the proposal — which
-- is exactly the case that was reported.
--
-- `days` comes from the stage's own `drift_days` rather than a constant, so the reminder and the
-- guidance sentence cannot drift apart: both are now derived from the same column, and a user who
-- edits the threshold moves the reminder with it. A hardcoded 3 would start lying the first time
-- somebody changed that field — the same reasoning 03789de applied to the threshold table.
--
-- No `title` in config: fire_automation_run already defaults it to 'תזכורת אוטומטית', and
-- inventing a second wording here would give the same row two names depending on who made it.
--
-- These are defaults, not policy. Every one is an ordinary row in `automations`, visible and
-- editable in the settings panel that already exists, and `enabled` can be turned off there.

-- ---------------------------------------------------------------------------
-- 1. new pipelines — seed on insert rather than inside handle_new_user
-- ---------------------------------------------------------------------------

-- A trigger, deliberately, instead of adding lines to handle_new_user: that function owns the
-- seed *content* for a new tenant, and copying its six-row VALUES list into a second place is
-- how the two versions start disagreeing. This way one rule covers every path that ever creates
-- a stage — signup, a future template import, a manual insert — and it covers them by asking the
-- stage what it is rather than by knowing where it came from.
--
-- A stage a user builds by hand is unaffected: those start `expects_reply = false` and
-- `drift_days = null` (the column defaults), so they get no rule until the user asks for one. A
-- stage created from a template that does expect a reply gets the same default the seed does,
-- which is the consistent answer rather than a special case.
create or replace function public.pipeline_stages_seed_followup_automation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'open'
     and new.expects_reply
     and new.drift_days is not null
     and new.archived_at is null
  then
    insert into public.automations (
      tenant_id, stage_id, trigger, action, config, enabled
    )
    values (
      new.tenant_id,
      new.id,
      'lead_enters_stage'::public.automation_trigger,
      'set_reminder'::public.automation_action,
      -- idle_days stays null: the check constraint requires it to be null for this trigger.
      pg_catalog.jsonb_build_object('days', new.drift_days),
      true
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.pipeline_stages_seed_followup_automation()
  from public, anon, authenticated;

create trigger pipeline_stages_seed_followup_automation
  after insert on public.pipeline_stages
  for each row
  execute function public.pipeline_stages_seed_followup_automation();

-- ---------------------------------------------------------------------------
-- 2. existing pipelines — backfill once
-- ---------------------------------------------------------------------------

-- Idempotent on (stage, trigger, action): re-running this migration, or running it after a user
-- has already built the same rule by hand in the settings panel, must not hand anybody two rules
-- that both move the same reminder. Archived stages are skipped — a rule on a stage no lead can
-- enter is dead weight, and pipeline_stages_suspend_automations would suspend it anyway.
insert into public.automations (
  tenant_id, stage_id, trigger, action, config, enabled
)
select
  s.tenant_id,
  s.id,
  'lead_enters_stage'::public.automation_trigger,
  'set_reminder'::public.automation_action,
  jsonb_build_object('days', s.drift_days),
  true
from public.pipeline_stages s
where s.kind = 'open'
  and s.expects_reply
  and s.drift_days is not null
  and s.archived_at is null
  and not exists (
    select 1
      from public.automations a
     where a.stage_id = s.id
       and a.tenant_id = s.tenant_id
       and a.trigger = 'lead_enters_stage'::public.automation_trigger
       and a.action = 'set_reminder'::public.automation_action
  );
