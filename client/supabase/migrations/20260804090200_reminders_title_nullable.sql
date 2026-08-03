-- reminders.title must be nullable, and today it is not. This is a live defect.
--
-- `title text not null` (init_schema:110) contradicts every writer the product actually has:
--
--   * The lead sheet's follow-up line sends `reminderTitle: null` on every save
--     (lead-sheet.ts:363) — the plan's fast path is date-only, because forcing someone to
--     name a reminder before they can schedule a call is friction with no payoff.
--   * `save_lead` passes it through `nullif(btrim(coalesce(p_reminder_title, '')), '')`
--     (20260803140000), which turns an absent title into NULL by design.
--   * `RemindersStore.create` passes `title` straight through, null included.
--
-- So setting a follow-up from the lead sheet violates the not-null constraint and the save
-- fails at the database. Only the reminders screen's suggestion band works, and only because
-- it happens to pass the reason text as a title.
--
-- Fixed by relaxing the column rather than by substituting a placeholder, because an absent
-- title and an empty title are different facts and the product already relies on the
-- difference: `RemindersStore.titleFor()` falls back to the reason when there is no title, so
-- a row with no title renders correctly. Writing 'תזכורת' into the column instead would make
-- every untitled reminder claim a title nobody typed, and the fallback could never fire.
--
-- Found while reviewing the automations work, which coalesces to its own default and would
-- have hidden this for its own inserts while leaving the lead sheet broken.

alter table public.reminders
  alter column title drop not null;
