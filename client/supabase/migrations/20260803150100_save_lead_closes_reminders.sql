-- save_lead's note path didn't close open reminders; the day sheet's does.
--
-- leads.store's logActivity() closes every open reminder on the lead right after logging
-- contact (closeOpenReminders). save_lead's own note branch never did, so the exact same
-- user action — "I talked to them, here's what happened" — cleared the follow-up from one
-- entry point and left it dangling from the other. The lead sheet looked like it forgot.
--
-- Two guards on when this fires:
--   1. Only when a note was actually written. Renaming a lead or changing its stage
--      through save_lead must not silently clear a follow-up nobody addressed.
--   2. Only when the note is evidence of real contact: p_note_type in ('call', 'email',
--      'meeting'). A plain internal note ('note' — the default) is not that; 'status_changed'
--      is never passed here as p_note_type and is excluded on the same grounds.
--
-- Signature is unchanged from 20260803140000_save_lead_reminder, so `create or replace`
-- is enough — no drop needed (that migration's drop-then-create was only because it added
-- parameters; a plain replace does not create an overload).
create or replace function public.save_lead(
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

    -- Contact logged here the same way logActivity()/closeOpenReminders does it on the day
    -- sheet. This runs before the p_reminder_action block below, so if the same call also
    -- carries an explicit 'set' (e.g. "just called, book the next follow-up"), that block
    -- finds no open reminder left to reuse and inserts a fresh one — the explicit intent
    -- still ends up open. A 'clear' in the same call is just a harmless second close.
    if coalesce(p_note_type, 'note') in ('call', 'email', 'meeting') then
      update public.reminders
         set done_at = now()
       where lead_id = p_lead_id
         and done_at is null;
    end if;
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
