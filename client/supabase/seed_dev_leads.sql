-- Dev seed: pipeline content for the dashboard. Leads only — no users, no tenants.
--
-- Targets the existing tenant of yaniv@quickdev.co.il. Everything is authored
-- demonstration content, not real customers.
--
-- Safe to re-run: it deletes only the rows it created (matched by name), never the
-- signup trigger's demo lead and never anything a person added by hand.
--
-- Run in the Supabase SQL editor, or:
--   psql "$DEV_DATABASE_URL" -f client/supabase/seed_dev_leads.sql

begin;

create temp table seed_ctx on commit drop as
select
  '05c82673-78c8-4bb0-8e49-b698cc38d031'::uuid as tenant_id,
  '4951b380-eae0-4a1e-919b-fd6fe97479c6'::uuid as owner_id;

-- ---------------------------------------------------------------- leads

with names as (
  select unnest(array[
    'מיכל ברנר','סטודיו פרג׳','דניאל חדד','רן אלגריסי','אורית לוי',
    'כרמל דיגיטל','נועה שגב','אבי מזרחי','שירה בן־דוד','טל אבידן',
    'בית קפה לבנון','גלית אשכנזי','מוסך אחים דוד','יעל רוזנברג'
  ]) as name
)
delete from public.leads l
using seed_ctx c, names n
where l.tenant_id = c.tenant_id and l.name = n.name;

insert into public.leads (
  tenant_id, created_by, assigned_to, name, company, email, phone,
  source, status, estimated_value, lost_reason, is_demo, created_at
)
select
  c.tenant_id, c.owner_id, c.owner_id,
  v.name, v.company, v.email, v.phone,
  v.source::public.lead_source, v.status::public.lead_status,
  v.estimated_value, v.lost_reason, false,
  now() - (v.age_days || ' days')::interval
from seed_ctx c,
(values
  ('מיכל ברנר',    'ברנר ושות׳',        'michal@brenner.co.il',       '052-4410982', 'referral',     'proposal_sent', 18000, null,   24),
  ('סטודיו פרג׳',  'מיכל פרג׳',          'hello@farge.studio',         '054-7728310', 'website',      'qualified',      7400, null,   11),
  ('דניאל חדד',    'חדד תקשורת',         'daniel@hadad.co.il',         '050-3319074', 'social_media', 'new',            3200, null,    1),
  ('רן אלגריסי',   'אלגריסי ובניו',      'ran@algrisi.co.il',          '053-8820145', 'referral',     'won',            9800, null,   42),
  ('אורית לוי',    'לוי הפקות',          'orit@levi-productions.co.il','052-6640238', 'referral',     'qualified',     12500, null,   45),
  ('כרמל דיגיטל',  'נטע כרמל',           'neta@carmel.digital',        '054-2201877', 'website',      'proposal_sent', 45000, null,   30),
  ('נועה שגב',     null,                 'noa.segev@gmail.com',        '050-9917426', 'phone',        'contacted',      2100, null,   35),
  ('אבי מזרחי',    'מזרחי מיזוג אוויר',  'avi@mizrahi-ac.co.il',       '052-3308811', 'social_media', 'new',            6300, null,    0),
  ('שירה בן־דוד',  'בן־דוד עיצוב פנים',  'shira@bendavid.design',      '053-4471290', 'website',      'contacted',     22000, null,   28),
  ('טל אבידן',     'אבידן ייעוץ',        'tal@avidan.co.il',           '054-6612093', 'referral',     'won',           15600, null,   60),
  ('בית קפה לבנון','יוסי לבנון',         'yossi@levanon.cafe',         '050-2214408', 'phone',        'lost',           1800, 'מחיר', 61),
  ('גלית אשכנזי',  'אשכנזי נדל״ן',       'galit@ashkenazi-re.co.il',   '052-7730164', 'website',      'contacted',     31000, null,   19),
  ('מוסך אחים דוד','איציק דוד',          'itzik@davidgarage.co.il',    '053-9902471', 'other',        'new',            4200, null,    4),
  ('יעל רוזנברג',  'רוזנברג ייעוץ מס',   'yael@rosenberg-tax.co.il',   '054-1128806', 'referral',     'won',            8900, null,   70)
) as v(name, company, email, phone, source, status, estimated_value, lost_reason, age_days);

-- ------------------------------------------------- activities (last contact)
-- The dashboard derives "last contact" from the newest activity, and the drift flag
-- from how long ago it was. Without these every lead reads as never-contacted.

insert into public.activities (lead_id, tenant_id, created_by, type, body, occurred_at)
select l.id, l.tenant_id, c.owner_id, v.type::public.activity_type, v.body,
       now() - (v.days_ago || ' days')::interval
from seed_ctx c
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

insert into public.reminders (lead_id, tenant_id, assigned_to, title, due_at)
select l.id, l.tenant_id, c.owner_id, v.title, now() - (v.days_ago || ' days')::interval
from seed_ctx c
join public.leads l on l.tenant_id = c.tenant_id
join (values
  ('סטודיו פרג׳', 0, 'לחזור אחרי הפגישה')
) as v(name, days_ago, title) on v.name = l.name;

-- ------------------------------------------ qualification answers (checklist)
-- Drives "3 מתוך 5 שאלות הכשרה" on the board and the nudge on a stage move.

insert into public.qualification_answers (lead_id, item, tenant_id, answer, answered_by)
select l.id, v.item::public.checklist_item, l.tenant_id,
       v.answer::public.qualification_answer, c.owner_id
from seed_ctx c
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

commit;

-- What you should see afterwards:
--   15 leads (14 above + the signup trigger's demo lead)
--   day sheet: סטודיו פרג׳ (reminder due), מיכל ברנר (proposal silent 5 days),
--              מוסך אחים דוד + דניאל חדד (new, unqualified)
--   drift flags: אורית לוי (9 days), שירה בן־דוד (6 days)
