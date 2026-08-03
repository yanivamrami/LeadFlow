# Manual test scenarios

> For the screens that are code-complete but have **never been opened by a human**
> (`documents/GAPS.md` G-17 for §3/§6, G-33 for the reminders screens), plus a by-hand
> validation of the insights arithmetic (G-16).
>
> Written to be run by someone learning the app. Steps are literal; every "expected" line is
> what the code actually does as of 2026-08-03, not what it ought to do. **If reality differs
> from an expected line, that is a finding — log it, don't fix it mid-run.**
>
> Report template at the bottom (§6).

---

## 0. Setup

```bash
cd client
npm start          # ng serve → http://localhost:4200
```

- The dev build points at the **cloud dev** Supabase project
  (`src/environments/environment.development.ts`). Writes are real; there is no local emulator
  in play.
- Use a **throwaway account** for anything destructive. Sign-up creates a personal tenant plus
  one Hebrew demo lead automatically.
- Test on a phone-sized viewport **first** — devtools at 390×844 — then repeat the marked
  scenarios at ~1440px. The board only activates at ≥768px, the desktop nav at ≥900px.
- Keep the browser console open. An error there during a passing scenario is still a finding.
- SQL for the checks in §3 and §5: Supabase dashboard → SQL Editor.

**Suggested order:** §2 (auth, so you have an account) → §1 (leads) → §4b (reminders — needs a
lead or two to schedule against) → §3 (insights) → §4 → §5.

---

## 1. Lead screens (SCREENS §3 — seven screens, one component)

### S1 — Add a lead with a name only
1. On mobile: tap the red band at the bottom. On desktop: `+ ליד חדש` in the masthead.
2. Type a name. Touch nothing else.
3. Save.

**Expected:** the form shows **fields only** — no timeline, no checklist (there is nothing to
show yet). Save succeeds, the sheet closes, you land on the board, a success toast appears, and
the lead is in the register. Name is the only required field — no complaint about the missing
phone or email.

### S2 — Validation refuses only what it should
Open `/lead/new` and try each, one at a time:

| Input | Expected |
|---|---|
| Empty name → Save | Hebrew error under the name field. Nothing saved. |
| Anything typed before the first Save | **No errors visible.** Errors appear only after a save attempt, never while typing. |
| Email `abc@` → Save | Email error. |
| Email `a@b.co` | Accepted. |
| Value `12abc` → Save | Value error. |
| Value `0` | **Accepted** — zero is a real estimate. |
| Value empty | Accepted — empty is not zero. |

### S3 — Open a lead from all three places
Open the same lead from: a **register row** (list view), a **board card** (≥768px), and a **day
sheet item**.

**Expected:** all three open the same sheet, all three by tapping the **lead's name**. Fields are
pre-filled. Tapping a row's kebab/menu does **not** open the sheet — the two targets do not
swallow each other.

### S4 — Timeline reads correctly
On a lead with several activities.

**Expected:** newest entry first. Anything from today is stamped `היום HH:MM`; yesterday
`אתמול HH:MM`; older shows a date like `5 באוגוסט`. Two entries on the same day are tellable
apart by time. Past 20 entries, an expand control appears.

### S5 — Checklist answers persist, untouched stays untouched
1. Open a lead. Answer 2 of the 5 questions (`כן` / `לא` / `?`).
2. Note the answered counter. Save.
3. Re-open the lead.

**Expected:** the selected segment carries an ink fill; the counter reads 2 of 5; after save and
re-open the two answers are still there and the other three are **still blank** — not `?`.
"Not asked" and "asked, unknown" are different states and must stay different.

### S6 — "Why ask?" opens one at a time
Tap the per-question "why ask?" on question 1, then on question 3.

**Expected:** question 1's explanation closes when 3 opens. Tapping the same one again closes it.

### S7 — Log an activity
1. Open a lead. Pick a type chip (`שיחה` · `אימייל` · `פגישה` · `הערה`), type a note.
2. Save **once**.

**Expected:** one save commits fields, note and any checklist answers together — there is no
second "add note" button. The note appears in the timeline with its type. No edit and no delete
on notes: they are append-only by design.

**Follow-up behaviour (G-26, applied).** Saving a note typed `שיחה` / `אימייל` / `פגישה` clears
the lead's open follow-up; a plain `הערה` deliberately does not, because recording an intention
is not the same as having reached someone. Both entry points agree — the day sheet's one-tap
action uses the same three types.

