-- Reorder and archive as single transactions.
--
-- Written after review found both implemented as client-side sequences, which PLAN-stages §4.1
-- and §5 both say they must not be. Two concrete failure modes the sequences have:
--
--   * Reorder had to park every row at a negative position first to dodge the
--     (tenant_id, position) unique index, then write the final positions. A failure between
--     those two round trips leaves the whole pipeline sitting at negative positions — every
--     board column in a nonsense order, and no obvious way for the user to recover.
--   * Archive moved the stage's leads to a destination and then set archived_at. A failure
--     between them leaves the leads moved but the stage still live: the user asked for one
--     thing and got half of it, silently.
--
-- Both are the same argument that produced save_lead: when one user gesture spans more than one
-- table or row, the transaction boundary belongs in the database, not in a sequence of fetches.
--
-- `security invoker` throughout, so RLS still decides who may do this — pipeline_stages restricts
-- writes to tenant owners, and these functions inherit that. A member calling them gets the same
-- refusal a direct update would give them.

-- ---------------------------------------------------------------------------
-- 1. Reorder
-- ---------------------------------------------------------------------------
-- Takes the complete, ordered list of live stage ids. Positions are rewritten from the array
-- index, so the caller states the intended final order rather than a diff — a diff would need
-- the client and the database to agree about the current order, which is exactly what a
-- concurrent edit breaks.
--
-- The negative-parking trick stays, because the unique index is real and a single UPDATE cannot
-- be ordered. The difference is that it now happens inside one transaction, so no other reader
-- ever observes it and a failure rolls the whole thing back.

create function public.reorder_stages(p_tenant_id uuid, p_stage_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_live  bigint;
  v_given bigint := coalesce(array_length(p_stage_ids, 1), 0);
begin
  select count(*) into v_live
    from public.pipeline_stages
   where tenant_id = p_tenant_id and archived_at is null;

  -- Refuse a partial list. Accepting one would silently leave the omitted stages at whatever
  -- position they held, which is how you end up with two stages claiming position 3.
  if v_given <> v_live then
    raise exception 'reorder needs every live stage: got %, tenant has %', v_given, v_live;
  end if;

  -- Park out of the way of the unique index. Negative because position is otherwise
  -- non-negative, so these values cannot collide with a real one.
  update public.pipeline_stages
     set position = -1 - array_position(p_stage_ids, id)
   where tenant_id = p_tenant_id
     and archived_at is null
     and id = any (p_stage_ids);

  update public.pipeline_stages
     set position = array_position(p_stage_ids, id) - 1
   where tenant_id = p_tenant_id
     and archived_at is null
     and id = any (p_stage_ids);

  -- If a caller passed ids from another tenant, the first update touched nothing for them and
  -- the count check above would already have failed. Assert anyway: this is cheap and the
  -- alternative is a pipeline that looks reordered and is not.
  if exists (
    select 1 from public.pipeline_stages
     where tenant_id = p_tenant_id and archived_at is null and position < 0
  ) then
    raise exception 'reorder left a stage parked — aborting';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Archive, with a destination for whatever is standing in the stage
-- ---------------------------------------------------------------------------
-- The destination is required whenever the stage holds leads, and forbidden when it does not —
-- passing one for an empty stage means the caller believes something is there, and a caller
-- that wrong should hear about it rather than have the argument ignored.
--
-- The three refusals (won, lost, last open stage) are asserted here as well as in the client's
-- archiveCheck(). Not redundancy for its own sake: archiveCheck exists so the UI can explain
-- *why* before the user commits, and these exist because a rule enforced only in a client is
-- one PostgREST call away from not being enforced at all. The deferred pipeline_stages_shape
-- trigger would catch the won/lost/last-open cases at commit too, but its message is about the
-- shape of the result rather than the action attempted, and the user deserves the latter.

create function public.archive_stage(
  p_stage_id       uuid,
  p_destination_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_kind      public.stage_kind;
  v_leads     bigint;
  v_open_left bigint;
begin
  select tenant_id, kind into v_tenant_id, v_kind
    from public.pipeline_stages
   where id = p_stage_id and archived_at is null;

  if v_tenant_id is null then
    raise exception 'stage not found, or already archived';
  end if;

  if v_kind = 'won' then
    raise exception 'the won stage cannot be archived — every conversion figure is measured against it';
  end if;
  if v_kind = 'lost' then
    raise exception 'the lost stage cannot be archived — closing a lead as lost would have nowhere to go';
  end if;

  select count(*) into v_open_left
    from public.pipeline_stages
   where tenant_id = v_tenant_id
     and archived_at is null
     and kind = 'open'
     and id <> p_stage_id;

  if v_open_left < 1 then
    raise exception 'this is the last open stage — a new lead would have nowhere to be created';
  end if;

  select count(*) into v_leads
    from public.leads
   where stage_id = p_stage_id;

  if v_leads > 0 then
    if p_destination_id is null then
      raise exception '% lead(s) are in this stage — a destination is required', v_leads;
    end if;

    -- The destination must be live, in the same tenant, and not the stage being archived.
    if not exists (
      select 1 from public.pipeline_stages
       where id = p_destination_id
         and tenant_id = v_tenant_id
         and archived_at is null
         and id <> p_stage_id
    ) then
      raise exception 'destination stage is not a live stage of this tenant';
    end if;

    -- This fires leads_log_status_change per row, so every moved lead gets a history entry.
    -- That is wanted: "your leads moved because the stage was archived" is a real event, and a
    -- silent bulk move would leave the timeline lying about how they got there.
    update public.leads
       set stage_id = p_destination_id
     where stage_id = p_stage_id;

  elsif p_destination_id is not null then
    raise exception 'no leads are in this stage — a destination is not needed';
  end if;

  update public.pipeline_stages
     set archived_at = now()
   where id = p_stage_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC on every new function; take it back. `authenticated` gets
-- it and RLS decides the rest.

revoke execute on function public.reorder_stages(uuid, uuid[]) from public, anon;
revoke execute on function public.archive_stage(uuid, uuid)     from public, anon;

grant execute on function public.reorder_stages(uuid, uuid[]) to authenticated;
grant execute on function public.archive_stage(uuid, uuid)     to authenticated;
