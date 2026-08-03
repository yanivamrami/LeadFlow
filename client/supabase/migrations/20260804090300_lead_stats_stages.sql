-- lead_stats, rewritten against the pipeline as user-defined rows instead of the fixed enum.
--
-- The load-bearing decision from 20260804090000 carries over unchanged: every stage has a
-- `kind` of open/won/lost, and every number below hangs off `kind`, never off a name or a
-- position. That is what lets a user rename נסגר בהצלחה to לקוח, or reorder the whole board,
-- without a single figure on this screen moving.
--
-- Four places used to be stage-literal. All four are generalised here:
--   1. The funnel iterated `enum_range(lead_status)`. It now joins `pipeline_stages` for the
--      tenant, and excludes archived stages — an archived stage keeps its history (nothing
--      reads to_stage_id differently once archived) but must not draw a live bar.
--   2. "'new' is every lead" (creation writes no history row) is no longer the literal first
--      enum value. It is the stage with the lowest `position` among `kind = 'open'`, resolved
--      per tenant, because a user can reorder the pipeline and position 0 is not guaranteed to
--      still be the entry stage.
--   3. `status in ('won','lost')` and the single-status filters become joins on `kind`.
--   4. `a.to_status = s.status` becomes `a.to_stage_id = s.id`.
--
-- `security invoker`, unchanged: every count below is already filtered by the same RLS
-- policies a direct select would hit, so a caller who is not a member of the tenant gets
-- zeroes, not another tenant's numbers.
--
-- Output keys are unchanged on purpose — total, won, lost, decided, open, open_value,
-- won_value, by_status, reached, sources — so the client's LeadStats interface does not
-- churn. `by_status` and `reached` are keyed by stage id (uuid as text) now instead of an
-- enum name; the client resolves ids through StagesStore.
create or replace function public.lead_stats(p_tenant_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with mine as (
    -- is_demo = false is the sole demo-lead exclusion (20260803150000). `reached`, `sources`,
    -- `by_status` and every aggregate below (won/lost/decided/open/*_value) all derive from
    -- `mine` — reached's history half joins `public.activities a` on `a.lead_id = l.id` where
    -- `l` comes from `mine`, sources groups over `mine` directly — so filtering `mine` once
    -- here is enough. The exclusion propagates to every aggregate without touching the rest
    -- of the body. Dropping this would re-break GAPS G-18.
    --
    -- Joined to pipeline_stages here, once, so every aggregate below reads `stage_kind`
    -- instead of repeating the join per figure.
    select l.*, s.kind as stage_kind
      from public.leads l
      join public.pipeline_stages s on s.id = l.stage_id
     where l.tenant_id = p_tenant_id and l.is_demo = false
  ),
  first_open as (
    -- The stage a lead starts in. Lead creation writes no activities row, so there is no
    -- history to join against for this one stage — every lead in `mine` counts as having
    -- reached it. Not position = 0: a user can reorder the pipeline, so this is resolved as
    -- the lowest-position stage of kind 'open', per tenant.
    select id
      from public.pipeline_stages
     where tenant_id = p_tenant_id and kind = 'open' and archived_at is null
     order by position
     limit 1
  ),
  reached as (
    -- A lead "reached" a stage if it is there now, or history says it entered it. Archived
    -- stages are excluded from this funnel entirely — the join below only ever considers
    -- live stages, so an archived stage's history stays in `activities` but draws no bar.
    select s.id as stage_id,
           case
             when s.id = (select id from first_open) then (select count(*) from mine)
             else (
               select count(distinct l.id)
                 from mine l
                where l.stage_id = s.id
                   or exists (
                        select 1
                          from public.activities a
                         where a.lead_id = l.id
                           and a.type = 'status_changed'
                           and a.to_stage_id = s.id
                      )
             )
           end as leads
      from public.pipeline_stages s
     where s.tenant_id = p_tenant_id and s.archived_at is null
  )
  select jsonb_build_object(
    'total',        (select count(*) from mine),
    'won',          (select count(*) from mine where stage_kind = 'won'),
    'lost',         (select count(*) from mine where stage_kind = 'lost'),
    'decided',      (select count(*) from mine where stage_kind in ('won', 'lost')),
    'open',         (select count(*) from mine where stage_kind = 'open'),
    -- value still in play, and value actually closed. Never added together.
    'open_value',   (select coalesce(sum(estimated_value), 0) from mine where stage_kind = 'open'),
    'won_value',    (select coalesce(sum(estimated_value), 0) from mine where stage_kind = 'won'),
    'by_status',    (select jsonb_object_agg(stage_id, cnt)
                       from (select stage_id::text as stage_id, count(*) as cnt
                               from mine group by stage_id) s),
    'reached',      (select jsonb_object_agg(stage_id::text, leads) from reached),
    'sources',      (select coalesce(jsonb_agg(row), '[]'::jsonb) from (
                       select jsonb_build_object(
                                'source', source::text,
                                'total',  count(*),
                                'won',    count(*) filter (where stage_kind = 'won'),
                                'lost',   count(*) filter (where stage_kind = 'lost')
                              ) as row
                         from mine
                        group by source
                        order by count(*) filter (where stage_kind = 'won') desc, count(*) desc
                     ) s)
  );
$$;

revoke execute on function public.lead_stats(uuid) from public, anon;
grant  execute on function public.lead_stats(uuid) to authenticated;