### S8 — Close a lead as won
1. Open a lead, change status to `נסגר בהצלחה`.

**Expected:** an extra block appears **inline** (never a second dialog) asking to confirm the
final amount, pre-filled with the estimate. Editing it changes the value that lands — so the
conversion figures report real revenue, not a guess.

### S9 — Close a lead as lost
1. Change status to `לא יצא לפועל`. Try to save with no reason.
2. Then tap one of the reason chips.

**Expected:** save is refused with an error — a reason is required on a lost lead. Chips write
their text into the free-text field, which stays editable. Switching the status away from lost
clears the reason on save.

### S10 — Unsaved changes guard
1. Open a lead, change a field (or just type in the note box).
2. Tap the X / close.

**Expected:** the **footer strip changes job** and asks — no modal over the sheet. Cancel returns
you to editing with everything intact. Confirm discards and closes. Typing only in the note box
counts as unsaved.

### S11 — Delete a lead
Use a throwaway lead.
1. Open it → delete.

**Expected:** a two-step confirm in the footer strip, naming the blast radius **including how
many activities go with it**. Cancel is always available. Confirm deletes and returns to the
board.

### S12 — ~~Field tooltips (expected to FAIL)~~ — now built, see S21
Look for a per-field explanation on the lead form.

**Expected today:** labels and one help line only. The PRD's per-field tooltips are not built.
Record what you wish each field explained — that copy is the deliverable for G-23.

### S13 — Deep link to a lead that does not exist
Visit `/lead/00000000-0000-0000-0000-000000000000`.

**Expected:** a clear "not found" state after the read finishes. Not a spinner forever, not an
empty form.

### S14 — Save with no network
1. Open a lead, change something.
2. Devtools → Network → Offline.
3. Save.

**Expected:** an offline banner under the masthead pushing content down, and a toast saying the
write was blocked. **The sheet stays open and your typed text is still there** — nothing was
attempted, so nothing was lost. Go back online: the banner confirms reconnection, and saving
now works.

### S15 — Stage move from the board (desktop, ≥768px)
1. Drag a card to another column. Then do the same via the card's stage menu.

**Expected:** both paths work — drag is never the only route. A `status_changed` entry appears in
that lead's timeline (written by a database trigger, not the form). If the lead has unanswered
checklist questions, a dismissible nudge appears counting them, always with `לא עכשיו`; it
informs only — it does not offer to mark them answered. If the checklist is complete, you get the
stage's guidance line instead. **The move is never blocked.**

### S16 — Checklist nudge takes you to the questions
1. Pick a lead with unanswered checklist questions. Move it a stage (drag, or the card/row menu).
2. The nudge appears in the toast stack, counting the open questions. It has **two** buttons.
3. Tap `מלא עכשיו`.

**Expected:** you land on that lead, **scrolled to the checklist**, with the questions on screen —
not at the top of the sheet. **Nothing is answered and nothing is pre-selected.** The nudge is
gone. Tapping `לא עכשיו` instead just dismisses it and the stage move stands either way.

**Also check:**
- Keyboard: Tab to `מלא עכשיו`, press Enter. Same landing, and focus is **on the checklist
  section** — the next Tab reaches the first answer segment, so no keystroke can answer a question
  by accident.
- OS reduce-motion on: the jump is instant rather than a smooth scroll.
- The address bar reads `/lead/<id>?at=checklist`. Reloading that URL lands the same way.
- Move a lead whose checklist is **complete**: you get the stage's guidance line instead, with no
  nudge at all.
- Move a lead to `נסגר בהצלחה` / `לא יצא לפועל` with questions open: no nudge — closing is not the
  moment to qualify.

---

## 2. Auth screens (SCREENS §6)

### A1 — Sign up
1. `/auth/sign-up`. Name, email, password (min 8 characters).

**Expected:** account created, you land straight on the board, and the board is **not empty** —
one Hebrew demo lead exists, visibly labelled as demo. A personal tenant was created for you.

### A2 — Sign-up validation
Empty name; malformed email; 7-character password; mismatched confirmation (if present).

**Expected:** a Hebrew message per field, all before any request is sent.

### A3 — Sign in, wrong password
Correct email, wrong password.

**Expected:** an error that does **not** reveal which of the two was wrong — that would tell an
attacker which addresses are registered. Deliberate.

### A4 — returnUrl works
1. Sign out. Visit `/insights` directly.
2. Sign in.

