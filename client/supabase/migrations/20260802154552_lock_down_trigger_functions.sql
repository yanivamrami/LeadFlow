-- Close the RPC surface on trigger functions.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and `public` is an
-- exposed schema, so the trigger functions from 20260802152919_init_schema were
-- reachable as `/rest/v1/rpc/<name>` for both `anon` and `authenticated`
-- (advisors: 0028 / 0029). Nothing should call these except the triggers.
--
-- Safe to revoke: Postgres checks EXECUTE on a trigger function at CREATE
-- TRIGGER time, not each time the trigger fires, so the existing triggers keep
-- working with no privileges granted to anyone.

revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.log_lead_status_change()  from public, anon, authenticated;
revoke execute on function public.delete_orphan_tenant()    from public, anon, authenticated;
revoke execute on function public.set_updated_at()          from public, anon, authenticated;
