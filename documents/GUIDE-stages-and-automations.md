# Pipeline stages and automations — how it works, and how to use it

A plain-language guide to the feature that lets you decide **which stages your pipeline has**, and
**what happens automatically when a lead reaches one**.

This is the "how do I actually use it" document. The design reasoning lives in
[`PLAN-stages.md`](PLAN-stages.md) and [`PLAN-automations.md`](PLAN-automations.md); the screen
specs are in [`SCREENS.md`](SCREENS.md) §9.1–9.4.

---

## 1. What this feature is, in one paragraph

The board used to have six fixed stages baked into the code. Now every business defines its own:
you can add stages, rename them, recolour them, reorder them, write the beginner-facing
explanations that appear on each one, and retire the ones you don't use. On top of that, each stage
can carry **rules** — "when a lead arrives here, set a reminder for 3 days" — so the follow-up you
promised yourself actually gets scheduled instead of being remembered.

Two words used throughout:

- **Stage** (Hebrew: *שלב*) — a column of the pipeline. "New lead", "Proposal sent", "Won".
- **Rule / automation** (Hebrew: *כלל*) — something the app does by itself when a condition on a
  stage is met.

---

## 2. Where it lives

**Screen:** `/settings/stages` — *שלבי הפייפליין*.

Two ways in:

1. **Profile** → the pipeline link near the bottom.
2. The **day sheet's help popup** (*למה לידים מופיעים כאן?*) links to it from the explanation of
   the thresholds.

**Who can change things:** only the **tenant owner** — the person who created the business. A team
member can open the screen and read the pipeline, but every write is refused by the database
(Postgres RLS), not merely hidden by the interface. Same level as reshaping the pipeline itself:
changing a rule changes what happens to every lead that passes through a stage, so it is not a
member-level decision.

---

## 3. What a stage is made of

Every stage carries these. All of them except *kind* are editable.

| Field | Hebrew label | What it does |
|---|---|---|
| Name | *שם השלב* | The full name, shown on the lead sheet's stage tag and everywhere the stage is named. |
| Short name | *שם קצר* | Used where space is tight — board column headers, filter chips, the lead sheet's stage strip. Leave empty to fall back to the full name. |
| Colour | *צבע* | One of eight swatches: chalk, sky, moss, amber, plum, clay, slate, sand (*גיר, שמיים, אזוב, ענבר, שזיף, חימר, צפחה, חול*). |
| Meaning | *משמעות השלב* | One sentence: **where the lead stands** now it's here. Shown as the stage's explanation. |
| Next step | *מה לעשות עכשיו* | One sentence: **what to do about it**. This is the advice shown on the lead. |
| Quiet after | *ימים עד סימון כשקט* | How many days without contact before a lead here is flagged as gone quiet. Leave empty and this stage never counts as quiet. |
| Waiting on them | *מחכים לתשובה מהצד השני* | Tick when the ball is in the customer's court. A silent lead here is flagged the same way the built-in "Proposal sent" stage does. |
| Kind | *סוג* | `open` / `won` / `lost` — **locked**, see below. |
| Position | — | Where it sits in the pipeline. Changed by dragging, not by typing a number. |

### The three kinds, and why kind is locked

- **open** (*פתוח*) — an ordinary working stage. You can have as many as you like.
- **won** (*זכייה*) — exactly one, always. Always red.
- **lost** (*אי-הצלחה*) — exactly one, always. Always hatched.

You can **rename** the won and lost stages (call them whatever your business calls them) but you
cannot change what kind they are, and you cannot change their colour. The database enforces this:
a pipeline must always have at least one open stage, exactly one live won stage, and exactly one
live lost stage. Insights, the board's closing behaviour and the lost-reason prompt all key off
`kind`, never off the name — so a renamed won stage still behaves like winning.

---

## 4. How to add a stage

1. Go to **`/settings/stages`**.
2. Press **הוסף שלב** (add stage).
3. Choose a **template** or **שלב משלי** (my own stage).

**Templates** exist because a stage you invent has no teaching copy, and the whole product is built
around explaining itself to beginners. Each template arrives with its meaning, its next-step advice,
a sensible quiet-after value and the waiting-on-them flag already set. You can edit every word
afterwards.

The four templates:

| Template | Short | Quiet after | Waiting on them |
|---|---|---|---|
| *ממתין להצעה* — qualified, you owe them a quote | בהכנה | 3 days | no |
| *ממתין לחתימה* — agreed, waiting for a signature | חתימה | 3 days | **yes** |
| *בהמתנה מהלקוח* — you sent something, waiting for a reply | ממתין | 5 days | **yes** |
| *לא בזמן הנכון* — interested, but not now | לא הזמן | 14 days | no |

Picking a template **creates the stage immediately** — each template button shows its name and its
meaning sentence so you can see what you are getting.