**Expected:** bounced to sign-in with a `returnUrl` in the address bar, and after signing in you
land on `/insights` — not the board.

### A5 — returnUrl cannot leave the app *(security)*
Signed out, visit `/auth/sign-in?returnUrl=//example.com` and sign in.

**Expected:** you land on the board (`/`). The app must never navigate off-origin from a query
parameter. Also try `?returnUrl=/profile` → lands on the profile. If A5 ever sends you to
another site, stop and report it immediately.

### A6 — Signed-in users cannot reach the auth screens
While signed in, visit `/auth/sign-in`.

**Expected:** bounced to the board.

### A7 — Password reset request
`/auth/reset` → submit a registered address, then an unregistered one.

**Expected:** the **same** confirmation both times — it never reveals whether an address exists.
No email will actually arrive: there is no SMTP sender (G-15). Confirm the screen's behaviour
only.

### A8 — Reset link landing without a token
Visit `/auth/reset/new` directly with no token.

**Expected:** an "expired / invalid link" state that offers to request a fresh one. Note this
route sits **outside** the signed-out guard on purpose — a real recovery link creates a session
before the new password is chosen.

### A9 — Profile screen
`/profile`: change the display name; switch theme light → dark → system; then change the password.

**Expected:** the name updates in the masthead monogram. Theme change is immediate and survives a
reload. Password change asks you to re-authenticate first. Email is **read-only** (needs a sender
— G-15). There is **no field for the business name** at all (G-24).

### A10 — Sign out
Sign out from the profile.

**Expected:** you land on a signed-out screen, and pressing Back does not show the board with
data.

### A11 — Sign in with no network (expected to be POOR — G-25)
Devtools → Offline, then attempt sign-in.

**Expected today:** one toast, no offline banner — the banner lives inside the signed-in shell.
You cannot tell "wrong password" from "no internet". Confirm this; it is the finding.

---

## 3. Validating the insights numbers (G-16)

The aggregate `lead_stats` was accepted by Postgres but has never been run against real rows.
Validate by computing the same numbers a second way and comparing.

**Run G-18's fix first** (`PLAN-gaps.md` §1) — otherwise the demo lead is counted and you will be
comparing two wrong numbers. If you validate before the fix, use the second query below (which
excludes demo leads) and expect the screen to be **higher** than SQL by exactly the demo lead.

### 3a. Find your tenant id

```sql
select t.id as tenant_id, t.name, u.email
  from public.tenants t
  join public.memberships m on m.tenant_id = t.id
  join auth.users u        on u.id = m.user_id;
```

### 3b. What the app calls

```sql
select public.lead_stats('<tenant_id>'::uuid);
```

### 3c. The independent count — plain SQL, no function

```sql
-- headline figures
select count(*)                                             as total,
       count(*) filter (where status = 'won')                as won,
       count(*) filter (where status = 'lost')               as lost,
       count(*) filter (where status in ('won','lost'))      as decided,
       count(*) filter (where status not in ('won','lost'))  as open,
       coalesce(sum(estimated_value) filter
         (where status not in ('won','lost')), 0)            as open_value,
       coalesce(sum(estimated_value) filter
         (where status = 'won'), 0)                          as won_value
  from public.leads
 where tenant_id = '<tenant_id>'::uuid
   and is_demo = false;

-- source breakdown
select source,
       count(*)                                as total,
       count(*) filter (where status = 'won')  as won,
       count(*) filter (where status = 'lost') as lost
  from public.leads
 where tenant_id = '<tenant_id>'::uuid and is_demo = false
 group by source
 order by won desc, total desc;

-- stage reach: is it there now, or did history say it entered
select s.status,
       (select count(distinct l.id)
          from public.leads l
         where l.tenant_id = '<tenant_id>'::uuid
           and l.is_demo = false
           and (l.status = s.status
                or exists (select 1 from public.activities a
                            where a.lead_id = l.id
                              and a.type = 'status_changed'
                              and a.to_status = s.status))) as reached
  from unnest(enum_range(null::public.lead_status)) as s(status);
-- 'new' is special: every lead reached it, because creation writes no history row.
```

### 3d. Compare against the screen

