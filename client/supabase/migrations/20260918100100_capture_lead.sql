-- Inbound lead capture: the first thing in LeadFlow that receives HTTP.
--
-- Postgres cannot receive a request, so an Edge Function (`capture-lead`) does, and all it does
-- is hand the bearer token and the JSON body to `capture_lead` below. Everything that matters —
-- who the caller is, which tenant they may write to, validation, rate limit, idempotency, both
-- inserts — happens here, in one transaction, so the function stays a thin adapter and the web
-- form (SCREENS 8.2) can reuse the same path unchanged. documents/PLAN-capture-lead.md.
--
-- Trust model: a capture token is an API key scoped to exactly one tenant and exactly one
-- ability — create a lead there. It is stored hashed; the raw value is returned once by
-- mint_capture_token and never again. `capture_lead` is executable only by the secret-key role
-- the function runs as, so a signed-in user cannot reach it through PostgREST.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

-- Idempotency key from the caller. Same (tenant, ref) → same lead, one note.
alter table public.leads add column external_ref text;
create unique index leads_tenant_external_ref_key
  on public.leads (tenant_id, external_ref) where external_ref is not null;

create table public.capture_tokens (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  token_hash   bytea not null unique,
  label        text not null,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  -- ponytail: fixed 60s window on the token row, no hits table. Upgrade path when a public
  -- form needs per-IP limits before auth: Upstash Redis in the function
  -- (supabase.com/docs/guides/functions/examples/rate-limiting).
  window_start timestamptz not null default now(),
  window_count int not null default 0
);

-- RLS on, no policies: nothing reads or writes this table through PostgREST. Only the two
-- security-definer functions below touch it.
alter table public.capture_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- 2. mint_capture_token — owner only, returns the raw token once
-- ---------------------------------------------------------------------------
create function public.mint_capture_token(p_tenant_id uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not (select private.is_tenant_owner(p_tenant_id)) then
    raise exception 'only a tenant owner may mint a capture token';
  end if;
  if p_label is null or btrim(p_label) = '' then
    raise exception 'a label is required';
  end if;

  -- 32 random bytes, base64url without padding: safe in a header, ~43 chars.
  v_token := pg_catalog.translate(
    pg_catalog.rtrim(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/', '-_');

  insert into public.capture_tokens (tenant_id, token_hash, label)
  values (p_tenant_id, extensions.digest(v_token, 'sha256'), btrim(p_label));

  return v_token;
end;
$$;

revoke execute on function public.mint_capture_token(uuid, text) from public, anon;
grant  execute on function public.mint_capture_token(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. capture_lead — the whole request in one transaction
-- ---------------------------------------------------------------------------
-- Errors are raised with a single-word message the function maps to a status:
--   unauthorized        → 401
--   rate_limited        → 429
--   validation:<field>  → 400 {error:"validation", field}
-- Anything else is a bug and surfaces as 500.
--
-- Returns {"lead_id", "created", "tenant_id"}. tenant_id is for the function's log line only;
-- it does not go back to the caller.
create function public.capture_lead(p_token text, p_payload jsonb)
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

  return jsonb_build_object('lead_id', v_lead_id, 'created', true, 'tenant_id', v_tok.tenant_id);
end;
$$;

-- Only the function's secret-key client may call this. It connects as service_role, which
-- is not covered by `public` once the default grant is revoked, so grant it explicitly.
revoke execute on function public.capture_lead(text, jsonb) from public, anon, authenticated;
grant  execute on function public.capture_lead(text, jsonb) to service_role;
