-- Explicit table grants for every table created after the init migration.
--
-- 20260802152919 §6 grants the seven original tables to `authenticated` by hand and says why.
-- 20260804091000 does the same for automations and automation_runs. pipeline_stages,
-- lead_files and capture_tokens never got such a line. On the cloud project they still worked because the
-- dashboard's SQL role carries `alter default privileges` that hand every new table to
-- authenticated/anon implicitly. The local Docker stack runs migrations under a role without
-- those defaults, so the same tables came up with no grants and the board answered 403.
--
-- Surfaced 2026-09-18 by the first `supabase db reset`. Idempotent on the cloud except the
-- last block, which removes an implicit grant the capture_tokens migration never wanted.
-- RLS policies remain the authorization boundary on every one of these.

grant select, insert, update, delete on public.pipeline_stages to authenticated;
grant select, insert, update, delete on public.lead_files      to authenticated;

-- Nobody reads capture tokens through PostgREST; only the two security-definer functions do.
revoke all on public.capture_tokens from anon, authenticated;