| On `/insights` | Must equal |
|---|---|
| Total leads | `total` |
| Conversion % | `round(won / decided * 100)` — **not** `won / total`. Deliberate (G-11); the screen names its own denominator. |
| Value in play | `open_value` |
| Closed value | `won_value` |
| Each pipeline bar | matching `reached` row. Bars are relative to the widest bar, so check the **numbers**, not bar lengths. |
| Source rows | the source query, sorted by close rate — best-closing source first |
| Below 10 decided leads | **no ratio between sources appears at all** — not even caveated. Deliberate (SCREENS 5.4). |

### 3e. Deliberately move a lead and re-check
Move a lead `new → contacted → qualified`, then close it as won with a final amount.

**Expected:** `total` unchanged. `decided` +1, `won` +1, conversion recomputed. `open_value` drops
by that lead's estimate; `closed value` rises by the **final** amount you confirmed, not the
estimate. `reached` gains 1 on contacted, qualified and won — and keeps its count on `new`,
because reach is cumulative history, not current position.

**Also check:** a lead that skips stages (`new` straight to `proposal_sent`) increments
`proposal_sent` reach but **not** `contacted` or `qualified`. That asymmetry is the entire point
of the pipeline ramp — it is how "where do I lose them" becomes readable.

---

## 4. Source filter from insights (expected to FAIL — G-27)

1. `/insights` → tap a lead-source row.

**Expected today:** you land on the board with the address bar showing `?source=…` and the board
shows **every lead, unfiltered**. Nothing errors — the answer is just silently wrong.

**After G-27 is fixed:** only that source's leads are listed, a removable chip names the active
filter, the stage counts reflect it, and `?source=nonsense` falls back to showing everything
rather than an empty board.

---

## 4b. Reminders (SCREENS §4 — new, never opened by a human: GAPS G-33)

Everything here is **explicit** reminders — rows somebody scheduled. Derived urgency (drifting,
silent proposal, unqualified) stays on the day sheet and shows up here only as *suggestions*.
That distinction is the point of the screen, so R3 and R4 are the two that matter most.

### R1 — The badge tells the truth
1. Sign in. Look at the bell in the masthead before opening anything.
2. Note the number. Then open `/reminders` (tap the bell).

**Expected:** the badge equals **overdue + due-today rows only**. Add up the `באיחור` and
`היום` band counts on the screen — it must match exactly. `בהמשך` and `בלי תזכורת` are **not**
in it. With nothing scheduled there is **no badge at all**, not a `0`.

### R2 — Empty state, and the one case where there is none
1. On an account with no reminders at all and no drifting leads → open `/reminders`.
2. Then, on an account with drifting leads but still no reminders → open it again.

**Expected:** first time, a dashed empty container whose copy says the pipeline is clear (not
that the feature is unused) with one action back to the board. Second time, **no empty state** —
the `בלי תזכורת` suggestions band *is* the page.

### R3 — Set a reminder from a suggestion
1. `/reminders` → in `בלי תזכורת`, pick a lead and tap `קבע תזכורת`.
2. The picker opens **inside the row** — no popup. Tap `בעוד 3 ימים`, then save.

**Expected:** a success toast naming the date it landed on. The row leaves the suggestions band
and appears under `בהמשך`. The badge does **not** change (it is not due today). Reload — it is
still there.

### R4 — Set a reminder from the lead sheet, with the one save
1. Open any lead → find the follow-up line in the fields area (`מעקב`).
2. Tap `קבע תזכורת` → `מחר` → save the *picker*. Do **not** save the sheet yet.
3. Read the line, then **close the sheet with `ביטול`**.
4. Reopen the same lead.

**Expected:** after step 2 the line shows tomorrow's date plus `יישמר בשמירה` — the reminder is
staged, not written. Closing without saving triggers the unsaved-changes guard. After discarding,
the reopened lead has **no** reminder. Repeat, but press the sheet's `שמור` at step 3: now the
reminder persists and `/reminders` shows it under `היום`/`בהמשך`.

### R5 — Complete a reminder, and watch the day sheet
1. Have one reminder due **today**. Note the badge and the yellow day sheet's contents.
2. `/reminders` → tap `בוצע` on that row.
3. Without reloading, go back to the board.

**Expected:** the row goes; the band's count drops; the badge drops by one and disappears at
zero. On the day sheet that lead is **gone or struck through, with no manual refresh** — one
write, both surfaces. A toast confirms.

### R6 — Reschedule across bands
1. Have one **overdue** reminder. Open `/reminders`.
2. Tap `דחה` on it → `בעוד שבוע` → save.

