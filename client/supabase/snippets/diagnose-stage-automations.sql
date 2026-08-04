-- Why didn't moving a lead to "נשלחה הצעה" create a reminder?
--
-- Paste the whole file into the Supabase SQL editor (Studio runs as `postgres`, so it sees
-- every tenant and bypasses RLS — that is the point; the client cannot answer questions 3
-- and 4 below at all, because `authenticated` has no write path to `automation_runs` and no
-- reason to read another tenant's rows).
--
-- Read the six results in order. The first one that comes back empty or wrong is the answer;
-- there is no need to look further down.
--
-- The chain being tested, in the order it runs (20260804091100):
--   leads.stage_id changes
--     → trigger leads_log_status_change  writes the `status_changed` activity
--     → trigger leads_run_stage_automations  finds that activity, inserts an automation_runs row
--     → fire_automation_run  inserts/reschedules the reminder, inline, same transaction
-- Every link is silent on failure by design (a broken rule must never roll back a real stage
-- move), which is exactly why it has to be inspected rather than reasoned about.

-- ---------------------------------------------------------------------------
-- 1. Are both triggers actually on the table, and in the right order?
-- ---------------------------------------------------------------------------
-- Postgres fires same-event AFTER triggers alphabetically by name, and
-- leads_run_stage_automations depends on that: it looks up the activity row
-- leads_log_status_change writes. 'leads_l...' sorts before 'leads_r...', so the expected
-- output is exactly two enabled rows in that order. `tgenabled` must be 'O'.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.leads'::regclass
   and not tgisinternal
 order by tgname;

-- ---------------------------------------------------------------------------
-- 2. Does the stage carry a rule at all?
-- ---------------------------------------------------------------------------
-- `automations` rows are only ever seeded for a stage with kind='open' AND expects_reply
-- AND drift_days is not null (20260804100000). A stage built or edited by hand starts
-- expects_reply=false, so a hand-made "proposal sent" column gets no rule and no warning.
--
-- Expected: one row, action='set_reminder', trigger='lead_enters_stage', enabled=true,
-- suspended_at null, and config->>'days' equal to drift_days.
select s.name          as stage,
       s.kind,
       s.expects_reply,
       s.drift_days,
       s.archived_at,
       a.id            as automation_id,
       a.trigger,
       a.action,
       a.config,
       a.enabled,
       a.suspended_at
  from public.pipeline_stages s
  left join public.automations a
         on a.stage_id = s.id
        and a.tenant_id = s.tenant_id
 where s.kind = 'open'
 order by s.tenant_id, s.position;

-- ---------------------------------------------------------------------------
-- 3. Did anything ever try to run?
-- ---------------------------------------------------------------------------
-- Zero rows here means the trigger never reached the loop — jump to query 5, it is almost
-- always the demo-lead guard. Rows with status='skipped' carry the reason in Hebrew;
-- 'failed' carries the SQL error. 'done' means the reminder was written and the problem is
-- one of visibility, not of firing — go to query 6.
select r.created_at,
       r.status,
       r.skip_reason,
       r.error,
       r.run_after,
       r.completed_at,
       l.name  as lead,
       a.action
  from public.automation_runs r
  join public.automations a on a.id = r.automation_id
  left join public.leads l  on l.id = r.lead_id
 order by r.created_at desc
 limit 50;

-- ---------------------------------------------------------------------------
-- 4. Did the stage move even get logged?
-- ---------------------------------------------------------------------------
-- leads_run_stage_automations skips silently unless it can find the `status_changed`
-- activity for this exact (from_stage_id, to_stage_id) pair. A move with no row here means
-- the audit trigger did not fire, so the automation trigger had nothing to key on — and a
-- move whose row exists but has no matching automation_runs row in query 3 means the loop
-- ran and matched no rule (query 2) or bailed at the demo guard (query 5).
select act.occurred_at,
       l.name          as lead,
       l.is_demo,
       fs.name         as moved_from,
       ts.name         as moved_to,
       exists (
         select 1
           from public.automation_runs r
          where r.lead_id = act.lead_id
            and r.idempotency_key like '%:' || act.id::text
       )               as has_run_row
  from public.activities act
  join public.leads l           on l.id = act.lead_id
  left join public.pipeline_stages fs on fs.id = act.from_stage_id
  left join public.pipeline_stages ts on ts.id = act.to_stage_id
 where act.type = 'status_changed'
 order by act.occurred_at desc
 limit 30;

-- ---------------------------------------------------------------------------
-- 5. The likeliest cause: a demo lead
-- ---------------------------------------------------------------------------
-- run_stage_automations returns immediately for is_demo leads, before the rule loop — so
-- nothing fires, and NO run row is written either, which is why this looks like a dead
-- feature rather than a guard. Every new account is seeded with exactly one such lead
-- ('דנה כהן', handle_new_user), and it is the obvious thing to drag around while testing.
select id, name, is_demo, stage_id, created_at
  from public.leads
 where is_demo
 order by created_at desc;

-- ---------------------------------------------------------------------------
-- 6. If a run says 'done': the reminder exists — where is it?
-- ---------------------------------------------------------------------------
-- fire_automation_run sets due_at to 09:00 Asia/Jerusalem, drift_days from now (3 days on
-- the seeded proposal stage). That is neither overdue nor today, so the day sheet files it
-- under "upcoming" rather than in the list a user is looking at. The lead sheet's follow-up
-- line reads it straight off the lead, so it should show there immediately after a save.
select r.title,
       r.due_at,
       (r.due_at at time zone 'Asia/Jerusalem') as due_local,
       r.done_at,
       r.assigned_to,
       l.name as lead
  from public.reminders r
  join public.leads l on l.id = r.lead_id
 where r.done_at is null
 order by r.due_at;
