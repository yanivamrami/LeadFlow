-- lead_stats was still counting the demo lead.
--
-- The signup trigger seeds one is_demo = true sample lead per new tenant so the board is
-- never empty on day one. PRODUCT.md and docs/ARCHITECTURE.md both say analytics exclude
-- it; `mine` never filtered on is_demo, so on a fresh account with one real lead, totals,
-- open/won value, every `reached` bar and the sample's own `source` row were all one lead
-- too high. The dashboard is deliberately left alone — it is the never-empty first screen
-- and is visibly labelled as demo — this fix is scoped to the stats RPC only.
--
-- `reached` and `sources` both derive from `mine` (the latter groups over it directly; the
-- former's history half joins `public.activities a` on `a.lead_id = l.id` where `l` comes
-- from `mine`), so filtering `mine` once here is enough — the exclusion propagates to every
-- aggregate in the function without touching the rest of the body.
create or replace function public.lead_stats(p_tenant_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with mine as (
    select * from public.leads where tenant_id = p_tenant_id and is_demo = false
  ),
  reached as (
    -- a lead "reached" a stage if it is there now, or history says it entered it.
    -- 'new' is every lead: creation writes no history row.
    select s.status,
           case
             when s.status = 'new' then (select count(*) from mine)
             else (
               select count(distinct l.id)
                 from mine l
                where l.status = s.status
                   or exists (
                        select 1
                          from public.activities a
                         where a.lead_id = l.id
                           and a.type = 'status_changed'
                           and a.to_status = s.status
                      )
             )
           end as leads
      from unnest(enum_range(null::public.lead_status)) as s(status)
  )
  select jsonb_build_object(
    'total',        (select count(*) from mine),
    'won',          (select count(*) from mine where status = 'won'),
    'lost',         (select count(*) from mine where status = 'lost'),
    'decided',      (select count(*) from mine where status in ('won', 'lost')),
    'open',         (select count(*) from mine where status not in ('won', 'lost')),
    -- value still in play, and value actually closed. Never added together.
    'open_value',   (select coalesce(sum(estimated_value), 0) from mine
                      where status not in ('won', 'lost')),
    'won_value',    (select coalesce(sum(estimated_value), 0) from mine where status = 'won'),
    'by_status',    (select jsonb_object_agg(status, cnt)
                       from (select status::text as status, count(*) as cnt
                               from mine group by status) s),
    'reached',      (select jsonb_object_agg(status::text, leads) from reached),
    'sources',      (select coalesce(jsonb_agg(row), '[]'::jsonb) from (
                       select jsonb_build_object(
                                'source', source::text,
                                'total',  count(*),
                                'won',    count(*) filter (where status = 'won'),
                                'lost',   count(*) filter (where status = 'lost')
                              ) as row
                         from mine
                        group by source
                        order by count(*) filter (where status = 'won') desc, count(*) desc
                     ) s)
  );
$$;

revoke execute on function public.lead_stats(uuid) from public, anon;
grant  execute on function public.lead_stats(uuid) to authenticated;
