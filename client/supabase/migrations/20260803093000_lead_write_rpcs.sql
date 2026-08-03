-- Atomic lead writes.
--
-- The lead sheet saves several things at once: the lead's own fields, an optional
-- activity note, and any qualification answers the user touched. Done as separate
-- PostgREST calls those can half-succeed — the stage lands and the typed note is
-- lost — which is exactly the failure the notification layer's interrupt exists to
-- report. A function body is a single transaction, so here it either all commits or
-- none of it does.
--
-- Both functions are `security invoker` (the default, stated for the reader): RLS
-- still decides everything. A caller who is not a member of the lead's tenant sees
-- no row to update and gets `P0002`, and the insert paths inherit the same policies
-- as a direct write. Nothing here is trusted from the client — `tenant_id` is read
-- back off the lead rather than accepted as an argument, and `created_by` /
-- `answered_by` come from `auth.uid()`.

-- ---------------------------------------------------------------- create

-- p_tenant_id is passed rather than derived because a user may belong to more than
-- one tenant; the `leads_insert` policy's WITH CHECK rejects a tenant the caller is
-- not a member of, so passing it is safe and asking the client which pipeline it
-- means is correct.
create function public.create_lead(
  p_tenant_id       uuid,
  p_name            text,
  p_company         text                    default null,
  p_email           text                    default null,
  p_phone           text                    default null,
  p_source          public.lead_source      default 'other',
  p_status          public.lead_status      default 'new',
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

  insert into public.leads (
    tenant_id, created_by, assigned_to, name, company, email, phone,
    source, status, estimated_value
  )
  values (
    p_tenant_id, auth.uid(), auth.uid(), btrim(p_name),
    nullif(btrim(coalesce(p_company, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_source, p_status, p_estimated_value
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------- save

-- p_answers is [{"item":"budget","answer":"yes"}, ...] — only the items the user
-- actually touched. Absent items stay absent, which is what keeps "not asked"
-- distinguishable from "asked, unknown" (see the PM decisions doc).
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
  p_answers         jsonb                default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'lead name is required' using errcode = '23514';
  end if;

  -- The status trigger appends its own `status_changed` activity, so this does not.
  update public.leads
     set name            = btrim(p_name),
         company         = nullif(btrim(coalesce(p_company, '')), ''),
         email           = nullif(btrim(coalesce(p_email, '')), ''),
         phone           = nullif(btrim(coalesce(p_phone, '')), ''),
         source          = p_source,
         status          = p_status,
         estimated_value = p_estimated_value,
         -- a reason only means something on a lost lead; clear it otherwise
         lost_reason     = case
                             when p_status = 'lost'
                               then nullif(btrim(coalesce(p_lost_reason, '')), '')
                             else null
                           end
   where id = p_lead_id
  returning tenant_id into v_tenant_id;

  -- No row means RLS filtered it or the id is gone. Same outcome either way, and
  -- the client maps P0002 to "the record was not found" rather than interrupting.
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
end;
$$;

-- ---------------------------------------------------------------- grants
--
-- Postgres grants EXECUTE to PUBLIC on every new function and `public` is an exposed
-- schema, so these must be closed explicitly — same reasoning as
-- 20260802154552_lock_down_trigger_functions.

revoke execute on function public.create_lead(uuid, text, text, text, text, public.lead_source, public.lead_status, numeric) from public, anon;
revoke execute on function public.save_lead(uuid, text, text, text, text, public.lead_source, public.lead_status, numeric, text, text, public.activity_type, jsonb) from public, anon;

grant execute on function public.create_lead(uuid, text, text, text, text, public.lead_source, public.lead_status, numeric) to authenticated;
grant execute on function public.save_lead(uuid, text, text, text, text, public.lead_source, public.lead_status, numeric, text, text, public.activity_type, jsonb) to authenticated;