**Expected:** the row moves out of `באיחור` into `בהמשך` immediately; both counts change; the
badge drops. The stamp reads `בעוד 7 ימים`, never a past-tense phrase.

### R7 — The past cannot be scheduled
1. Tap `דחה` → use the **date field** and type yesterday.

**Expected:** the native input's `min` should refuse it; if you get it in anyway (typing rather
than picking), the save is refused with a Hebrew message and **nothing is written**. Also try
**today** — that must be *accepted*: today is not the past.

### R8 — Cancel writes nothing
1. Open `דחה`, pick a chip, then press the cancel action instead of save.

**Expected:** the row is unchanged, no toast, no reload flicker.

### R9 — Clear a reminder
1. Lead sheet → follow-up line → `הסר תזכורת`, then save the sheet.

**Expected:** the line goes back to "no follow-up" copy, and the lead disappears from
`/reminders`. It may reappear under `בלי תזכורת` as a *suggestion* if the pipeline thinks it is
drifting — that is correct, not a duplicate.

### R10 — The login digest, and its silence
1. Sign in with at least one **overdue** reminder, landing anywhere except `/reminders`.
2. Reload the page.
3. Sign out and back in.

**Expected:** step 1 shows **one** toast naming the overdue count, with `הצג` that lands on the
list. Step 2 is **silent** (once per browser session). Step 3 announces again. With reminders due
today but none overdue, the message names the today count instead; with both, **overdue wins**.
With nothing due, **no toast ever**. Sign in with the network off, or land directly on
`/reminders`, and there is no toast either.

### R11 — Load failure, not a false empty
1. Open `/reminders`, then break the network in devtools and reload.

**Expected:** a load-failure state with a retry that replaces the whole list — **never** "you
have no reminders" and never a partial list plus an error. Restore the network, tap retry, the
list comes back.

### R12 — Keyboard and touch (run at 390px, then ~1440px)
1. Tab through a populated list.

**Expected:** the lead name is a link and reaching it does not require passing through the two
action buttons, and vice versa — neither swallows the other. Every target is at least 44×44 even
though the density is compact. Reduce motion at the OS level: the per-row busy sweep must
**stop**, not strobe.

---

## 7. Custom stages & automations (SCREENS §9 — never opened by a human: GAPS G-40)

Run on branch `feat/stages-and-automations`. The dev database has **already been migrated** —
`public.lead_status` no longer exists — so `main` will NOT work against dev until this branch
merges. That is expected, not a bug.

The single most important test is **P1**: a rename must change no arithmetic at all. That is the
whole point of the `kind` column, and if it fails, the design is wrong rather than the code.

### P1 — Renaming a stage changes no number *(the load-bearing test)*
1. Note every figure on `/insights`: total, conversion %, open value, won value, each funnel bar.
2. `/settings/stages` → rename `נסגר בהצלחה` to something else, e.g. `לקוח`. Save.
3. Return to `/insights`.

**Expected:** every figure is **identical**. The funnel bar's label changed and nothing else did.
Conversion still has a numerator. The lead sheet still offers the won-amount confirmation on that
stage, and the board column still carries the reserved red treatment — because those follow
`kind`, not the name. If any number moved, stop and report: something is keyed on a name.

### P2 — Add a stage from a template
1. `/settings/stages` → `הוסף שלב` → pick `ממתין לחתימה`.

**Expected:** it arrives **with its own teaching copy already filled in** (meaning, guidance, drift
days) and `expects_reply` already on. It appends at the end as an open stage. It appears
immediately as a board column and as a filter chip on the dashboard.

### P3 — A user-created stage drives the day sheet
1. Move a lead into the `ממתין לחתימה` stage you just made.
2. Wait past its drift threshold, or temporarily set its drift days to 1 and use a lead whose last
   touch is older than that.

**Expected:** that lead appears on the yellow day sheet with the "waiting on them" reason —
the same behaviour the built-in proposal stage has, with nobody writing code for it. This is
`expects_reply` working.

### P4 — Reorder survives a refresh
1. Drag stages into a new order. Reload the page.

**Expected:** the new order holds, on the manager, the board columns and the filter strip. No
column shows a duplicate position and nothing renders in a nonsensical order.

### P5 — Archive refusals explain themselves
Try to archive, in turn: the won stage, the lost stage, and (having archived down to one) the last
remaining open stage.

**Expected:** each is **refused with a readable Hebrew reason shown on screen** — not a silently
disabled button. The reasons differ per case.

