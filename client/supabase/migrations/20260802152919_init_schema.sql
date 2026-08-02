-- LeadFlow Manager — initial schema
-- Source of truth: docs/ARCHITECTURE.md §5 (data architecture, multi-tenancy, RLS posture)
--
-- Access control is 100% RLS on tenant_id. The publishable key ships to the browser,
-- so every table in an exposed schema must have RLS enabled and policies that match
-- the real access model. Helper functions live in the unexposed `private` schema.

-- ---------------------------------------------------------------------------
-- 0. Schemas
-- ---------------------------------------------------------------------------

create schema if not exists private;

-- `private` is not in PostgREST's exposed schema list, so nothing here is reachable
-- through the Data API. USAGE is still needed for policies to call these helpers.
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'member');

create type public.lead_status as enum (
  'new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'
);

create type public.lead_source as enum (
  'website', 'referral', 'social_media', 'phone', 'other'
);

create type public.activity_type as enum (
  'call', 'email', 'meeting', 'note', 'status_changed'
);

-- Fixed 5-item V1 checklist, in product order (not classic BANT order).
create type public.checklist_item as enum (
  'interest', 'need', 'budget', 'authority', 'timeline'
);

-- Tri-state: "no" and "haven't asked" are different signals.
create type public.qualification_answer as enum ('yes', 'no', 'unknown');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.memberships (
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  created_by      uuid references public.profiles (id) on delete set null,
  assigned_to     uuid references public.profiles (id) on delete set null,
  name            text not null,
  email           text,
  phone           text,
  company         text,
  source          public.lead_source not null default 'other',
  status          public.lead_status not null default 'new',
  estimated_value numeric(12, 2),
  lost_reason     text,
  is_demo         boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Target for the composite FKs below: child rows cannot claim a tenant_id
  -- that differs from their lead's, even if a client forges the column.
  constraint leads_id_tenant_key unique (id, tenant_id)
);

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  type        public.activity_type not null,
  body        text,
  occurred_at timestamptz not null default now(),

  constraint activities_lead_fkey
    foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete cascade
);

create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  title       text not null,
  due_at      timestamptz not null,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),

  constraint reminders_lead_fkey
    foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete cascade
);

