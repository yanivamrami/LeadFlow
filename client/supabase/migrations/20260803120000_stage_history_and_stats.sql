-- Analytics: model the stage history, then aggregate it server-side.
--
-- Stage changes were already recorded, but only as display text in
-- `activities.body` ('new -> contacted'). That is recoverable and useless: a chart
-- built on splitting a human-readable string breaks silently the first time the copy
-- changes, and nothing fails loudly when it does. These become typed columns, the
-- trigger writes them going forward, and the parse happens exactly once — here.

-- ---------------------------------------------------------------- history

alter table public.activities
  add column if not exists from_status public.lead_status,
  add column if not exists to_status   public.lead_status;

comment on column public.activities.from_status is
  'Stage the lead left. Set only on type = status_changed, by the trigger.';
comment on column public.activities.to_status is
  'Stage the lead entered. Set only on type = status_changed, by the trigger.';

-- One-time backfill of rows written before the columns existed. Guarded on the
-- separator so a body in any other shape is skipped rather than mangled.
update public.activities
   set from_status = split_part(body, ' -> ', 1)::public.lead_status,
       to_status   = split_part(body, ' -> ', 2)::public.lead_status
 where type = 'status_changed'
   and to_status is null
   and body like '% -> %'
   and split_part(body, ' -> ', 1) = any (enum_range(null::public.lead_status)::text[])
   and split_part(body, ' -> ', 2) = any (enum_range(null::public.lead_status)::text[]);

-- The aggregate asks "which leads ever entered this stage", per tenant.
create index if not exists activities_tenant_to_status_idx
  on public.activities (tenant_id, to_status)
  where type = 'status_changed';

-- Trigger now writes the typed columns. `body` stays for the timeline, which shows
-- it to a person; the columns are what the analytics read.
create or replace function public.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.activities (
      lead_id, tenant_id, created_by, type, body, from_status, to_status
    )
    values (
      new.id,
      new.tenant_id,
      (select auth.uid()),
      'status_changed',
      old.status::text || ' -> ' || new.status::text,
      old.status,
      new.status
    );
  end if;
  return new;
end;
$$;

-- create or replace preserves the ACL, but state it rather than rely on it: this is a
-- trigger function and nothing should be able to call it directly.
revoke execute on function public.log_lead_status_change() from public, anon, authenticated;

-- ---------------------------------------------------------------- stats

-- One round trip for the whole insights screen. `security invoker`, so every count
-- below is already filtered by the same RLS policies a direct select would hit —
-- a caller who is not a member of the tenant gets zeroes, not another tenant's numbers.
--
-- Aggregating here rather than summing rows in the browser is correct at 15 leads and
-- still correct at 5,000.
create or replace function public.lead_stats(p_tenant_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with mine as (
    select * from public.leads where tenant_id = p_tenant_id
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
