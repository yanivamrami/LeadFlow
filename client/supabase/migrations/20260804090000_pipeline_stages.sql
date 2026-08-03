-- Pipeline stages become per-tenant rows the user owns.
--
-- The six stages were a Postgres enum (init_schema:24) referenced by leads.status,
-- activities.from_status/to_status, five functions and 73 places in the client. Users need to
-- rename, reorder, add and archive them, so the enum has to become a table.
--
-- The load-bearing decision, argued in documents/PLAN-stages.md §1: every row carries a `kind`
-- of open/won/lost, and **all product semantics hang off the kind, never off the name**. That is
-- what lets someone rename נסגר בהצלחה to לקוח without silently breaking conversion, the
-- lost-reason requirement, the won-amount confirmation, the attention engine or the funnel. A
-- rename must change no arithmetic at all.
--
-- This file is the reversible half: it adds everything and backfills. It deliberately leaves
-- leads.status in place. Dropping the old columns and the enum is a separate, last migration
-- (20260804099000) so this one can be applied and verified without an irreversible step in it.

-- ---------------------------------------------------------------------------
-- 1. Kind
-- ---------------------------------------------------------------------------

create type public.stage_kind as enum ('open', 'won', 'lost');

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------

create table public.pipeline_stages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  name          text not null,
  -- Board headers and filter chips, where the column is already context. Null falls back
  -- to `name` in the client rather than rendering an empty header.
  short_name    text,
  position      integer not null,
  kind          public.stage_kind not null default 'open',
  -- One of a fixed set of eight pre-contrast-checked pairs, never a free colour: the
  -- שלט־שוק palette is deliberately tight and an arbitrary picker would wreck it while
  -- quietly reintroducing the contrast failures the design system already paid for.
  swatch        text not null default 'slate',
  -- The teaching layer, moved out of core/copy.ts. `meaning` says where you are;
  -- `guidance` says what to do next. A beginner needs both — that is the product's whole
  -- positioning — so a user-created stage is offered a template that arrives with copy.
  meaning       text,
  guidance      text,
  -- Days of silence before the lead is considered drifting. Null = never drifts, which
  -- replaces the Number.POSITIVE_INFINITY that DRIFT_DAYS used for won/lost.
  drift_days    integer,
  -- "The ball is in their court." Generalises what used to be hardcoded as
  -- status = 'proposal_sent' in openReason(), so a user's own ממתין לחתימה stage behaves
  -- like the built-in proposal stage without anybody writing code.
  expects_reply boolean not null default false,
  -- Seeded by signup. Blocks nothing except deletion of the won/lost pair; a system stage
  -- is fully renamable, because the words belong to the user.
  is_system     boolean not null default false,
  -- Archive, never delete. activities.to_stage_id is the funnel's only memory of where
  -- leads have been, so a hard delete would either orphan history or cascade it away.
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),

  -- Target for the composite FKs on leads and activities: a child row cannot claim a
  -- tenant_id that differs from its stage's, even if a client forges the column. Same
  -- pattern as leads_id_tenant_key (init_schema:88).
  constraint pipeline_stages_id_tenant_key unique (id, tenant_id),

  constraint pipeline_stages_name_not_blank check (btrim(name) <> ''),
  constraint pipeline_stages_drift_days_ck check (drift_days is null or drift_days > 0)
);

-- ---------------------------------------------------------------------------
-- 3. Indexes, and the invariants worth having the database enforce
-- ---------------------------------------------------------------------------

create index pipeline_stages_tenant_id_idx on public.pipeline_stages (tenant_id);

-- Position is unique among live stages. A reorder that half-applies would otherwise leave
-- two stages claiming position 3 and a board whose column order depends on the planner.
create unique index pipeline_stages_tenant_position_idx
  on public.pipeline_stages (tenant_id, position)
  where archived_at is null;

-- Exactly one won and one lost stage per tenant. Zero breaks conversion; two makes
-- "decided" ambiguous and every figure on /insights a guess. Enforced rather than assumed,
-- because this is the invariant the whole `kind` decision rests on.
create unique index pipeline_stages_one_won_idx
  on public.pipeline_stages (tenant_id)
  where kind = 'won' and archived_at is null;

create unique index pipeline_stages_one_lost_idx
  on public.pipeline_stages (tenant_id)
  where kind = 'lost' and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3b. The invariants a unique index cannot express
