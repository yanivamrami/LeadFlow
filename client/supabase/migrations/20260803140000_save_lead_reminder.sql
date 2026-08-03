-- save_lead learns about reminders.
--
-- Setting a follow-up on the lead sheet has to commit with the sheet's one save, for the
-- same reason the note does (SCREENS 3.5): two round trips can half-fail, and the half
-- that fails is the one the user typed. This is the only place a reminder write joins a
-- multi-table commit, so it belongs in the existing function rather than beside it.
--
-- Adding parameters changes the signature, and `create or replace` with a different
-- argument count creates an *overload* instead of replacing — which would leave PostgREST
-- with two candidates and no way to choose. So: drop, recreate, re-grant.

drop function if exists public.save_lead(
  uuid, text, text, text, text, public.lead_source, public.lead_status, numeric,
  text, text, public.activity_type, jsonb
);

create function public.save_lead(
  p_lead_id         uuid,
  p_name            text,
  p_company         text,
  p_email           text,
  p_phone           text,
  p_source          public.lead_source,
  p_status          public.lead_status,
  p_estimated_value numeric,
  p_lost_reason     text                 default null,
  p_note            text                 default null,
  p_note_type       public.activity_type default 'note',
  p_answers         jsonb                default '[]'::jsonb,
  -- Reminder intent, all three states distinguishable:
  --   p_reminder_action = 'keep'  → touch nothing (the default; most saves)
  --                       'set'   → create or reschedule to p_reminder_due
  --                       'clear' → mark every open reminder on this lead done
  -- A null due with 'set' is a no-op rather than an error: the sheet guards it too.
  p_reminder_action text                 default 'keep',
  p_reminder_due    timestamptz          default null,
  p_reminder_title  text                 default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_id  uuid;
  v_reminder   uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'lead name is required' using errcode = '23514';
  end if;

  update public.leads
     set name            = btrim(p_name),
         company         = nullif(btrim(coalesce(p_company, '')), ''),
         email           = nullif(btrim(coalesce(p_email, '')), ''),
         phone           = nullif(btrim(coalesce(p_phone, '')), ''),
         source          = p_source,
         status          = p_status,
         estimated_value = p_estimated_value,
         lost_reason     = case
                             when p_status = 'lost'
                               then nullif(btrim(coalesce(p_lost_reason, '')), '')
                             else null
                           end
   where id = p_lead_id
  returning tenant_id into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  if p_note is not null and btrim(p_note) <> '' then
    insert into public.activities (lead_id, tenant_id, created_by, type, body)
    values (p_lead_id, v_tenant_id, auth.uid(), coalesce(p_note_type, 'note'), btrim(p_note));
  end if;

  if p_answers is not null and jsonb_typeof(p_answers) = 'array' then
    insert into public.qualification_answers (lead_id, item, tenant_id, answer, answered_by, answered_at)
    select p_lead_id,
           (a ->> 'item')::public.checklist_item,
           v_tenant_id,
           (a ->> 'answer')::public.qualification_answer,
           auth.uid(),
           now()
      from jsonb_array_elements(p_answers) as a
    on conflict (lead_id, item) do update
       set answer      = excluded.answer,
           answered_by = excluded.answered_by,
           answered_at = excluded.answered_at;
  end if;

  -- One open reminder per lead is the working assumption: the day sheet, the badge and
  -- the attention rules all reason about "the" open reminder, so setting one while
  -- another is open reschedules that one rather than creating a second.
  if p_reminder_action = 'clear' then
    update public.reminders
       set done_at = now()
     where lead_id = p_lead_id
       and done_at is null;

  elsif p_reminder_action = 'set' and p_reminder_due is not null then
    select id into v_reminder
      from public.reminders
     where lead_id = p_lead_id
       and done_at is null
     order by due_at
     limit 1;

    if v_reminder is null then
      insert into public.reminders (lead_id, tenant_id, assigned_to, title, due_at)
      values (
        p_lead_id, v_tenant_id, auth.uid(),
        nullif(btrim(coalesce(p_reminder_title, '')), ''),
        p_reminder_due
      );
    else
      update public.reminders
         set due_at = p_reminder_due,
             title  = coalesce(nullif(btrim(coalesce(p_reminder_title, '')), ''), title)
       where id = v_reminder;
    end if;
  end if;
end;
$$;

revoke execute on function public.save_lead(
  uuid, text, text, text, text, public.lead_source, public.lead_status, numeric,
  text, text, public.activity_type, jsonb, text, timestamptz, text
) from public, anon;

grant execute on function public.save_lead(
  uuid, text, text, text, text, public.lead_source, public.lead_status, numeric,
  text, text, public.activity_type, jsonb, text, timestamptz, text
) to authenticated;
