-- save_lead and create_lead learn about stage_id.
--
-- Both functions took `p_status public.lead_status`. The enum is gone (or, more
-- precisely, is on its way out in 20260804095000 — this migration is what lets that one
-- run at all, since the type cannot drop while these two still declare it as a parameter
-- type). Both now take `p_stage_id uuid` instead.
--
-- Drop and recreate, not `create or replace`: a changed parameter type is a different
-- overload as far as Postgres is concerned, and `create or replace` would leave the old
-- `lead_status` version in place alongside the new one — the exact overload PostgREST
-- cannot disambiguate that 20260803140000 already ran into once with an added parameter.
-- A changed type is the same trap.
--
-- Bodies start from the newest version of each function:
--   * save_lead    — 20260803150100_save_lead_closes_reminders.sql, because it is the one
--     that added the reminder-closing block. That block, and both its guards (only when a
--     note was actually written, and only when p_note_type is one of call/email/meeting),
--     are preserved verbatim below — dropping either would re-open GAPS G-26.
--   * create_lead  — 20260803093000_lead_write_rpcs.sql, unchanged since.
--
-- The one behaviour rule that used to key off the enum value `'lost'` — clearing
-- lost_reason on anything but a lost lead — now keys off the selected stage's `kind`,
-- looked up from pipeline_stages. That is the whole point of the kind column
-- (documents/PLAN-stages.md §1): a rename of the lost stage must not change this at all.
--
-- Both functions now also check that p_stage_id actually belongs to the tenant the lead
-- (or, for create_lead, the caller) is in. Nothing stopped a forged tenant_id on the lead
-- row FK before either — the composite FK `leads_stage_fkey (stage_id, tenant_id)` already
-- refuses a cross-tenant stage at the database level — but a raised exception here gives
-- the client a readable error instead of a bare `23503 foreign_key_violation`.

-- ---------------------------------------------------------------- drop the old overloads

drop function if exists public.save_lead(
  uuid, text, text, text, text, public.lead_source, public.lead_status, numeric,
  text, text, public.activity_type, jsonb, text, timestamptz, text
);

drop function if exists public.create_lead(
  uuid, text, text, text, text, public.lead_source, public.lead_status, numeric
);

-- ---------------------------------------------------------------- create

-- p_tenant_id is passed rather than derived because a user may belong to more than one
-- tenant; the `leads_insert` policy's WITH CHECK rejects a tenant the caller is not a
-- member of, so passing it is safe and asking the client which pipeline it means is
-- correct. p_stage_id has no sensible static default any more — "new" was a fixed enum
-- value, and the equivalent today is "whichever stage is first-open for this tenant",
-- which is a per-tenant fact the client already resolves through StagesStore before
-- calling this. Defaulted to null purely so it can stay after p_source in the argument
-- list (Postgres requires defaulted parameters to trail), and rejected explicitly below.
create function public.create_lead(
  p_tenant_id       uuid,
  p_name            text,
  p_company         text                    default null,
  p_email           text                    default null,
  p_phone           text                    default null,
  p_source          public.lead_source      default 'other',
  p_stage_id        uuid                    default null,
  p_estimated_value numeric                 default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'lead name is required' using errcode = '23514';
  end if;

  if p_stage_id is null then
    raise exception 'a stage is required to create a lead' using errcode = '23502';
  end if;

  if not exists (
    select 1 from public.pipeline_stages
     where id = p_stage_id and tenant_id = p_tenant_id
  ) then
    raise exception 'stage % does not belong to tenant %', p_stage_id, p_tenant_id
      using errcode = '23514';
  end if;

  insert into public.leads (
    tenant_id, created_by, assigned_to, name, company, email, phone,
    source, stage_id, estimated_value
  )
  values (
    p_tenant_id, auth.uid(), auth.uid(), btrim(p_name),
    nullif(btrim(coalesce(p_company, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_source, p_stage_id, p_estimated_value
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------- save

-- p_answers is [{"item":"budget","answer":"yes"}, ...] — only the items the user actually
-- touched. Absent items stay absent, which is what keeps "not asked" distinguishable from
-- "asked, unknown" (see the PM decisions doc).
--
-- The tenant lookup moves ahead of the update on purpose: the lost_reason CASE needs the
-- target stage's kind, and that has to be known — and validated — before the row is
-- written, not derived from the same statement that writes it.
create function public.save_lead(
  p_lead_id         uuid,
  p_name            text,
  p_company         text,
  p_email           text,
  p_phone           text,
  p_source          public.lead_source,
  p_stage_id        uuid,
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
  v_stage_kind public.stage_kind;
  v_reminder   uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'lead name is required' using errcode = '23514';
  end if;

  -- No row means RLS filtered it or the id is gone. Same outcome either way, and the
  -- client maps P0002 to "the record was not found" rather than interrupting.
  select tenant_id into v_tenant_id from public.leads where id = p_lead_id;
  if v_tenant_id is null then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  -- p_stage_id must be a live-or-archived stage of this lead's own tenant. The composite
  -- FK on leads.stage_id would refuse the write anyway, but this gives a readable error
  -- rather than a bare foreign-key-violation code.
  select kind into v_stage_kind
    from public.pipeline_stages
   where id = p_stage_id and tenant_id = v_tenant_id;

  if v_stage_kind is null then
    raise exception 'stage % does not belong to this lead''s tenant', p_stage_id
      using errcode = '23514';
  end if;

  update public.leads
     set name            = btrim(p_name),
         company         = nullif(btrim(coalesce(p_company, '')), ''),
         email           = nullif(btrim(coalesce(p_email, '')), ''),
         phone           = nullif(btrim(coalesce(p_phone, '')), ''),
         source          = p_source,
         stage_id        = p_stage_id,
         estimated_value = p_estimated_value,
         -- Was `p_status = 'lost'`; now the stage's kind, so renaming the lost stage
         -- changes no arithmetic and no behaviour at all (documents/PLAN-stages.md §1).
         lost_reason     = case
                             when v_stage_kind = 'lost'
                               then nullif(btrim(coalesce(p_lost_reason, '')), '')
                             else null
                           end
   where id = p_lead_id;

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

-- ---------------------------------------------------------------- grants
--
-- Postgres grants EXECUTE to PUBLIC on every new function and `public` is an exposed
-- schema, so these must be closed explicitly — same reasoning as
-- 20260802154552_lock_down_trigger_functions.

revoke execute on function public.create_lead(
  uuid, text, text, text, text, public.lead_source, uuid, numeric
) from public, anon;

revoke execute on function public.save_lead(
  uuid, text, text, text, text, public.lead_source, uuid, numeric,
  text, text, public.activity_type, jsonb, text, timestamptz, text
) from public, anon;

grant execute on function public.create_lead(
  uuid, text, text, text, text, public.lead_source, uuid, numeric
) to authenticated;

grant execute on function public.save_lead(
  uuid, text, text, text, text, public.lead_source, uuid, numeric,
  text, text, public.activity_type, jsonb, text, timestamptz, text
) to authenticated;
