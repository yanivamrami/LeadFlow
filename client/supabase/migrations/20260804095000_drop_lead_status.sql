-- Retire public.lead_status.
--
-- **The only irreversible step in Phase 1**, kept in its own migration and numbered last so it
-- applies after every function and every client path has been verified against stage_id. Once
-- this runs, the old columns are recoverable only from a backup.
--
-- The type refuses to drop while any dependent remains, and that refusal is the check that the
-- earlier migrations were complete: if a function still declares a `public.lead_status`
-- parameter, or a column still uses it, this file fails and nothing is lost.

-- ---------------------------------------------------------------------------
-- 1. Gate
-- ---------------------------------------------------------------------------
-- Re-assert the invariant here as well as in 20260804090000. That migration verified it at
-- backfill time; this one verifies it at drop time, which is when it matters — rows written
-- between the two migrations went through triggers and RPCs that this branch also changed.

do $$
declare
  v_null_stage bigint;
  v_mismatch   bigint;
begin
  select count(*) into v_null_stage from public.leads where stage_id is null;
  if v_null_stage > 0 then
    raise exception 'refusing to drop lead_status: % lead(s) have no stage_id', v_null_stage;
  end if;

  -- Every lead's stage must belong to the lead's own tenant. The composite FK already
  -- guarantees this; assert it anyway, because this is the last moment the old column is
  -- around to cross-check against and a silent mismatch here would be invisible afterwards.
  select count(*) into v_mismatch
    from public.leads l
    join public.pipeline_stages s on s.id = l.stage_id
   where s.tenant_id <> l.tenant_id;
  if v_mismatch > 0 then
    raise exception 'refusing to drop lead_status: % lead(s) point at another tenant''s stage',
      v_mismatch;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Drop
-- ---------------------------------------------------------------------------

alter table public.activities
  drop column from_status,
  drop column to_status;

alter table public.leads
  drop column status;

drop type public.lead_status;
