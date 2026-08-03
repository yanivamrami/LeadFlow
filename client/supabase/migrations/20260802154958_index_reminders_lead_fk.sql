-- `reminders` had no index leading with lead_id, so the composite FK to
-- leads (id, tenant_id) forced a sequential scan on every lead delete
-- (advisor 0001, unindexed_foreign_keys).
--
-- The other unindexed-FK notices are left alone deliberately:
--   * activities / qualification_answers already have an index leading with
--     lead_id, which the planner can use for the composite FK check.
--   * created_by / assigned_to / answered_by are `on delete set null` and only
--     touched when a profile is deleted — a rare path not worth the write cost
--     of four more indexes on the hot tables.

create index reminders_lead_id_idx on public.reminders (lead_id, tenant_id);
