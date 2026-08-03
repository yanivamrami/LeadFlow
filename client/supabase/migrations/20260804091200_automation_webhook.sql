-- Tier B: the one action that leaves the database.
--
-- Everything in tier A (20260804091100) is a single SQL statement, so it runs inside the
-- stage-change transaction and a rolled-back move sends nothing. A webhook cannot work that way:
-- it is an HTTP call to a host we do not control, which can be slow, down for an hour, or a
-- deliberate trap, and no user's stage move may ever wait on it.
--
-- It is still not an Edge Function. `pg_net` queues the request and its background worker sends
-- it, so the transaction commits immediately and nothing blocks — the same property a worker
-- would have bought, with no second runtime, no deploy step, and no secret living somewhere else.
-- documents/PLAN-automations.md §1 records that reasoning in full.
--
-- WHAT THIS DESIGN DOES NOT GIVE US, stated here because it is a release condition and not a
-- footnote: `pg_net` cannot resolve a hostname before sending, so the guard below is a *string*
-- check. A webhook aimed at a domain whose A record answers 169.254.169.254 would still be sent.
-- Today the only person who can create an automation is a tenant owner pointing at their own
-- endpoint, so they would be attacking themselves. That stops being true the moment strangers
-- are tenants. **Before the first external tenant: move this sender into an Edge Function that
-- resolves and validates the address first, or restrict webhook hosts to an owner-confirmed
-- allowlist.** GAPS G-38 carries this.

create extension if not exists pg_net;
-- hmac() lives in pgcrypto. Supabase keeps extensions in their own schema, and config.toml
-- already puts `extensions` on the search path for the API roles.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. The URL guard
-- ---------------------------------------------------------------------------
-- Returns null when the URL is acceptable, or a Hebrew refusal for the UI to show. It runs at
-- save time (called by the client through a check RPC, and again here at send time) because a
-- rule enforced only in a browser is one PostgREST call away from not being enforced at all.
--
-- The client mirrors this in TypeScript for instant feedback; this is the authoritative copy.