create table public.qualification_answers (
  lead_id     uuid not null,
  item        public.checklist_item not null,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  answer      public.qualification_answer not null,
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz not null default now(),

  primary key (lead_id, item),
  constraint qualification_answers_lead_fkey
    foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Tenant-scoped access paths (also the columns every RLS policy reads).
create index memberships_user_id_idx on public.memberships (user_id);

create index leads_tenant_status_idx      on public.leads (tenant_id, status);
create index leads_tenant_created_at_idx  on public.leads (tenant_id, created_at desc);
create index leads_tenant_assigned_to_idx on public.leads (tenant_id, assigned_to);

create index activities_lead_occurred_at_idx on public.activities (lead_id, occurred_at desc);
create index activities_tenant_id_idx        on public.activities (tenant_id);

create index reminders_tenant_due_at_idx on public.reminders (tenant_id, due_at)
  where done_at is null;

create index qualification_answers_tenant_id_idx on public.qualification_answers (tenant_id);

-- ---------------------------------------------------------------------------
-- 4. RLS helper functions
-- ---------------------------------------------------------------------------
-- security definer so policies never re-enter RLS on `memberships` (recursive
-- policy trap). Each function answers only a question about the *calling* user,
-- so it cannot leak another tenant's data.

create function private.is_tenant_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = t
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_tenant_owner(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = t
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- Do two users share at least one tenant? Used so teammates can read each
-- other's display names for assignment UI.
create function private.shares_tenant_with(u uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = u
  );
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function. Take it back.
revoke execute on function private.is_tenant_member(uuid)   from public;
revoke execute on function private.is_tenant_owner(uuid)    from public;
revoke execute on function private.shares_tenant_with(uuid) from public;

grant execute on function private.is_tenant_member(uuid)   to authenticated;
grant execute on function private.is_tenant_owner(uuid)    to authenticated;
grant execute on function private.shares_tenant_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.tenants               enable row level security;
alter table public.profiles              enable row level security;
alter table public.memberships           enable row level security;
alter table public.leads                 enable row level security;
alter table public.activities            enable row level security;
alter table public.reminders             enable row level security;
alter table public.qualification_answers enable row level security;

-- --- tenants ---------------------------------------------------------------
-- No INSERT policy: tenants are created only by the signup trigger (security
-- definer). Self-serve tenant creation is not a v1 capability.

create policy tenants_select on public.tenants
  for select to authenticated
  using ( (select private.is_tenant_member(id)) );

create policy tenants_update on public.tenants
  for update to authenticated
  using      ( (select private.is_tenant_owner(id)) )
  with check ( (select private.is_tenant_owner(id)) );

create policy tenants_delete on public.tenants
  for delete to authenticated
  using ( (select private.is_tenant_owner(id)) );

-- --- profiles --------------------------------------------------------------
-- Row is created by the signup trigger; no INSERT policy. No DELETE policy —
-- profiles disappear when the auth user does, via cascade.

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.shares_tenant_with(id))
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using      ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

-- --- memberships -----------------------------------------------------------

create policy memberships_select on public.memberships
  for select to authenticated
  using ( (select private.is_tenant_member(tenant_id)) );

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check ( (select private.is_tenant_owner(tenant_id)) );

create policy memberships_update on public.memberships
  for update to authenticated
  using      ( (select private.is_tenant_owner(tenant_id)) )
  with check ( (select private.is_tenant_owner(tenant_id)) );

create policy memberships_delete on public.memberships
  for delete to authenticated
  using ( (select private.is_tenant_owner(tenant_id)) );

-- --- business tables -------------------------------------------------------
-- Same shape for all four: membership in the row's tenant, checked on both
-- read (USING) and write (WITH CHECK). WITH CHECK is what stops a member from
-- moving a row into a tenant they don't belong to.

create policy leads_select on public.leads
  for select to authenticated using ( (select private.is_tenant_member(tenant_id)) );
create policy leads_insert on public.leads
  for insert to authenticated with check ( (select private.is_tenant_member(tenant_id)) );
create policy leads_update on public.leads
  for update to authenticated
  using      ( (select private.is_tenant_member(tenant_id)) )
  with check ( (select private.is_tenant_member(tenant_id)) );
create policy leads_delete on public.leads
  for delete to authenticated using ( (select private.is_tenant_member(tenant_id)) );

create policy activities_select on public.activities
  for select to authenticated using ( (select private.is_tenant_member(tenant_id)) );
create policy activities_insert on public.activities
  for insert to authenticated with check ( (select private.is_tenant_member(tenant_id)) );
create policy activities_update on public.activities
  for update to authenticated
  using      ( (select private.is_tenant_member(tenant_id)) )
  with check ( (select private.is_tenant_member(tenant_id)) );
create policy activities_delete on public.activities
  for delete to authenticated using ( (select private.is_tenant_member(tenant_id)) );

create policy reminders_select on public.reminders
  for select to authenticated using ( (select private.is_tenant_member(tenant_id)) );
create policy reminders_insert on public.reminders
  for insert to authenticated with check ( (select private.is_tenant_member(tenant_id)) );
create policy reminders_update on public.reminders
  for update to authenticated
  using      ( (select private.is_tenant_member(tenant_id)) )
  with check ( (select private.is_tenant_member(tenant_id)) );
create policy reminders_delete on public.reminders
  for delete to authenticated using ( (select private.is_tenant_member(tenant_id)) );

create policy qualification_answers_select on public.qualification_answers
  for select to authenticated using ( (select private.is_tenant_member(tenant_id)) );
create policy qualification_answers_insert on public.qualification_answers
  for insert to authenticated with check ( (select private.is_tenant_member(tenant_id)) );
create policy qualification_answers_update on public.qualification_answers
  for update to authenticated
  using      ( (select private.is_tenant_member(tenant_id)) )
  with check ( (select private.is_tenant_member(tenant_id)) );
create policy qualification_answers_delete on public.qualification_answers
  for delete to authenticated using ( (select private.is_tenant_member(tenant_id)) );

-- ---------------------------------------------------------------------------
-- 6. Data API grants
-- ---------------------------------------------------------------------------
-- RLS decides which rows are visible; these grants decide whether the table is
-- reachable at all. Depending on the project's Data API settings, tables created
-- by SQL are not exposed automatically. `anon` gets nothing — the app is
-- authenticated-only.

grant select, insert, update, delete on public.tenants               to authenticated;
grant select, insert, update, delete on public.profiles              to authenticated;
grant select, insert, update, delete on public.memberships           to authenticated;
grant select, insert, update, delete on public.leads                 to authenticated;
grant select, insert, update, delete on public.activities            to authenticated;
grant select, insert, update, delete on public.reminders             to authenticated;
grant select, insert, update, delete on public.qualification_answers to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Triggers
-- ---------------------------------------------------------------------------

-- 7a. updated_at maintenance (security invoker — no privileges needed).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- 7b. Append a status_changed activity on every stage move (ARCHITECTURE §3,
-- journey 2 step 3). security definer so the audit row cannot be suppressed;
-- it only writes derived data and reads nothing the caller couldn't already see.
create function public.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.activities (lead_id, tenant_id, created_by, type, body)
    values (
      new.id,
      new.tenant_id,
      (select auth.uid()),
      'status_changed',
      old.status::text || ' -> ' || new.status::text
    );
  end if;
  return new;
end;
$$;

create trigger leads_log_status_change
  after update of status on public.leads
  for each row execute function public.log_lead_status_change();

-- 7c. Signup: personal tenant + owner membership + profile + one Hebrew demo
-- lead, so the board is never empty on arrival (ARCHITECTURE §5, PRODUCT.md
-- "First run"). If this function raises, signup fails — change it carefully.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_tenant_id    uuid;
  v_lead_id      uuid;
begin
  v_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    pg_catalog.split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name);

  insert into public.tenants (name)
  values (v_display_name)
  returning id into v_tenant_id;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant_id, new.id, 'owner');

  insert into public.leads (
    tenant_id, created_by, assigned_to,
    name, email, phone, company,
    source, status, estimated_value, is_demo, sort_order
  )
  values (
    v_tenant_id, new.id, new.id,
    'דנה כהן', 'dana@example.co.il', '050-0000000', 'סטודיו דנה עיצוב',
    'referral', 'new', 4500, true, 0
  )
  returning id into v_lead_id;

  insert into public.activities (lead_id, tenant_id, created_by, type, body)
  values (
    v_lead_id, v_tenant_id, new.id, 'note',
    'ליד לדוגמה. אפשר למחוק אותו בכל רגע.'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7d. A tenant with no members left is dead weight and holds personal data
-- (compliance posture, ARCHITECTURE §9). Drop it when its last membership goes.
create function public.delete_orphan_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tenants t
  where t.id = old.tenant_id
    and not exists (
      select 1 from public.memberships m where m.tenant_id = t.id
    );
  return old;
end;
$$;

create trigger memberships_delete_orphan_tenant
  after delete on public.memberships
  for each row execute function public.delete_orphan_tenant();

-- ---------------------------------------------------------------------------
-- 8. Realtime
-- ---------------------------------------------------------------------------
-- Postgres Changes on leads, filtered client-side by active tenant_id and
-- enforced by RLS (ARCHITECTURE §6).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
end;
$$;
