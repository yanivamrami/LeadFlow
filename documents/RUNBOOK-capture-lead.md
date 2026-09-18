# RUNBOOK — connect a caller to `capture-lead`

Operator steps, in order. Everything here runs against the single Supabase project, which is
production. Spec: PLAN-capture-lead.md. Bot-side contract: HANDOFF-capture-lead-bot.md.

## 1. Apply the migrations (once)

```bash
cd client && supabase db push
```

Applies `20260918100000_lead_source_whatsapp` and `20260918100100_capture_lead`. Both were
validated on a local stack with `supabase db reset` and `snippets/check-capture-lead.sql`.

## 2. Deploy the function (once, first function deploy on this project)

```bash
cd client && supabase functions deploy capture-lead --no-verify-jwt
```

`--no-verify-jwt` is required: the bearer is our capture token, not a Supabase JWT. No secrets
to set; Supabase injects `SUPABASE_SECRET_KEYS`. The URL is
`https://awifckxssybwiheveqqv.supabase.co/functions/v1/capture-lead`.

## 3. Mint a token for the tenant (once per caller)

In the Supabase SQL editor. Find the tenant:
```sql
select t.id, t.name, u.email
  from public.tenants t
  join public.memberships m on m.tenant_id = t.id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
 order by t.name;
```

Mint, as postgres in the SQL editor:
```sql
with tok as (
  select translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_') as raw
)
insert into public.capture_tokens (tenant_id, token_hash, label)
select '<tenant uuid>', extensions.digest(raw, 'sha256'), 'netlush whatsapp bot' from tok
returning (select raw from tok) as token;
```

The value is shown once. Copy it to the bot's secret store (`LeadFlow:CaptureToken`), not to
chat, mail, or git. LeadFlow keeps only the hash.

`public.mint_capture_token(tenant_id, label)` does the same thing with an owner check on
`auth.uid()`. It is for a future settings screen where a signed-in owner mints their own token;
from the SQL editor `auth.uid()` is null, so use the insert above.

## 4. Smoke test

```bash
export LEADFLOW_CAPTURE_TOKEN='<the token>'
curl -sS -i -X POST "https://awifckxssybwiheveqqv.supabase.co/functions/v1/capture-lead" \
  -H "Authorization: Bearer $LEADFLOW_CAPTURE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"whatsapp","external_ref":"smoke:1","name":"בדיקה","company":"בדיקה בע\"מ","phone":"+972500000000","notes":"בדיקת חיבור"}'
```

Expected: `201 {"lead_id":"…","created":true}`, a card "בדיקה" in the first column of the
tenant's board with one note. Run it again: `200 {"lead_id":"<same>","created":false}`.
Then delete the smoke lead from the board (or `delete from public.leads where external_ref = 'smoke:1'`).

## 5. Revoke or rotate

```sql
update public.capture_tokens set revoked_at = now() where label = 'netlush whatsapp bot';
```
Rotate = mint a new one (step 3), hand it over, then revoke the old one. Revoked tokens get 401.

## 6. Watch it

Supabase dashboard → Edge Functions → capture-lead → Logs. One line per request:
`capture-lead <status> tenant=<id> ref=<external_ref> <ms>ms`. Bodies are never logged.