### P6 — Archiving a stage that holds leads
1. Pick a stage with at least one lead. Archive it.

**Expected:** it asks where the leads go and says **how many** will move, and the archive action
stays unavailable until you choose. After confirming: the leads are in the destination, the stage
is gone from the board and the filter strip, and **each moved lead has a timeline entry** showing
the move — a silent bulk move would leave the timeline lying.

### P7 — Archived stages still resolve in history
1. Open a lead that was previously in the stage you just archived, and read its timeline.

**Expected:** the old entry still shows a real stage name and tag, not a blank. This is why stages
are archived rather than deleted.

### P8 — A stages load failure is not an empty pipeline *(regression guard)*
1. On the dashboard, devtools → Network → Offline, then reload.

**Expected:** a load-failure state with a retry. **Never** "you have no leads yet". This path
specifically: leads resolve their stage at read time, so a failed *stages* read used to empty the
pipeline and render the empty state over it.

### P9 — A reminder automation fires
1. `/settings/stages` → on any stage, open its automations section → add a rule:
   `כשליד מגיע לשלב הזה` → `קבע תזכורת` → 3 days.
2. Read the sentence the editor shows back to you before saving. Save.
3. Move a **non-demo** lead into that stage.

**Expected:** the rule's row restates itself in plain Hebrew. After the move, a reminder exists on
that lead 3 days out — visible on `/reminders` and on the lead sheet's follow-up line. The run log
shows one run, `done`. Move the same lead out and back in: it fires **again** (a new entry), but a
single move never produces two runs.

### P10 — Demo leads never fire
1. Move the seeded demo lead (`דנה כהן`) into a stage with a rule.

**Expected:** **nothing happens.** No reminder, no note, and the run log stays empty for that lead.

### P11 — `suggest_advance` suggests and does not move
1. Add a rule with action `הצע להעביר` targeting another stage. Move a lead in.

**Expected:** the lead gets a **note proposing** the move and **stays exactly where it is**. If the
lead moved on its own, that is a serious finding — nothing in this product moves a lead for you.

### P12 — Idle rule re-checks before firing
1. Add a `כשליד נשאר בשלב הזה` rule with 1 day. Move a lead in, then move it straight out again.
2. Wait for the sweep (runs every minute; the delay itself is a day, so to test properly set the
   rule to the shortest value the UI allows and use a lead that has been sitting).

**Expected:** when the queued run comes due and the lead is no longer in that stage, the run log
shows `skipped` **with the reason in words**, and nothing was written.

### P13 — Webhook URL guard
In the rule editor, try each as a webhook URL: `http://example.com`, `https://localhost/hook`,
`https://127.0.0.1/hook`, `https://169.254.169.254/`, `https://user:pw@example.com/hook`, and
finally a real `https://` endpoint (webhook.site gives you one).

**Expected:** the first five are refused at save time with readable Hebrew reasons. The real one
saves, and shows you a signing secret **once**, with a warning that it will not be shown again.

### P14 — A webhook actually arrives, signed
1. With the webhook.site rule saved, move a non-demo lead into that stage. Wait up to ~2 minutes
   (the sender and reconciler each run once a minute).

**Expected:** webhook.site shows a POST with `X-LeadFlow-Signature: sha256=…`, and a JSON body
containing `version: 1`, the lead's name, company, source, value and its stage. It must **not**
contain checklist answers or note bodies. The run log flips `queued` → `done`.
**Known limitation (G-42):** if the endpoint issues a redirect, we have not verified whether
`pg_net` follows it — do not test with a redirecting URL and treat that case as unknown.

### P15 — A failing endpoint is visible, not silent
1. Point a rule at an `https://` URL that returns a 500 (webhook.site can be configured to).
   Trigger it.

**Expected:** the run log shows the failure with the status code, and retries with growing gaps
(1m, 5m, 30m, 2h) up to five attempts before giving up. This screen is the only way a user can
discover their endpoint has been broken for a week.

### P16 — Suspended is not disabled
1. Archive a stage that has automations on it.

**Expected:** its rules show as **מושהה with a reason**, still visible in the archived section —
not deleted and not merely switched off. Nothing re-enables them by itself.

### P17 — A member cannot reshape the pipeline
Only testable once invites exist (8.3). Recorded so it is not forgotten: a non-owner member must
be refused on every stage and automation write, with a readable message rather than a raw error.

