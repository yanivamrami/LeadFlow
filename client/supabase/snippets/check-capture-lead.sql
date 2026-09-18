-- Self-check for capture_lead. Run in the SQL editor as postgres; it rolls back.
-- Fails loudly (raise) if idempotency, the note, or the token check break.
begin;

do $$
declare
  v_tenant uuid;
  v_token  text;
  v_a      jsonb;
  v_b      jsonb;
  v_notes  int;
begin
  -- A throwaway user: handle_new_user creates the tenant, owner membership and stages.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'capture-check@example.invalid', '', '{}', '{}', now(), now());
  select tenant_id into v_tenant from public.memberships
   where user_id = (select id from auth.users where email = 'capture-check@example.invalid')
     and role = 'owner';

  -- mint_capture_token checks is_tenant_owner via auth.uid(); insert directly here instead.
  v_token := 'check-' || gen_random_uuid()::text;
  insert into public.capture_tokens (tenant_id, token_hash, label)
  values (v_tenant, extensions.digest(v_token, 'sha256'), 'self-check');

  v_a := public.capture_lead(v_token, jsonb_build_object(
    'source', 'whatsapp', 'external_ref', 'check:1', 'name', 'בדיקה',
    'employees_count', 7, 'conversation_url', 'https://wa.me/1', 'notes', E'a\nb'));
  v_b := public.capture_lead(v_token, jsonb_build_object(
    'source', 'whatsapp', 'external_ref', 'check:1', 'name', 'בדיקה'));

  assert (v_a->>'created')::boolean, 'first call should create';
  assert not (v_b->>'created')::boolean, 'second call should replay';
  assert v_a->>'lead_id' = v_b->>'lead_id', 'same external_ref must give same lead';

  select count(*) into v_notes from public.activities
   where lead_id = (v_a->>'lead_id')::uuid and type = 'note';
  assert v_notes = 1, 'exactly one note';
  assert (select body from public.activities where lead_id = (v_a->>'lead_id')::uuid)
       = E'ליד מהבוט של נטלוש בוואטסאפ\nעובדים: 7\nשיחה: https://wa.me/1\n\na\nb', 'note body';
  assert (select assigned_to from public.leads where id = (v_a->>'lead_id')::uuid) is not null,
    'assigned to owner';

  begin
    perform public.capture_lead('nope', '{}'::jsonb);
    raise exception 'unknown token must fail';
  exception when others then
    assert sqlerrm = 'unauthorized', 'expected unauthorized, got ' || sqlerrm;
  end;

  begin
    perform public.capture_lead(v_token, jsonb_build_object('source','whatsapp','external_ref','check:2'));
    raise exception 'missing name must fail';
  exception when others then
    assert sqlerrm = 'validation:name', 'expected validation:name, got ' || sqlerrm;
  end;

  raise notice 'capture_lead: all checks passed';
end $$;

rollback;