create function public.webhook_url_check(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_url  text := btrim(coalesce(p_url, ''));
  v_auth text;
  v_host text;
begin
  if v_url = '' then
    return 'צריך כתובת';
  end if;

  -- HTTPS only. Lead data leaves the tenant in this request; sending it in the clear is not a
  -- trade-off worth offering.
  if v_url !~* '^https://' then
    return 'הכתובת חייבת להתחיל ב‑https://';
  end if;

  -- Authority = everything between the scheme and the first /, ? or #.
  v_auth := pg_catalog.split_part(
              pg_catalog.regexp_replace(pg_catalog.substr(v_url, 9), '[/?#].*$', ''), ' ', 1);

  -- Reject embedded credentials outright rather than trying to parse around them. `user@host`
  -- forms are the classic way to make a URL read as one host and resolve as another, and no
  -- legitimate webhook target needs them.
  if v_auth like '%@%' then
    return 'כתובת עם שם משתמש או סיסמה אינה נתמכת';
  end if;

  -- Strip the port, and the brackets around an IPv6 literal.
  v_host := pg_catalog.lower(pg_catalog.regexp_replace(v_auth, ':\d+$', ''));
  v_host := pg_catalog.btrim(v_host, '[]');

  if v_host = '' then
    return 'לא זיהינו כתובת אתר תקינה';
  end if;

  -- Literal addresses and names that point back inside. This is the part a string check can
  -- actually do; the DNS case is the documented gap above.
  if v_host = 'localhost'
     or v_host like '%.localhost'
     or v_host = '0.0.0.0'
     or v_host = '::1'
     or v_host = 'metadata.google.internal'
     or v_host ~ '^127\.'                                  -- loopback
     or v_host ~ '^10\.'                                   -- private
     or v_host ~ '^192\.168\.'                             -- private
     or v_host ~ '^172\.(1[6-9]|2[0-9]|3[01])\.'           -- private
     or v_host ~ '^169\.254\.'                             -- link-local, incl. cloud metadata
     or v_host ~ '^f[cd]'                                  -- IPv6 unique-local fc00::/7
     or v_host ~ '^fe[89ab]'                               -- IPv6 link-local fe80::/10
  then
    return 'הכתובת מצביעה על כתובת פנימית ולא ניתן לשלוח אליה';
  end if;

  return null;
end;
$$;

revoke execute on function public.webhook_url_check(text) from public, anon;
grant  execute on function public.webhook_url_check(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1b. Minting the signing secret
-- ---------------------------------------------------------------------------
-- The secret is generated *here*, not in the browser, and the caller sees it exactly once.
--
-- Found while integrating: the rule editor was minting a secret client-side and displaying it,
-- with nothing writing it anywhere the sender could read. Every webhook would have failed at
-- send time with "no signing key" — a whole feature that saves cleanly and never works. Two
-- reasons to fix it this way round rather than by letting the client write to Vault: the client
-- has no access to the vault schema and should not (a browser that can write secrets can read
-- the ones it wrote), and a secret minted next to where it is stored never travels except in the
-- single response that shows it to the person who created it.
--
-- `security definer` so an owner can mint without any privilege on the vault schema, and the
-- ownership check is explicit because a definer function does not get RLS applied for free.

create function public.mint_webhook_secret(p_automation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_action public.automation_action;
  v_name   text;
  v_secret text;
begin
  select tenant_id, action into v_tenant, v_action
    from public.automations where id = p_automation_id;

  if v_tenant is null then
    raise exception 'automation not found';
  end if;
  if not (select private.is_tenant_owner(v_tenant)) then
    raise exception 'only a tenant owner may mint a signing secret';
  end if;
  if v_action <> 'webhook' then
    raise exception 'only a webhook rule has a signing secret';
  end if;

  -- 32 bytes of pgcrypto randomness, hex-encoded. The vault entry is named after the
  -- automation, so a rule and its secret cannot drift apart, and rotation overwrites in place.
  v_secret := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_name   := 'wh_' || pg_catalog.replace(p_automation_id::text, '-', '');

  -- Rotating: drop the previous entry first so the name stays unique.
  delete from vault.secrets where name = v_name;
  perform vault.create_secret(v_secret, v_name, 'LeadFlow webhook signing secret');

  update public.automations
     set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('secret_ref', v_name)
   where id = p_automation_id;

  -- The only time this value is ever returned. After this the row holds a name, not a key.
  return v_secret;
end;
$$;

revoke execute on function public.mint_webhook_secret(uuid) from public, anon;
grant  execute on function public.mint_webhook_secret(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Payload
-- ---------------------------------------------------------------------------
-- Deliberately narrow. Checklist answers and activity bodies are the most sensitive fields in
-- the product and no integration needs them by default, so they are not here. `version` is
-- present from the first send: adding one politely later is impossible once integrations parse
-- this shape.

create function private.webhook_payload(p_run_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'version',   1,
           'event',     'lead_entered_stage',
           'sent_at',   to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'tenant_id', r.tenant_id,
           'lead', jsonb_build_object(
                     'id',              l.id,
                     'name',            l.name,
                     'company',         l.company,
                     'source',          l.source::text,
                     'estimated_value', l.estimated_value,
                     'stage',           jsonb_build_object('id', s.id, 'name', s.name,
                                                           'kind', s.kind::text)
                   )
         )
    from public.automation_runs r
    join public.leads           l on l.id = r.lead_id
    join public.pipeline_stages s on s.id = l.stage_id
   where r.id = p_run_id;
$$;

revoke execute on function private.webhook_payload(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Send
-- ---------------------------------------------------------------------------
-- Claims with `for update ... skip locked` so two overlapping cron ticks cannot both take the
-- same row. `attempt` is incremented at claim time, not at completion: a crash between claiming
-- and sending then costs one attempt rather than risking a duplicate send. For a webhook that
-- may create something on the far side, losing an attempt is the safer half of that trade.

create function private.send_due_webhooks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          record;
  v_url      text;
  v_refusal  text;
  v_secret   text;
  v_payload  jsonb;
  v_body     text;
  v_request  bigint;
begin
  for r in
    update public.automation_runs ar
       set status  = 'sending',
           attempt = ar.attempt + 1
     where ar.id in (
             select ar2.id
               from public.automation_runs ar2
               join public.automations a on a.id = ar2.automation_id
              where ar2.status = 'queued'
                and ar2.run_after <= now()
                and a.action = 'webhook'
                and a.enabled
                and a.suspended_at is null
              order by ar2.run_after
              limit 20
                for update of ar2 skip locked
           )
    returning ar.*
  loop
    v_url := null;
    v_secret := null;

    select a.config ->> 'url' into v_url
      from public.automations a where a.id = r.automation_id;

    v_refusal := public.webhook_url_check(v_url);
    if v_refusal is not null then
      update public.automation_runs
         set status = 'failed', error = v_refusal, completed_at = now()
       where id = r.id;
      continue;
    end if;

    -- The signing secret. Read from Vault by the name the rule stored, never from the config
    -- row itself: a secret in a table the owner can select is a secret in every backup and every
    -- screenshot. If it cannot be resolved we fail the run rather than sending unsigned — an
    -- unsigned webhook is one the receiver cannot distinguish from anybody else's.
    begin
      select vs.decrypted_secret into v_secret
        from vault.decrypted_secrets vs
        join public.automations a on a.id = r.automation_id
       where vs.name = a.config ->> 'secret_ref';
    exception when others then
      v_secret := null;
    end;

    if v_secret is null or v_secret = '' then
      update public.automation_runs
         set status = 'failed',
             error  = 'לא נמצא מפתח חתימה לאוטומציה הזאת',
             completed_at = now()
       where id = r.id;
      continue;
    end if;

    v_payload := private.webhook_payload(r.id);
    if v_payload is null then
      -- The lead was deleted between enqueue and send. Nothing to report to anyone.
      update public.automation_runs
         set status = 'skipped',
             skip_reason = 'הליד נמחק לפני שהבקשה נשלחה',
             completed_at = now()
       where id = r.id;
      continue;
    end if;

    v_body := v_payload::text;

    -- Signature is over the exact bytes sent, hex-encoded, so a receiver can recompute it from
    -- the raw body without re-serialising the JSON — re-serialising is where signature checks
    -- usually break.
    select net.http_post(
             url     := v_url,
             body    := v_payload,
             headers := jsonb_build_object(
                          'Content-Type', 'application/json',
                          'X-LeadFlow-Event', 'lead_entered_stage',
                          'X-LeadFlow-Signature',
                          'sha256=' || pg_catalog.encode(
                            extensions.hmac(v_body, v_secret, 'sha256'), 'hex')
                        ),
             timeout_milliseconds := 10000
           )
      into v_request;

    update public.automation_runs
       set request_id = v_request
     where id = r.id;
  end loop;
end;
$$;

revoke execute on function private.send_due_webhooks() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reconcile
-- ---------------------------------------------------------------------------
-- pg_net returns a request id, not a result, so success is learned afterwards from
-- net._http_response. Two cases beyond the obvious 2xx/non-2xx:
--
--   * The response row never appears — reaped on pg_net's own schedule, or the request never
--     completed. A row stuck in 'sending' past the grace window is treated as failed, because
--     the alternative is a run that hangs forever and a user who is never told.
--   * Retries are bounded. After the last attempt the run is dead-lettered with its error kept,
--     which is what the run log (SCREENS 9.4) shows — the only place a user can discover their
--     endpoint has been failing for a week.

-- 1m, 5m, 30m, 2h. Spread out fast enough to survive a restart and slowly enough that a broken
-- endpoint is not hammered for hours. Defined before its caller so creation order never depends
-- on plpgsql deferring name resolution.
create function private.webhook_backoff(p_attempt int)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_attempt
           when 1 then interval '1 minute'
           when 2 then interval '5 minutes'
           when 3 then interval '30 minutes'
           else        interval '2 hours'
         end;
$$;

revoke execute on function private.webhook_backoff(int) from public, anon, authenticated;

create function private.reconcile_webhooks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  MAX_ATTEMPTS constant int := 5;
  r      record;
  v_code int;
  v_err  text;
begin
  for r in
    select * from public.automation_runs
     where status = 'sending' and request_id is not null
     order by created_at
     limit 100
  loop
    v_code := null;
    v_err  := null;

    begin
      select status_code, error_msg into v_code, v_err
        from net._http_response where id = r.request_id;
    exception when others then
      -- The response table is not readable or the row is gone; fall through to the
      -- stuck-request branch below rather than failing the whole sweep.
      v_code := null;
    end;

    if v_code between 200 and 299 then
      update public.automation_runs
         set status = 'done', error = null, completed_at = now()
       where id = r.id;

    elsif v_code is not null then
      if r.attempt >= MAX_ATTEMPTS then
        update public.automation_runs
           set status = 'failed',
               error  = 'המערכת בצד השני החזירה שגיאה ' || v_code::text,
               completed_at = now()
         where id = r.id;
      else
        update public.automation_runs
           set status     = 'queued',
               request_id = null,
               error      = 'ניסיון ' || r.attempt::text || ': שגיאה ' || v_code::text,
               run_after  = now() + private.webhook_backoff(r.attempt)
         where id = r.id;
      end if;

    elsif r.created_at < now() - interval '15 minutes' then
      -- No answer and out of patience.
      if r.attempt >= MAX_ATTEMPTS then
        update public.automation_runs
           set status = 'failed',
               error  = coalesce(v_err, 'לא התקבלה תשובה מהכתובת'),
               completed_at = now()
         where id = r.id;
      else
        update public.automation_runs
           set status     = 'queued',
               request_id = null,
               error      = coalesce(v_err, 'לא התקבלה תשובה — ננסה שוב'),
               run_after  = now() + private.webhook_backoff(r.attempt)
         where id = r.id;
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function private.reconcile_webhooks() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Schedule
-- ---------------------------------------------------------------------------
-- Idempotent (un)scheduling, matching the pattern 20260804091100 established for the tier-A
-- sweep, so re-running this migration does not stack duplicate jobs.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-webhooks') then
    perform cron.unschedule('send-webhooks');
  end if;
  if exists (select 1 from cron.job where jobname = 'reconcile-webhooks') then
    perform cron.unschedule('reconcile-webhooks');
  end if;

  perform cron.schedule('send-webhooks', '* * * * *',
                        $job$select private.send_due_webhooks();$job$);
  -- Also every minute, and deliberately NOT offset with a sleep inside the job body: holding a
  -- cron worker on pg_sleep to wait for a response is a worker spent doing nothing, and a
  -- multi-statement cron command is not a shape worth relying on. A request handed to pg_net
  -- seconds ago simply has no response row yet and is picked up on the following tick — one
  -- minute of extra latency on a job that already retries over hours.
  perform cron.schedule('reconcile-webhooks', '* * * * *',
                        $job$select private.reconcile_webhooks();$job$);
end;
$$;