---

## 5. Cross-cutting checks (run once, anywhere)

| # | Check | Expected |
|---|---|---|
| X1 | Keyboard only — no mouse, no touch — through the board, the register and the lead sheet | Every action reachable. Focus always shows a visible ring. Drag is never the only path to a stage move. |
| X2 | OS setting → reduce motion, then reload | No stagger, no sliding. Loading skeletons **stop pulsing entirely** rather than speeding up. |
| X3 | Screenshot in greyscale (or a colour-blind simulator) | Every stage tag and attention flag still readable — status is never carried by colour alone. |
| X4 | Zoom the browser to 200% at 390px width | Nothing clipped, nothing horizontally scrolling. |
| X5 | Reload the dashboard | Skeletons appear on the **first** read only, never after a save. |
| X6 | Break the network, then reload the dashboard | A load-failure state with a retry — **not** "you have no leads yet". |
| X7 | Search for a string that matches nothing | "Nothing matched" — different copy from "no leads yet". |
| X8 | Any RTL check: numbers, dates, currency | `he-IL` formats, `₪`, and no Latin-first layout leaking in. |

---

## 6. How to report a finding

One line each, in a list you hand back:

```
[S7] Expected the note to appear in the timeline; it appeared twice.
     Mobile 390px, Chrome. Console: none.
[A11] Confirmed — no offline banner on sign-in. Matches G-25.
```

Include: scenario id, what you expected, what happened, viewport, and anything in the console.
Do not fix anything mid-run — a half-fixed app makes the remaining scenarios untrustworthy.
### S17 — Logging contact from the menus no longer writes junk
1. Open a lead's row menu (list view) → `רשום פעילות`.
2. Then a board card menu → same item.
3. Then, on the yellow day sheet, an item whose action reads `חייג`.
4. Then a day-sheet item whose action reads `רשום פעילות`.

**Expected:** 1, 2 and 4 open the lead with the **composer focused** — you type what happened,
then save. Nothing is written by the tap itself. 3 writes immediately and the timeline shows a
**call with no body text**: the type and the timestamp are the record. **No timeline entry
should ever read `רשום פעילות` or `חייג`** — that was the defect.

### S18 — `דחה` opens a day chooser everywhere
1. Day sheet → `דחה` on an item.
2. Register row menu → `דחה`. Then a board card menu → `דחה`.

**Expected:** on the day sheet the chooser appears **inline in the row**, pushing the rest of the
sheet down — it must never cover the yellow field. In the kebab, the **same panel** becomes the
chooser; no second panel stacks on top. `מחר` · `בעוד 3 ימים` · `בעוד שבוע` · `תאריך` · `ביטול`.
The success toast **names the date it landed on**, not "tomorrow". Picking a past date via the
date input is refused. `Escape` in the kebab goes chooser → menu → closed, one step at a time,
and focus returns to the kebab button. Only one row's chooser is open at a time.

### S19 — Source filter from insights
1. `/insights` → click a source name in the first column of the source table.

**Expected:** the board shows **only** that source. A removable chip names the filter, the stage
chip counts and the total reflect it, and clearing the chip also drops `?source=` from the URL so
a refresh does not resurrect it. Try `/?source=nonsense` → everything shows, never an empty
board. Switch to board view while filtered: **there is no chip there** — known gap G-40.

### S20 — Logout, and what it leaves behind
1. Find `יציאה` in the masthead (label at desktop width, icon-only on a phone). Sign out.
2. Sign back in as **a different account** if you have one, or the same one.

**Expected:** you land on sign-in with a confirmation toast. Pressing Back must not show a board
with data. After signing in, the board must show **only the new session's leads** — no flash of
the previous account's pipeline, and the reminders badge must not carry the old count. The
profile screen's `יציאה` must behave identically; both call one implementation.

### S21 — Per-field help on the lead form
1. `/lead/new` → tap `למה זה חשוב?` beside `שם`, then beside `מקור`.

**Expected:** one line appears beneath the field; opening the second closes the first. Nothing is
expanded on arrival. With a screen reader, focusing the input **announces the help line** (not
only pressing the toggle). Every toggle is a ≥44×44 target. This replaces S12, which expected
this to be missing.

### S22 — Business name
`/profile` → change the business name, save, reload.

**Expected:** it persists, with its own confirmation. Only the tenant owner may change it; a
non-owner sees a readable Hebrew refusal, not a Postgres error.


