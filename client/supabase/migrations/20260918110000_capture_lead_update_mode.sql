-- capture_lead learns an update mode, and both modes now put the lead on the day sheet.
--
-- The Netlush bot asked for append-note (2026-09-18); Yaniv widened it: a payload without
-- `source` is an update of the lead with that external_ref — contact details, estimated
-- value, checklist answers, and/or one appended note — and creates nothing. Unknown
-- external_ref → `not_found` (mapped to 404). Absent keys are untouched.
--
-- What the bot did not ask for, and what makes the note more than a timeline entry: the
-- client's day sheet is driven by an open reminder due today (attention.ts: `reminder_due`
-- outranks every other signal), and it folds *every* activity into `lastTouchAt`, so a bot
-- note on its own would make the lead look freshly handled and push it *off* the drift and
-- unqualified flags. So both modes end by opening a follow-up due now — or pulling the
-- existing open one forward — assigned to whoever owns the lead. A WhatsApp lead that just
-- arrived, or just said more, is the first thing the owner should see today, not tomorrow.
--
-- Create mode is otherwise the 20260918100100 body. `create or replace` keeps the grants.

-- Open a follow-up due now on the lead, or pull the existing open one forward. One row at
-- most stays open per bot event; a second note the same morning does not stack reminders.
create or replace function private.capture_surface_lead(p_lead_id uuid, p_tenant_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reminders
     set due_at = least(due_at, now())
   where lead_id = p_lead_id and done_at is null;
  if not found then
    insert into public.reminders (lead_id, tenant_id, assigned_to, title, due_at)
    select id, tenant_id, assigned_to, p_title, now()
      from public.leads where id = p_lead_id and tenant_id = p_tenant_id;
  end if;
end;
$$;
revoke execute on function private.capture_surface_lead(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.capture_lead(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tok        public.capture_tokens%rowtype;
  v_ref        text;
  v_name       text;
  v_source     public.lead_source;
  v_occurred   timestamptz;
  v_lead_id    uuid;
  v_stage_id   uuid;
  v_owner_id   uuid;
  v_body       text;
  v_employees  int;
  v_note_id    uuid;
  v_value      numeric;
begin
  -- 1. Who is calling. The row lock also serialises the rate-limit counter below.
  select * into v_tok
    from public.capture_tokens
   where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
     and revoked_at is null
   for update;
  if v_tok.id is null then
    raise exception 'unauthorized';
  end if;

  -- 2. Rate limit: 60 per fixed minute per token. A raise rolls the increment back too, which
  --    is fine — the window is already full.
  if v_tok.window_start < now() - interval '1 minute' then
    update public.capture_tokens set window_start = now(), window_count = 1 where id = v_tok.id;
  elsif v_tok.window_count >= 60 then
    raise exception 'rate_limited';
  else
    update public.capture_tokens set window_count = window_count + 1 where id = v_tok.id;
  end if;

  -- 3. Validate. Lengths per the contract in documents/PLAN-capture-lead.md.
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'validation:body';
  end if;

  v_ref := nullif(btrim(coalesce(p_payload->>'external_ref', '')), '');
  if v_ref is null or length(v_ref) > 200 then
    raise exception 'validation:external_ref';
  end if;

  -- 3a. Update mode: no `source` in the payload. Create needs one, so its absence says
  --     "this ref already exists, change it". Every field is optional and absent means
  --     untouched; unknown ref → not_found. No idempotency: replaying an update is harmless.
  if not (p_payload ? 'source') then
    select id into v_lead_id
      from public.leads
     where tenant_id = v_tok.tenant_id and external_ref = v_ref;
    if v_lead_id is null then
      raise exception 'not_found';
    end if;

    -- contact details and value: same rules as create, applied only when the key is present
    if p_payload ? 'name' then
      v_name := nullif(btrim(coalesce(p_payload->>'name', '')), '');
      if v_name is null or length(v_name) > 120 then raise exception 'validation:name'; end if;
      update public.leads set name = v_name where id = v_lead_id;
    end if;
    if p_payload ? 'company' then
      if length(coalesce(p_payload->>'company', '')) > 120 then raise exception 'validation:company'; end if;
      update public.leads set company = nullif(btrim(coalesce(p_payload->>'company', '')), '') where id = v_lead_id;
    end if;
    if p_payload ? 'phone' then
      if length(coalesce(p_payload->>'phone', '')) > 32 then raise exception 'validation:phone'; end if;
      update public.leads set phone = nullif(btrim(coalesce(p_payload->>'phone', '')), '') where id = v_lead_id;
    end if;
    if p_payload ? 'email' then
      if length(coalesce(p_payload->>'email', '')) > 254 then raise exception 'validation:email'; end if;
      update public.leads set email = nullif(btrim(coalesce(p_payload->>'email', '')), '') where id = v_lead_id;
    end if;
    if p_payload ? 'estimated_value' then
      begin
        v_value := nullif(p_payload->>'estimated_value', '')::numeric;
      exception when others then
        raise exception 'validation:estimated_value';
      end;
      if v_value < 0 or v_value >= 10000000000 then raise exception 'validation:estimated_value'; end if;
      update public.leads set estimated_value = v_value where id = v_lead_id;
    end if;

    -- checklist: {"budget":"yes","timeline":"unknown"} — only the items sent, upserted
    if p_payload ? 'answers' and jsonb_typeof(p_payload->'answers') <> 'null' then
      if jsonb_typeof(p_payload->'answers') <> 'object' then raise exception 'validation:answers'; end if;
      begin
        insert into public.qualification_answers (lead_id, tenant_id, item, answer, answered_by)
        select v_lead_id, v_tok.tenant_id, key::public.checklist_item, value::public.qualification_answer, null
          from jsonb_each_text(p_payload->'answers')
        on conflict (lead_id, item) do update
          set answer = excluded.answer, answered_by = null, answered_at = now();
      exception when invalid_text_representation then
        raise exception 'validation:answers';
      end;
    end if;

    -- a note, prefixed so the timeline says who wrote it
    if p_payload ? 'append_note' and jsonb_typeof(p_payload->'append_note') <> 'null' then
      if jsonb_typeof(p_payload->'append_note') <> 'string'
         or nullif(btrim(p_payload->>'append_note'), '') is null
         or length(p_payload->>'append_note') > 4000 then
        raise exception 'validation:append_note';
      end if;
      insert into public.activities (lead_id, tenant_id, created_by, type, body)
      values (v_lead_id, v_tok.tenant_id, null, 'note',
              'עדכון מהבוט של נטלוש בוואטסאפ' || E'\n' || btrim(p_payload->>'append_note'))
      returning id into v_note_id;
    end if;

    perform private.capture_surface_lead(v_lead_id, v_tok.tenant_id, 'הבוט הוסיף מידע חדש — כדאי לחזור');

    return jsonb_build_object('lead_id', v_lead_id, 'created', false, 'note_id', v_note_id,
                              'tenant_id', v_tok.tenant_id);
  end if;

  v_name := nullif(btrim(coalesce(p_payload->>'name', '')), '');
  if v_name is null or length(v_name) > 120 then
    raise exception 'validation:name';
  end if;

  begin
    v_source := (p_payload->>'source')::public.lead_source;
  exception when others then
    raise exception 'validation:source';
  end;
  if v_source is null then
    raise exception 'validation:source';
  end if;

  if length(coalesce(p_payload->>'company', '')) > 120 then raise exception 'validation:company'; end if;
  if length(coalesce(p_payload->>'phone', ''))   > 32  then raise exception 'validation:phone';   end if;
  if length(coalesce(p_payload->>'email', ''))   > 254 then raise exception 'validation:email';   end if;
  if length(coalesce(p_payload->>'notes', ''))   > 4000 then raise exception 'validation:notes';  end if;
  if length(coalesce(p_payload->>'conversation_url', '')) > 200 then
    raise exception 'validation:conversation_url';
  end if;

  if p_payload ? 'employees_count' and jsonb_typeof(p_payload->'employees_count') <> 'null' then
    begin
      v_employees := (p_payload->>'employees_count')::int;
    exception when others then
      raise exception 'validation:employees_count';
    end;
    if v_employees < 0 then raise exception 'validation:employees_count'; end if;
  end if;

  if p_payload ? 'occurred_at' and jsonb_typeof(p_payload->'occurred_at') <> 'null' then
    begin
      v_occurred := (p_payload->>'occurred_at')::timestamptz;
    exception when others then
      raise exception 'validation:occurred_at';
    end;
  end if;
  v_occurred := coalesce(v_occurred, now());

  -- 4. Idempotent replay.
  select id into v_lead_id
    from public.leads
   where tenant_id = v_tok.tenant_id and external_ref = v_ref;
  if v_lead_id is not null then
    return jsonb_build_object('lead_id', v_lead_id, 'created', false, 'tenant_id', v_tok.tenant_id);
  end if;

  -- 5. Where it lands and who owns it: first live open stage, oldest owner. Same choice the
  --    client makes for a manual lead; the owner so it reaches someone's day sheet.
  select id into v_stage_id
    from public.pipeline_stages
   where tenant_id = v_tok.tenant_id and kind = 'open' and archived_at is null
   order by position
   limit 1;
  select user_id into v_owner_id
    from public.memberships
   where tenant_id = v_tok.tenant_id and role = 'owner'
   order by created_at
   limit 1;
  if v_stage_id is null or v_owner_id is null then
    raise exception 'tenant % has no open stage or no owner', v_tok.tenant_id;
  end if;

  -- 6. Note body: fixed first line, optional facts, blank line, the caller's notes verbatim.
  v_body := 'ליד מהבוט של נטלוש בוואטסאפ';
  if v_employees is not null then
    v_body := v_body || E'\n' || 'עובדים: ' || v_employees;
  end if;
  if nullif(btrim(coalesce(p_payload->>'conversation_url', '')), '') is not null then
    v_body := v_body || E'\n' || 'שיחה: ' || btrim(p_payload->>'conversation_url');
  end if;
  if nullif(btrim(coalesce(p_payload->>'notes', '')), '') is not null then
    v_body := v_body || E'\n\n' || btrim(p_payload->>'notes');
  end if;

  -- 7. Insert. Two retries racing past step 4 collide on the unique index; the loser reads
  --    the winner's row and answers exactly as a replay would.
  begin
    insert into public.leads (
      tenant_id, created_by, assigned_to, name, company, email, phone,
      source, stage_id, external_ref, is_demo
    )
    values (
      v_tok.tenant_id, null, v_owner_id, v_name,
      nullif(btrim(coalesce(p_payload->>'company', '')), ''),
      nullif(btrim(coalesce(p_payload->>'email', '')), ''),
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      v_source, v_stage_id, v_ref, false
    )
    returning id into v_lead_id;
  exception when unique_violation then
    select id into v_lead_id
      from public.leads
     where tenant_id = v_tok.tenant_id and external_ref = v_ref;
    return jsonb_build_object('lead_id', v_lead_id, 'created', false, 'tenant_id', v_tok.tenant_id);
  end;

  insert into public.activities (lead_id, tenant_id, created_by, type, body, occurred_at)
  values (v_lead_id, v_tok.tenant_id, null, 'note', v_body, v_occurred);

  perform private.capture_surface_lead(v_lead_id, v_tok.tenant_id, 'ליד חדש מהבוט — לחזור אליו היום');

  return jsonb_build_object('lead_id', v_lead_id, 'created', true, 'tenant_id', v_tok.tenant_id);
end;
$$;