-- ---------------------------------------------------------------------------
-- The partial indexes above enforce *at most* one live won and one live lost stage. The
-- product needs *exactly* one of each, plus at least one live open stage, and those are
-- cross-row assertions no column constraint can make.
--
-- Why they matter, concretely: archive the won stage and `lead_stats` reports a conversion
-- rate with no numerator and the lead sheet loses its won-amount block; archive every open
-- stage and a new lead has nowhere to be created. The client refuses all three in
-- `archiveCheck` (core/stages.rules.ts), but a rule that lives only in the client is a rule
-- one PostgREST call can walk around.
--
-- DEFERRABLE INITIALLY DEFERRED because the checks are only meaningful at commit: seeding
-- six stages, or reordering the board, passes through intermediate states that are
-- individually invalid and collectively fine.

create function private.assert_pipeline_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_open   bigint;
  v_won    bigint;
  v_lost   bigint;
begin
  -- A cascading tenant delete removes its stages too, and must not be blocked by an
  -- invariant about a tenant that no longer exists.
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return null;
  end if;

  select count(*) filter (where kind = 'open'),
         count(*) filter (where kind = 'won'),
         count(*) filter (where kind = 'lost')
    into v_open, v_won, v_lost
    from public.pipeline_stages
   where tenant_id = v_tenant and archived_at is null;

  if v_open < 1 then
    raise exception 'a pipeline needs at least one open stage — a lead would have nowhere to go';
  end if;
  if v_won <> 1 then
    raise exception 'a pipeline needs exactly one live won stage, found %', v_won;
  end if;
  if v_lost <> 1 then
    raise exception 'a pipeline needs exactly one live lost stage, found %', v_lost;
  end if;

  return null;
end;
$$;

revoke execute on function private.assert_pipeline_shape() from public, anon, authenticated;

create constraint trigger pipeline_stages_shape
  after insert or update or delete on public.pipeline_stages
  deferrable initially deferred
  for each row execute function private.assert_pipeline_shape();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
-- Read for members; write for **owners only**. This deviates from the other business
-- tables on purpose: renaming the won stage or reordering the pipeline changes every
-- number the owner sees, so it is not a member-level action.

alter table public.pipeline_stages enable row level security;

create policy pipeline_stages_select on public.pipeline_stages
  for select to authenticated
  using ( (select private.is_tenant_member(tenant_id)) );

create policy pipeline_stages_insert on public.pipeline_stages
  for insert to authenticated
  with check ( (select private.is_tenant_owner(tenant_id)) );

create policy pipeline_stages_update on public.pipeline_stages
  for update to authenticated
  using      ( (select private.is_tenant_owner(tenant_id)) )
  with check ( (select private.is_tenant_owner(tenant_id)) );

-- Delete is permitted by policy but blocked in practice by the `on delete restrict` FKs
-- below the moment a stage has ever held a lead. The product's path is archive.
create policy pipeline_stages_delete on public.pipeline_stages
  for delete to authenticated
  using ( (select private.is_tenant_owner(tenant_id)) );

-- ---------------------------------------------------------------------------
-- 5. Seed the six system stages for every existing tenant
-- ---------------------------------------------------------------------------
-- Names, meanings and guidance are lifted verbatim out of core/copy.ts (STATUS_LABEL,
-- STATUS_SHORT, STATUS_MEANING, STATUS_GUIDANCE) and drift days out of lead.model.ts
-- (DRIFT_DAYS). This is a move, not a rewrite: the copy already exists and was written for
-- a beginner, so re-authoring it here would only lose it.