**שלב משלי** opens a short form instead. Only the **name** is required; you can also set the meaning,
the next-step advice, the quiet-after days, the waiting-on-them tick and the colour right there.
Anything you leave blank stays blank — a stage with no meaning simply shows nothing for it, which is
better than a generic sentence that says nothing. Leave quiet-after empty and the stage never flags
a lead as quiet.

A new stage is appended **after every existing stage, including won and lost**. Drag it where it
belongs.

---

## 5. How to edit a stage

There is **no edit button and no save button**. On `/settings/stages` every stage is a row whose
fields are already live controls — name, short name, colour, quiet-after, waiting-on-them, meaning,
next step. You change one and it is saved:

- **Text fields** (name, short name, quiet-after, and the two sentences) save when you **click or tab
  away** from them.
- **The colour swatches and the waiting-on-them tick** save the moment you press them.

Only what actually changed is sent, so tabbing through a row without touching anything writes
nothing. Each row also shows **how many leads are currently in that stage**.

**To reorder:** drag the handle. It is also fully keyboard-operable — focus the handle, **Space** to
pick up, **arrow keys** to move, **Space** again to drop. (The screen says so, in
*אפשר גם עם מקלדת…*.)

Changing the quiet-after number matters beyond cosmetics: it is the threshold the day sheet uses to
decide a lead has gone quiet, and — see §8 — the default reminder rule reads the same number.

---

## 6. How to retire a stage

Stages are **archived, never deleted**. A lead's history points at the stage it moved through, and
deleting the stage would tear a hole in that record.

1. Press **העבר לארכיון** (move to archive) on the stage.
2. If any leads are sitting in it, you **must choose where they go** — the screen asks
   *"N לידים נמצאים בשלב הזה — לאן להעביר אותם?"* and moves them for you.
3. Confirm.

After archiving: the stage disappears from the board and the filters, but old lead history still
references it. **Any rules on that stage are automatically suspended** — they show a *מושהה*
(suspended) badge with the reason. Turning them back on is a deliberate act, never automatic,
because a rule quietly resuming on a stage you retired is the kind of surprise this product avoids.

**Archived stages cannot currently be restored** to active use. The screen says so outright. If you
need it back, add a new stage.

---

## 7. Rules (automations) — what they can do

Each stage row has its own **אוטומציות על השלב הזה** section, listing that stage's rules with the
add form underneath. (Archived stages show the same panel read-only.) A rule is one sentence:

> **when** something is true → **do** this

The interface always shows you the finished sentence in Hebrew before you save, e.g.
*"כשליד מגיע לשלב הזה — קבעו תזכורת ל-3 ימים."* A rule you cannot read back in one sentence is a
rule you won't trust, so the sentence — not the raw fields — is what the row displays.

### The two triggers (*מתי*)

| Trigger | Hebrew | When it fires |
|---|---|---|
| Lead arrives | *כשליד מגיע לשלב הזה* | The instant the lead lands on the stage, in the same operation as the move. |
| Lead sits still | *כשליד נשאר בשלב הזה בלי תזוזה* | After **N days** — and **only if the lead is still there**. You set N. |

The "sits still" rule is scheduled the moment the lead arrives and fired later by a job that checks
every minute. If the lead moved on in the meantime, the run is recorded as **skipped** with the
reason *"הליד כבר לא בשלב הזה"* — it does not fire.

### The five actions (*מה לעשות*)

| Action | Hebrew | What happens | What you configure |
|---|---|---|---|
| Set a reminder | *קביעת תזכורת* | Creates a follow-up reminder on the lead, due N days out at **09:00** Israel time. | Days; optional title (defaults to *תזכורת אוטומטית*). |
| Assign to a teammate | *שיוך לחבר צוות* | Assigns the lead to a member. | Which member. |
| Add a note | *הוספת הערה* | Writes a note on the lead's history, clearly marked as automatic. | The text. |
| Suggest a stage move | *הצעת מעבר שלב* | Writes a **suggestion** as a note. | Which stage. |
| Send a webhook | *שליחת webhook* | Calls an HTTPS URL you own, signed so the receiver can verify it. | The URL. |

Two things worth knowing about specific actions:

- **"Suggest a stage move" never moves the lead.** It writes a note for a human to read and act on
  (or ignore). This is deliberate and load-bearing: the product's rule is *advisory, never
  blocking*, and a rule that silently reshuffles somebody's pipeline is the closest thing to a gate
  this codebase would have. Nothing in the automation engine is allowed to change a lead's stage.
- **"Set a reminder" reschedules rather than stacks.** A lead has at most one open reminder. If one
  already exists, the rule moves its date instead of adding a second — the day sheet and the bell
  badge are built to reason about one.

### Webhooks, briefly

Only **HTTPS**, and never a local or private address — the app refuses `http://`, `localhost`,
`127.x`, `10.x`, `192.168.x`, `172.16–31.x`, `169.254.x`. When you create a webhook rule you are
shown a **signing secret exactly once**: copy it then, because there is no way to see it again —
only to create a new rule. Every request is signed with it. Failed deliveries retry up to **5
times** with increasing gaps (1 minute, 5 minutes, 30 minutes, …), and after the last attempt the
run is kept with its error so you can see what happened.

