-- Dev seed: pipeline content for the dashboard. Leads only — no users, no tenants.
--
-- Targets the tenant owned by yaniv@quickdev.co.il, looked up by email so the same file
-- works on the local stack (seed.sql creates that user) and on the cloud project. Everything is authored
-- demonstration content, not real customers.
--
-- Safe to re-run: it deletes only the rows it created (matched by name), never the
-- signup trigger's demo lead and never anything a person added by hand.
--
-- Locally it runs from seed.sql on every `supabase db reset`. On the cloud project, paste
-- it into the SQL editor.

-- Each statement carries its own `ctx` CTE (tenant + owner by email): the CLI seeder prepares
-- every statement of a file up front, so nothing created earlier in the file can be referenced.

-- ---------------------------------------------------------------- leads

with ctx as (
  select m.tenant_id, m.user_id as owner_id
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where u.email = 'yaniv@quickdev.co.il' and m.role = 'owner'
),
names as (
  select unnest(array[
    'מיכל ברנר','סטודיו פרג׳','דניאל חדד','רן אלגריסי','אורית לוי',
    'כרמל דיגיטל','נועה שגב','אבי מזרחי','שירה בן־דוד','טל אבידן',
    'בית קפה לבנון','גלית אשכנזי','מוסך אחים דוד','יעל רוזנברג'
  ]) as name
)
delete from public.leads l
using ctx c, names n
where l.tenant_id = c.tenant_id and l.name = n.name;

with ctx as (
  select m.tenant_id, m.user_id as owner_id
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where u.email = 'yaniv@quickdev.co.il' and m.role = 'owner'
)
insert into public.leads (
  tenant_id, created_by, assigned_to, name, company, email, phone,
  source, stage_id, estimated_value, lost_reason, is_demo, created_at
)
select
  c.tenant_id, c.owner_id, c.owner_id,
  v.name, v.company, v.email, v.phone,
  v.source::public.lead_source, st.id,
  v.estimated_value, v.lost_reason, false,
  now() - (v.age_days || ' days')::interval
from ctx c
cross join (values
  ('מיכל ברנר',    'ברנר ושות׳',        'michal@brenner.co.il',       '052-4410982', 'referral',     3,               18000, null,   24),
  ('סטודיו פרג׳',  'מיכל פרג׳',          'hello@farge.studio',         '054-7728310', 'website',      2,                7400, null,   11),
  ('דניאל חדד',    'חדד תקשורת',         'daniel@hadad.co.il',         '050-3319074', 'social_media', 0,                3200, null,    1),
  ('רן אלגריסי',   'אלגריסי ובניו',      'ran@algrisi.co.il',          '053-8820145', 'referral',     4,                9800, null,   42),
  ('אורית לוי',    'לוי הפקות',          'orit@levi-productions.co.il','052-6640238', 'referral',     2,               12500, null,   45),
  ('כרמל דיגיטל',  'נטע כרמל',           'neta@carmel.digital',        '054-2201877', 'website',      3,               45000, null,   30),
  ('נועה שגב',     null,                 'noa.segev@gmail.com',        '050-9917426', 'phone',        1,                2100, null,   35),
  ('אבי מזרחי',    'מזרחי מיזוג אוויר',  'avi@mizrahi-ac.co.il',       '052-3308811', 'social_media', 0,                6300, null,    0),
  ('שירה בן־דוד',  'בן־דוד עיצוב פנים',  'shira@bendavid.design',      '053-4471290', 'website',      1,               22000, null,   28),
  ('טל אבידן',     'אבידן ייעוץ',        'tal@avidan.co.il',           '054-6612093', 'referral',     4,               15600, null,   60),
  ('בית קפה לבנון','יוסי לבנון',         'yossi@levanon.cafe',         '050-2214408', 'phone',        5,                1800, 'מחיר', 61),
  ('גלית אשכנזי',  'אשכנזי נדל״ן',       'galit@ashkenazi-re.co.il',   '052-7730164', 'website',      1,               31000, null,   19),
  ('מוסך אחים דוד','איציק דוד',          'itzik@davidgarage.co.il',    '053-9902471', 'other',        0,                4200, null,    4),
  ('יעל רוזנברג',  'רוזנברג ייעוץ מס',   'yael@rosenberg-tax.co.il',   '054-1128806', 'referral',     4,                8900, null,   70)
) as v(name, company, email, phone, source, stage_pos, estimated_value, lost_reason, age_days)
-- stage by position in the default pipeline: 0 new, 1 contacted, 2 qualified, 3 proposal, 4 won, 5 lost
join public.pipeline_stages st on st.tenant_id = c.tenant_id and st.position = v.stage_pos;

