# PLAN — `capture-lead` endpoint

**Status:** implemented 2026-09-18 (migrations 20260918100000 + 20260918100100, function `capture-lead`). Operator steps: documents/RUNBOOK-capture-lead.md. Bot-side contract: documents/HANDOFF-capture-lead-bot.md.
**Requester:** Netlush WhatsApp bot handoff. Closes GAPS G-39 and pays the G-14 deploy cost.

## Review of the request

Accept as specified, with these corrections to the handoff's assumptions:

| Handoff says | Reality | Consequence |
|---|---|---|
| "dev project, later production" | There is one Supabase project and it is production. | One URL. Every migration below is a live change. The smoke-test lead must be deleted after, or `is_demo = true` on it. |
| `lead_enters_stage` automations run "as for any manually created lead" | `leads_run_stage_automations` fires `after update of stage_id`, never on insert. Manual create does not fire it either. | Nothing to do; state it back so they do not expect the follow-up reminder rule on capture. |
| `created_by = null` might break the UI | The client never reads `leads.created_by`. | Safe. |
| `SUPABASE_SECRET_KEY` secret to set | Supabase injects `SUPABASE_SECRET_KEYS` (JSON, read `default`), as `delete-account` already does. | No secret to set. Only the capture tokens are ours. |
| `alter type ... add value` + client label in one migration | A new enum value cannot be used in the transaction that adds it. | Own migration file, first. |
| Note body template with `עובדים:` and `שיחה:` | Fine, but build it in the RPC not the function, so the web form gets the same shape. | — |

Answers for the two open questions:
- **Netlush tenant:** resolve by `select id, name from public.tenants` on the live project when minting. Not guessable from the repo.
- **`assigned_to` = owner:** yes. Unassigned leads never reach a day sheet, which is the whole reason the bot is sending them. The web form will use the same rule.

## Work items, in order

### 1. Migration `..._lead_source_whatsapp.sql`
```sql
alter type public.lead_source add value 'whatsapp';
```
Client: add `'whatsapp'` to `LeadSource` in `client/src/app/core/lead.model.ts` (type + list), `SOURCES` in `lead-sheet.ts`, the label in `copy.ts` (`whatsapp: 'וואטסאפ'`), and regenerate `database.types.ts`.

### 2. Migration `..._capture_lead.sql`

**Schema**
```sql
alter table public.leads add column external_ref text;
create unique index leads_tenant_external_ref_key
  on public.leads (tenant_id, external_ref) where external_ref is not null;

create table public.capture_tokens (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  token_hash   bytea not null unique,           -- sha256 of the raw token
  label        text not null,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  window_start timestamptz not null default now(),   -- ponytail: fixed 60s window, no separate hits table
  window_count int not null default 0
);
alter table public.capture_tokens enable row level security;  -- no policies: nobody reads it via PostgREST
```
No RLS policies on purpose; only security-definer functions touch it. `leads.external_ref` is covered by the existing `leads` policies.

**`public.mint_capture_token(p_tenant_id uuid, p_label text) returns text`**
security definer, `search_path = ''`, granted to `authenticated`, checks `private.is_tenant_owner`. Same shape as `mint_webhook_secret`: 32 random bytes, base64url, store `digest(token, 'sha256')`, return the raw token once. Called from the SQL editor for now; the settings screen comes later.

**`public.capture_lead(p_token text, p_payload jsonb) returns jsonb`**
security definer, `search_path = ''`, `revoke execute ... from public, anon, authenticated`. Only the secret-key client can call it. One function, one transaction:
1. `select ... from capture_tokens where token_hash = digest(p_token,'sha256') and revoked_at is null for update` → none: `raise ... errcode 'P0001'` with message `unauthorized`.
2. Rate limit on the locked row: if `window_start < now() - interval '1 minute'` reset; if `window_count >= 60` raise `rate_limited`; else increment.
3. Validate (`name` non-empty after trim, lengths per the table, `source` castable to `lead_source`, `occurred_at` parseable). Raise `validation:<field>`.
4. `select id from leads where tenant_id = v_tenant and external_ref = v_ref` → return `{lead_id, created:false}`.
5. Stage: first `pipeline_stages` with `kind='open' and archived_at is null` by `position`. Owner: `memberships where role='owner' order by created_at limit 1`.
6. Insert lead (`created_by null`, `assigned_to` owner, `is_demo false`), insert the `note` activity with the body built here. On `unique_violation` (two retries racing) fall back to step 4.
7. Return `{lead_id, created:true}`.

Errors are a single-word prefix in `sqlerrm` so the function maps them without parsing.

### 3. Edge Function `client/supabase/functions/capture-lead/index.ts`
Same skeleton as `delete-account`: CORS map, `json()`, `Deno.serve`, admin client from `SUPABASE_SECRET_KEYS.default`.
- Bearer token from the header; missing → 401. Body must parse as an object → else 400 `{error:'validation',field:'body'}`.
- `admin.rpc('capture_lead', { p_token, p_payload: body })`.
- Map the error message prefix: `unauthorized` → 401, `rate_limited` → 429, `validation:<f>` → 400 with `field`, anything else → 500 `{error:'internal'}`.
- 201 when `created`, 200 otherwise.
- Log one line: tenant id (returned in the RPC result for logging only, stripped from the response), `external_ref`, status, ms. Never the body.

### 4. Deploy (first ever function deploy on this project)
```bash
supabase functions deploy capture-lead --no-verify-jwt
```
Then mint the Netlush token in the SQL editor, hand it over out of band, run the handoff curl twice (expect 201 then 200 with the same id), delete the smoke lead.

### 5. Docs
- ARCHITECTURE §6: `capture-form` → built as `capture-lead`, generic, token-authenticated.
- GAPS: G-39 closed; G-14 gets a note that the deploy path now exists.
- SCREENS 8.2: reference the endpoint. PRODUCT.md untouched (the form itself did not ship).

### 6. Check left behind
One SQL file under `client/supabase/snippets/` that mints a throwaway token on a test tenant, calls `capture_lead` twice with the same `external_ref`, asserts one lead and one activity, then rolls back.

## Added the same day: update mode + day-sheet surfacing

Migration `20260918110000_capture_lead_update_mode.sql`. A payload without `source` updates
the lead with that `external_ref` (contact fields, `estimated_value`, `answers`, `append_note`),
404 when unknown. Both modes end by opening a follow-up due now (`private.capture_surface_lead`),
because the client folds every activity into `lastTouchAt` — a bot note alone would make the lead
look freshly handled and *remove* it from the drift flags — and an open reminder due today is the
one signal the day sheet ranks first. Also fixed on the way: `<select [value]>` in four templates
showed the first option regardless of the model, so every lead's source read "אתר".

## Skipped
- Separate rate-limit / audit table: two columns on the token row cover 60/min. Add when a token needs per-minute history.
- Settings screen for tokens: SQL snippet for now, screen when a second tenant needs one.