---

## 8. The one rule you already have

Every pipeline is created with **one default rule**, and existing pipelines were given it too:

> On the stage marked **waiting on them** — when a lead arrives, set a reminder for the same number
> of days as that stage's quiet-after value.

For the standard pipeline that is exactly one stage — **נשלחה הצעה** (proposal sent), whose advice
reads *"if they don't come back to you within 3 days, pick up the phone"* — so the rule sets a
reminder 3 days out. The promise and the follow-up now match.

Two design notes, because both are easy to misread:

- It keys off **waiting on them**, not off quiet-after. Four of the six standard stages have a
  quiet-after value, so keying off that would put a reminder on nearly every stage move and turn
  your reminders list into a log of stage changes.
- The days figure **reads the stage's quiet-after value** rather than being fixed at 3. Change the
  threshold and the reminder follows it, so the advice sentence and the reminder can never drift
  apart.

A stage you build by hand gets no rule (it starts with waiting-on-them off). A stage built from a
template that waits on the customer gets the same default the standard pipeline does.

This rule is an ordinary row — visible in the stage's rules section, editable, and switchable off
like any other.

---

## 9. How to add, edit or remove a rule

**Add:** open the stage → **הוסיפו כלל** → pick *when* → pick *what* → fill in that action's fields
→ read the sentence the screen shows you → **שמור כלל**.

**Edit:** **עריכה** on the rule. Same form, same live sentence.

**Turn off without deleting:** the **כלל פעיל** (rule active) switch. A disabled rule never fires
and says so in its run log.

**Delete:** **מחיקה**, which asks for confirmation and quotes the rule's own sentence back to you so
you know which one you are removing.

### Two things to use before you trust a rule

- **בדיקה — dry run.** Pick a lead and see what the rule *would* do. It writes nothing, sends
  nothing, changes no lead and records no run. It checks what the rule would say to do, not the
  server actually doing it.
- **יומן הרצות — run log.** The last **50** runs for that rule, each with a status: *ממתין*
  (queued), *נשלח כרגע* (sending), *בוצע* (done), *נכשל* (failed), *דולג* (skipped). Skipped and
  failed runs keep their reason, which is where you look when something didn't happen.

---

## 10. Gotchas — the things that surprise people

- **Automations never run on the sample lead.** The demo lead created at signup is deliberately
  skipped; the run is recorded as skipped with the reason *"ליד לדוגמה"*. If you are testing rules
  with the sample lead, nothing will happen and nothing is broken. **Use a real lead.**
- **Nothing here moves a lead for you.** Ever. See "suggest a stage move" above.
- **Rules belong to a stage, not to the pipeline.** Retiring the stage suspends them.
- **Only the owner can change stages or rules.** Members can look.
- **Renaming a won or lost stage does not change how it behaves** — behaviour follows kind.
- **An archived stage cannot be brought back** in this version.
- **The signing secret is shown once.** There is no second chance to read it.

---

## 11. Where this lives in the code

For whoever maintains it next.

| Concern | File |
|---|---|
| Stage manager screen (9.1) | `client/src/app/features/settings/stages.*`, `stage-row.*`, `add-stage.*` |
| Rules UI (9.2–9.4) | `client/src/app/features/settings/automations-panel.*`, `automation-editor.*`, `automation-row.*`, `automation-run-log.*` |
| Hebrew strings for these screens | `features/settings/stages.copy.ts`, `features/settings/automations.copy.ts` |
| The one-sentence restatement | `describeAutomation()` in `features/settings/automations.copy.ts` |
| Webhook URL guard (client half) | `core/automations.rules.ts` |
| Stage state and writes | `core/stages.store.ts` |
| Rule state and writes | `core/automations.store.ts` |
| Stage table, constraints, seed | `client/supabase/migrations/20260804090000_pipeline_stages.sql` |
| New-tenant pipeline | `…20260804090100_stage_functions.sql` |
| Rules table, RLS, suspend-on-archive | `…20260804091000_automations.sql` |
| The engine: triggers, actions, cron sweep | `…20260804091100_automation_tier_a.sql` |
| Webhook delivery, signing, retries | `…20260804091200_automation_webhook.sql` |
| The default follow-up rule | `…20260804100000_default_followup_automation.sql` |

Key behaviours and where they are enforced, so nobody has to guess:

- "Arrives" rules fire from an `AFTER UPDATE OF stage_id` trigger on `leads`, in the same
  transaction as the move.
- "Sits still" rules are queued at arrival with a future `run_after` and fired by a **pg_cron job
  running every minute**.
- The demo-lead skip, the still-in-this-stage check, the disabled/suspended check and every action
  live in `fire_automation_run()` / `run_stage_automations()`.
- Pipeline shape (one open minimum, exactly one live won and lost) is asserted in the database, not
  in the client.
