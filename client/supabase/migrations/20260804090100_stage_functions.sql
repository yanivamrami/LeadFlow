-- The two trigger functions that knew the stages by name.
--
-- `lead_stats` (20260804090300) and the write RPCs (20260804092000) are rewritten in their own
-- migrations; this file owns the stage-move audit trigger and the signup seed.
--
-- Both keep `security definer` and `set search_path = ''`, and both stay revoked from every role
-- (20260802154552): Postgres checks EXECUTE on a trigger function at CREATE TRIGGER time, not at
-- fire time, so a trigger keeps working with no privileges granted to anyone.

-- ---------------------------------------------------------------------------
-- 1. Stage-move audit
-- ---------------------------------------------------------------------------
-- Was `after update of status`, comparing enum values and writing "old -> new" into the body.
-- Now compares stage_id and writes the ids into the typed columns 20260803120000 added.
--
-- The body text stays, and stays human-readable, but it is no longer the source of truth for
-- anything: the funnel reads to_stage_id. It is kept because an activity row with no readable
-- text renders as a blank line in the timeline, and because a stage renamed after the move
-- should still show what it was called at the time — which is exactly what a text snapshot
-- gives and a foreign key cannot.

create or replace function public.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_to   text;
begin
  if new.stage_id is distinct from old.stage_id then
    select name into v_from from public.pipeline_stages where id = old.stage_id;
    select name into v_to   from public.pipeline_stages where id = new.stage_id;

    insert into public.activities (
      lead_id, tenant_id, created_by, type, body, from_stage_id, to_stage_id
    )
    values (
      new.id,
      new.tenant_id,
      (select auth.uid()),
      'status_changed',
      coalesce(v_from, '?') || ' -> ' || coalesce(v_to, '?'),
      old.stage_id,
      new.stage_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists leads_log_status_change on public.leads;

create trigger leads_log_status_change
  after update of stage_id on public.leads
  for each row execute function public.log_lead_status_change();

revoke execute on function public.log_lead_status_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Signup
-- ---------------------------------------------------------------------------
-- Seeds the six stages **before** the demo lead, then points that lead at position 0.
--
-- If this function raises, signup fails — so the stage insert is a single statement with no
-- lookup that can miss, and the demo lead resolves its stage from the rows just written in the
-- same transaction.
--
-- The seed copy is duplicated from 20260804090000's backfill on purpose. Factoring it into a
-- shared function would mean a later edit to the default pipeline silently changing what
-- existing tenants already have; a new tenant's defaults and a historical backfill are two
-- different facts that happen to agree today.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_tenant_id    uuid;
  v_stage_id     uuid;
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

  insert into public.pipeline_stages (
    tenant_id, name, short_name, position, kind, swatch,
    meaning, guidance, drift_days, expects_reply, is_system
  )
  select v_tenant_id, s.name, s.short_name, s.position, s.kind, s.swatch,
         s.meaning, s.guidance, s.drift_days, s.expects_reply, true
    from (
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
    ) as s(name, short_name, position, kind, swatch,
           meaning, guidance, drift_days, expects_reply);

  select id into v_stage_id
    from public.pipeline_stages
   where tenant_id = v_tenant_id and position = 0;

  insert into public.leads (
    tenant_id, created_by, assigned_to,
    name, email, phone, company,
    source, stage_id, estimated_value, is_demo, sort_order
  )
  values (
    v_tenant_id, new.id, new.id,
    'דנה כהן', 'dana@example.co.il', '050-0000000', 'סטודיו דנה עיצוב',
    'referral', v_stage_id, 4500, true, 0
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