-- ------------------------------------------------- activities (last contact)
-- The dashboard derives "last contact" from the newest activity, and the drift flag
-- from how long ago it was. Without these every lead reads as never-contacted.

with ctx as (
  select m.tenant_id, m.user_id as owner_id
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where u.email = 'yaniv@quickdev.co.il' and m.role = 'owner'
)
insert into public.activities (lead_id, tenant_id, created_by, type, body, occurred_at)
select l.id, l.tenant_id, c.owner_id, v.type::public.activity_type, v.body,
       now() - (v.days_ago || ' days')::interval
from ctx c
join public.leads l on l.tenant_id = c.tenant_id
join (values
  ('מיכל ברנר',     5, 'email',   'נשלחה הצעת מחיר'),
  ('סטודיו פרג׳',   1, 'meeting', 'פגישה במשרד'),
  ('רן אלגריסי',    0, 'call',    'סגרנו — נשלח חוזה'),
  ('אורית לוי',     9, 'call',    'שיחת בירור'),
  ('כרמל דיגיטל',   2, 'email',   'תיאום פרטים אחרונים'),
  ('נועה שגב',      4, 'call',    'שיחה ראשונה'),
  ('אבי מזרחי',     0, 'call',    'פנייה מהאתר'),
  ('שירה בן־דוד',   6, 'email',   'שלחתי דוגמאות'),
  ('טל אבידן',     24, 'call',    'נסגר'),
  ('בית קפה לבנון',21, 'call',    'החליטו לא להתקדם'),
  ('גלית אשכנזי',   3, 'meeting', 'פגישת היכרות'),
  ('יעל רוזנברג',  30, 'email',   'נסגר')
) as v(name, days_ago, type, body) on v.name = l.name;

-- --------------------------------------------------- reminders (the day sheet)
-- One open follow-up due today. This is what puts a lead on the yellow sheet.

with ctx as (
  select m.tenant_id, m.user_id as owner_id
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where u.email = 'yaniv@quickdev.co.il' and m.role = 'owner'
)
insert into public.reminders (lead_id, tenant_id, assigned_to, title, due_at)
select l.id, l.tenant_id, c.owner_id, v.title, now() - (v.days_ago || ' days')::interval
from ctx c
join public.leads l on l.tenant_id = c.tenant_id
join (values
  ('סטודיו פרג׳', 0, 'לחזור אחרי הפגישה')
) as v(name, days_ago, title) on v.name = l.name;

-- ------------------------------------------ qualification answers (checklist)
-- Drives "3 מתוך 5 שאלות הכשרה" on the board and the nudge on a stage move.

with ctx as (
  select m.tenant_id, m.user_id as owner_id
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where u.email = 'yaniv@quickdev.co.il' and m.role = 'owner'
)
insert into public.qualification_answers (lead_id, item, tenant_id, answer, answered_by)
select l.id, v.item::public.checklist_item, l.tenant_id,
       v.answer::public.qualification_answer, c.owner_id
from ctx c
join public.leads l on l.tenant_id = c.tenant_id
join (values
  ('מיכל ברנר',   'interest',  'yes'),
  ('מיכל ברנר',   'need',      'yes'),
  ('מיכל ברנר',   'budget',    'yes'),
  ('מיכל ברנר',   'authority', 'yes'),
  ('מיכל ברנר',   'timeline',  'yes'),
  ('סטודיו פרג׳', 'interest',  'yes'),
  ('סטודיו פרג׳', 'need',      'yes'),
  ('סטודיו פרג׳', 'budget',    'unknown'),
  ('אורית לוי',   'interest',  'yes'),
  ('אורית לוי',   'need',      'yes'),
  ('אורית לוי',   'budget',    'no'),
  ('אורית לוי',   'authority', 'unknown'),
  ('כרמל דיגיטל', 'interest',  'yes'),
  ('כרמל דיגיטל', 'need',      'yes'),
  ('כרמל דיגיטל', 'budget',    'yes'),
  ('כרמל דיגיטל', 'authority', 'yes'),
  ('כרמל דיגיטל', 'timeline',  'yes'),
  ('נועה שגב',    'interest',  'yes'),
  ('נועה שגב',    'need',      'unknown')
) as v(name, item, answer) on v.name = l.name
on conflict (lead_id, item) do nothing;


-- What you should see afterwards:
--   15 leads (14 above + the signup trigger's demo lead)
--   day sheet: סטודיו פרג׳ (reminder due), מיכל ברנר (proposal silent 5 days),
--              מוסך אחים דוד + דניאל חדד (new, unqualified)
--   drift flags: אורית לוי (9 days), שירה בן־דוד (6 days)