insert into public.pipeline_stages (
  tenant_id, name, short_name, position, kind, swatch,
  meaning, guidance, drift_days, expects_reply, is_system
)
select t.id, s.name, s.short_name, s.position, s.kind, s.swatch,
       s.meaning, s.guidance, s.drift_days, s.expects_reply, true
  from public.tenants t
  cross join (
    values
      ('ליד חדש',      'חדש',   0, 'open'::public.stage_kind, 'chalk',
       'מישהו גילה עניין, ואתם עוד לא דיברתם איתו.',
       'ליד חדש — הזמן להכשיר! צרו קשר וברַרו אם יש כאן עניין אמיתי.', 3, false),
      ('יצרנו קשר',    'קשר',   1, 'open'::public.stage_kind, 'sky',
       'דיברתם איתם לפחות פעם אחת, אבל עוד לא ברור אם יצא מזה משהו.',
       'דיברתם. עכשיו כדאי לבדוק אם הם באמת צריכים את מה שאתם מציעים.', 7, false),
      ('כשיר',         'כשיר',  2, 'open'::public.stage_kind, 'moss',
       'בדקתם והם באמת מתאימים — שווה להשקיע בהם זמן.',
       'הליד כשיר. השלב הבא הוא הצעה — כמה שיותר קרוב לשיחה, יותר טוב.', 7, false),
      ('נשלחה הצעה',   'הצעה',  3, 'open'::public.stage_kind, 'amber',
       'שלחתם מחיר או הצעה, ועכשיו הכתובת אצלם.',
       'הצעה נשלחה. אם לא חוזרים אליכם תוך 3 ימים — הרימו טלפון.', 3, true),
      ('נסגר בהצלחה',  'נסגר',  4, 'won'::public.stage_kind,  'clay',
       'הם אמרו כן. זה לקוח.',
       'נסגר בהצלחה. שווה לרשום מאיפה הליד הגיע, כדי לדעת מה עובד.', null, false),
      ('לא יצא לפועל', 'לא יצא', 5, 'lost'::public.stage_kind, 'slate',
       'זה לא קרה. רשמתם למה, וזה מה שיעזור לכם בפעם הבאה.',
       'לא יצא לפועל. רשמו את הסיבה — זה מה שיעזור לכם בפעם הבאה.', null, false)
  ) as s(name, short_name, position, kind, swatch, meaning, guidance, drift_days, expects_reply);

-- ---------------------------------------------------------------------------
-- 6. Backfill leads.stage_id
-- ---------------------------------------------------------------------------
-- Matched on position, not on name: position is the one thing the seed above guarantees and
-- a name could in principle have been edited between migrations.

alter table public.leads add column stage_id uuid;

update public.leads l
   set stage_id = s.id
  from public.pipeline_stages s
 where s.tenant_id = l.tenant_id
   and s.position = case l.status
                      when 'new'           then 0
                      when 'contacted'     then 1
                      when 'qualified'     then 2
                      when 'proposal_sent' then 3
                      when 'won'           then 4
                      when 'lost'          then 5
                    end;

-- The gate. If any lead failed to match, stop here with a readable error rather than
-- committing a pipeline where some leads have no stage — the client would render them
-- nowhere and the funnel would quietly undercount.
do $$
declare
  v_orphans bigint;
begin
  select count(*) into v_orphans from public.leads where stage_id is null;
  if v_orphans > 0 then
    raise exception
      'aborting: % lead(s) could not be matched to a pipeline stage', v_orphans;
  end if;
end;
$$;

alter table public.leads
  alter column stage_id set not null,
  add constraint leads_stage_fkey
    foreign key (stage_id, tenant_id)
    references public.pipeline_stages (id, tenant_id) on delete restrict;

-- `restrict` rather than `cascade` on purpose: an accidental stage delete must fail loudly
-- instead of taking leads with it.

drop index if exists public.leads_tenant_status_idx;
create index leads_tenant_stage_id_idx on public.leads (tenant_id, stage_id);

-- ---------------------------------------------------------------------------
-- 7. Backfill activities history
-- ---------------------------------------------------------------------------
-- from_status / to_status were themselves backfilled by 20260803120000 out of the body
-- text. Nullable stays nullable: rows written before that migration have no parsed stages
-- and inventing them would be fabricating history.

alter table public.activities
  add column from_stage_id uuid,
  add column to_stage_id   uuid;

update public.activities a
   set from_stage_id = s.id
  from public.pipeline_stages s
 where s.tenant_id = a.tenant_id
   and a.from_status is not null
   and s.position = case a.from_status
                      when 'new'           then 0
                      when 'contacted'     then 1
                      when 'qualified'     then 2
                      when 'proposal_sent' then 3
                      when 'won'           then 4
                      when 'lost'          then 5
                    end;

update public.activities a
   set to_stage_id = s.id
  from public.pipeline_stages s
 where s.tenant_id = a.tenant_id
   and a.to_status is not null
   and s.position = case a.to_status
                      when 'new'           then 0
                      when 'contacted'     then 1
                      when 'qualified'     then 2
                      when 'proposal_sent' then 3
                      when 'won'           then 4
                      when 'lost'          then 5
                    end;

alter table public.activities
  add constraint activities_from_stage_fkey
    foreign key (from_stage_id, tenant_id)
    references public.pipeline_stages (id, tenant_id) on delete restrict,
  add constraint activities_to_stage_fkey
    foreign key (to_stage_id, tenant_id)
    references public.pipeline_stages (id, tenant_id) on delete restrict;

-- The funnel's access path: "which leads ever entered this stage".
create index activities_to_stage_id_idx on public.activities (to_stage_id)
  where to_stage_id is not null;
