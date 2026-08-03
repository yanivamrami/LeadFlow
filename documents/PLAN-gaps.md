# Implementation plan — everything except reminders

> How to close each open item in `documents/GAPS.md`. Reminders (G-1…G-9, G-26) are owned by a
> separate workstream: `documents/PLAN-reminders.md`.
>
> Every file/line reference below was verified against the code on 2026-08-03.
> Order of work is at the bottom (§10).

---

## 1. G-18 — demo leads are counted in analytics

**The bug.** `PRODUCT.md:35` and `docs/ARCHITECTURE.md` §5 both promise demo leads are excluded
from analytics. `lead_stats` does not exclude them:

```sql
-- 20260803120000_stage_history_and_stats.sql:82
with mine as (
  select * from public.leads where tenant_id = p_tenant_id   -- ← no is_demo filter
),
```

Every figure on the insights screen is affected: `total`, `open`, `open_value`, every `reached`
bar, and the demo lead's `source` row. On a fresh account with one real lead, half the screen is
about a lead the user did not create.

**Fix.** One line, in a new migration (never edit an applied one):

```sql
-- <timestamp>_stats_exclude_demo_leads.sql
create or replace function public.lead_stats(p_tenant_id uuid)
returns jsonb language sql security invoker stable set search_path = '' as $$
  with mine as (
    select * from public.leads
     where tenant_id = p_tenant_id
       and is_demo = false          -- the whole fix
  ),
  ...
$$;
```

Copy the rest of the body verbatim from the existing migration. `create or replace` keeps the
grants, but the existing file already restates `revoke`/`grant` after the definition — do the
same, for the same reason it did.

**Also fix the stage-reach subquery.** `reached` correlates against `mine` for the current-status
half but hits `public.activities` directly for the history half — that half is not demo-filtered
either. Since it joins `mine l` on `a.lead_id = l.id`, the exclusion follows from `mine`
automatically. Verify with the SQL in `MANUAL-TESTS.md` §3 rather than by reading.

**Decide while you are here:** should the *dashboard* exclude demo leads too? No — the board is
where the demo lead does its job (a never-empty first screen), and it is visibly labelled. Only
analytics claimed to exclude it. Keep the asymmetry, and it is now written down.

**Size:** ~30 min including verification. **Test:** MANUAL-TESTS §3 twice — once with the demo
lead present, once after deleting it. Totals must differ by exactly one lead.

---

## 1b. G-26 — a note saved from the lead sheet does not clear the follow-up

**Confirmed to fix** (2026-08-03). Reminders are otherwise a separate workstream, but this bug
lives in `save_lead`, so it is tracked here.

**The inconsistency.** Same user action, two outcomes:

| Where the note is logged | Open reminder | Why |
|---|---|---|
| Day sheet action | **cleared** | `logActivity` calls `closeOpenReminders` (`leads.store.ts:401`, `:532`) |
| Lead sheet, one save | **left open** | `save_lead` inserts the activity and never touches `reminders` (`20260803093000_lead_write_rpcs.sql`) |

So a user who logs the call properly, on the lead's own screen, still sees the lead on tomorrow's
day sheet — and the app looks like it forgot.

**Fix — inside `save_lead`, not in the client.** The reason `save_lead` exists is that these
writes must not half-succeed; clearing the reminder from a second client call would reintroduce
exactly that. New migration, `create or replace`, adding one statement after the activity insert:

```sql
  if p_note is not null and btrim(p_note) <> '' then
    insert into public.activities (...) values (...);

    -- Logging real contact closes what was owed. Same rule as the day sheet's action.
    update public.reminders
       set done_at = now()
     where lead_id = p_lead_id
       and done_at is null;
  end if;
```

**Two rules that must hold, or this becomes a different bug:**
1. Only when a note was actually written. A save that just renames the lead must not clear a
   follow-up.
2. `type = 'status_changed'` never clears anything — the trigger writes those, not this branch,
   so it is already correct. Do not "improve" it into closing on stage moves: moving a lead to
   `proposal_sent` is not evidence anyone was contacted.

**Open question for the reminders workstream:** should logging a note of type `הערה` (a plain
internal note) clear the follow-up, or only `שיחה` / `אימייל` / `פגישה`? Writing "he asked me to
call back next week" is not contact. Recommendation: **clear on call/email/meeting only** — pass
`p_note_type` into the condition. It is one extra `and` and it is the more honest rule.

**Size:** ~1h with the type distinction. **Test:** MANUAL-TESTS S7, whose "known gap" note is
deleted when this lands.

---

## 1c. Reschedule picker on the day sheet (updates G-3)

**User decision, 2026-08-03:** `דחה ליום` (`copy.ts:185`) must open a **day-selection popup**, not
silently push to tomorrow.

This **overrides** `PLAN-reminders.md` §4.2, which argued the day sheet should stay one tap. The
reminders workstream owns the build; recorded here because the decision was made here.

**Today:** the button reads `דחה ליום` ("postpone by a day"), calls `store.snooze(leadId)`
(`leads.store.ts:408`), which hardcodes `+86_400_000` and toasts `נדחה למחר`. Honest, but the only
reachable date is tomorrow.

**Target behaviour**
1. Tap `דחה` → a small chooser opens **anchored to that row**, not a full-screen modal. The day
   sheet is the surface's thesis; covering it to reschedule one line is the wrong trade.
2. Options, in this order: **מחר** · **בעוד 3 ימים** · **בעוד שבוע** · **תאריך** (native
   `<input type="date">`, `min` = today) · cancel.
   - Three presets, because a fourth is a menu. The native picker for anything else, for the same
     reason SCREENS 2.8 chose a native `select` for the sort: on a phone the OS picker beats a
     custom one and is accessible for free.
3. The chooser is **one shared component**, in `shared/`, used by every `דחה` in the product.
   **Confirmed 2026-08-03: the row/card action menu's `דחה ליום` must behave identically to the
   day sheet's** — same chooser, same presets, same toast. Call sites:

   | Surface | Today | Notes |
   |---|---|---|
   | Day sheet item | `day-sheet.ts:64` → `store.snooze(id)` | anchors to the row |
   | **Register row menu** | `register.ts:71` → `store.snooze(id)` | shares `lf-lead-menu` with the board |
   | **Board card menu** | `board.ts` → `store.snooze(id)` | same component, so one change covers both |
   | Reminders list (4.1) | unbuilt | |
   | Lead detail (3.2) | unbuilt | |

   `lf-lead-menu` (`shared/lead-menu.ts`) already uses `cdkConnectedOverlay` with RTL-aware
   fallback positions and returns focus to its trigger on close — **build the chooser the same
   way and reuse those position arrays**, so a second overlay idiom does not appear in the
   product. Inside the menu, `דחה` stops being a `menuitem` that acts immediately and becomes one
   that opens the chooser; keep `Escape` closing both layers in order, innermost first.
4. `snooze(leadId)` gains a date argument. Keep a zero-argument fast path only if the design keeps
   a visible "tomorrow" affordance; otherwise delete it so there is one code path.
5. Toast names the date it landed on — `נדחה ל-12.8`, not `נדחה למחר`. A confirmation that does
   not name the outcome is decoration.
6. Guard the date store-side as well as with `min`: `min` is a hint, not a validator.

**Accessibility:** the chooser is a focus trap that returns focus to the row's button on close;
`Escape` cancels; every option ≥44×44. It must be operable with the keyboard alone, since it is
now on the product's most-used surface.

**Rename the button.** `דחה ליום` promises "by one day". Once the picker exists the label is
`דחה`, which is what `copy.ts:330` already uses for the reminders-list row.

**Size:** ~half a day for the shared chooser plus wiring the three callers.

---

## 1d. G-31 — `רשום פעילות` writes its own label as the note

**What it is meant to be:** "log activity" — the fast path for "I called them", so the lead's
last-touch resets, it leaves the day sheet, and the follow-up closes.

**What it actually does:** writes an activity whose **body is the button's own label**.

```ts
// register.ts:68  and  board.ts:58 — identical
this.store.logActivity(lead.id, COPY.menu.logActivity);   // body === 'רשום פעילות'
```

```ts
// day-sheet.ts:58 — the same shape, with the reason's verb
this.store.logActivity(item.lead.id, this.actionLabel[item.reason]);  // 'רשום פעילות' | 'חייג'
```

So the timeline fills with entries that read `רשום פעילות` and `חייג` — imperatives, addressed to
the user, dated as if they were a record of what happened. Its side effects are right (last touch
resets, the item clears, `closeOpenReminders` runs); only the content is a placeholder. Three
calls in a week produce three identical rows that say nothing, on the one screen whose entire job
is to say what happened. And it is silently lossy: the user believes they logged the call.

**Fix — the menu action opens the composer instead of writing.** The lead sheet exists now (3.2),
its composer has the four type chips and commits with the one save (3.5), so the honest action is
to route there with the composer focused: `/lead/:id`, then focus the textarea. Sequenced as
"open, type one line, save" it is two taps plus typing, versus one tap that records nothing
usable. Rename the menu item to match what it now does (`הוסף פעילות` / `רשום שיחה`).

**Day sheet is the one exception.** Its per-item button is the surface's whole gesture — one tap,
one-handed, thirty seconds — so it keeps writing without a form. Make what it writes true instead:
a body naming the contact type (`שיחה`) rather than the imperative verb, written as a typed
activity with `type` set accordingly, and let the timeline show the type rather than a sentence.
If a fuller note is wanted, the item's name already links to the lead.

**Do not** solve this by rewording `OPEN_ACTION` alone. A better-phrased placeholder is still a
placeholder; the difference between "you should call" and "a call happened" is the whole point.

**Size:** ~2h. **Test:** MANUAL-TESTS S7 gains a step — log from the row menu, then read the
timeline entry and ask whether it tells you anything.

---

## 1e. Checklist nudge — wire `מלא עכשיו` (SCREENS 2.6) · **DONE 2026-08-03**

**Why it was withheld, and why it is fine now.** The nudge shipped with only `לא עכשיו` because
the checklist had no screen: the only thing a "fill them in now" button could have done was mark
five questions answered without asking them, which is a lie about the user's own data. 3.4 exists
now, so the action can mean what it says — **take me to the questions**. It still never answers
anything. `COPY.nudge.fillNow` (`copy.ts:235`) had been sitting unused since; dead copy was the
tell that a decision was outstanding.

**What changed**

| File | Change |
|---|---|
| `core/notify.service.ts` | `nudge(message, dismissLabel, action?)` — takes the existing `ToastAction`. The stack template already rendered `action` alongside a sticky dismiss (`toast-stack.ts`), so no view change was needed. |
| `core/leads.store.ts` | Injects `Router` (only for this navigation). The stage-move nudge now carries `{ label: COPY.nudge.fillNow, run: → /lead/:id?at=checklist }`. |
| `features/lead/lead-sheet.ts` | New `at` input (query params bind as inputs — `withComponentInputBinding()` is already on), a `viewChild` on the checklist section, and a one-shot effect that lands there once the lead has loaded. |
| `features/lead/lead-sheet.html` | The checklist `<section>` gains `#checklist` and `tabindex="-1"`. |

**Three decisions inside it, so they are not undone by accident:**
1. **Focus lands on the section, not on the first answer.** A `role="radio"` receiving focus sits
   on `לא`, and one stray keystroke would answer a question nobody asked. Focusing the section
   announces the heading and the progress count, and the first Tab reaches the answers.
2. **The param is `at`, not `focus`.** `focus` as a component input name shadows a DOM concept for
   no benefit; `?at=checklist` also reads as a location, which is what it is.
3. **It waits for the lead to load.** The checklist does not render in create mode or before the
   read resolves, so the effect is guarded on `lead()` and runs once per arrival (`landed`).

Reduced motion gets an instant jump rather than a smooth scroll. The programmatic `focus()` does
not paint a ring on a click-driven activation because the global rule is `:focus-visible`
(`tokens.css:209`) — a keyboard-driven one does, which is correct.

**Verify:** MANUAL-TESTS S16. **Left alone:** `COPY.nudge.checklistBody` (`copy.ts:234`) is still
unused. It is a second sentence for a nudge that is deliberately one line; delete it or use it,
but do not leave a third state.

---

## 2. G-14 — deploy the `delete-account` Edge Function

The function is **already written** (`client/supabase/functions/delete-account/index.ts`) and is
sound: it rejects non-POST, requires an `Authorization` bearer token, resolves the user from the
*verified token* rather than the request body, and uses the modern secret key. Nothing to author
— this is purely a deploy.

### 2a. Supabase vs Firebase — the mental model

You have done this on Firebase, so the differences are the only interesting part:

| | Firebase Functions | Supabase Edge Functions |
|---|---|---|
| Runtime | Node.js (or Python) | **Deno** — web-standard APIs, `Deno.serve`, imports by URL (`jsr:@supabase/supabase-js@2`), no `package.json`, no `node_modules` |
| Where it runs | Google Cloud Functions | Deno Deploy edge network, per-project |
| Deploy unit | whole `functions/` dir, usually all at once | **one function at a time**, by folder name |
| Deploy command | `firebase deploy --only functions` | `npx supabase functions deploy delete-account` |
| Secrets | `functions:secrets:set` / runtime config | `npx supabase secrets set KEY=value` (project-wide, all functions) |
| Auth of the caller | you verify the ID token yourself | Supabase **verifies the JWT before your code runs** (`verify_jwt`, on by default), then you can re-check it |
| Auto-injected env | none | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` |
| Local run | emulator suite | `npx supabase functions serve` |
| Logs | Cloud Logging | dashboard → Edge Functions → Logs, or `npx supabase functions logs` |

Two things that bite people coming from Firebase:
1. **No build step and no bundler config.** Deno resolves imports at deploy. A typo in a URL
   import fails at deploy, not at runtime.
2. **`verify_jwt` is on by default**, so an unauthenticated call is rejected by the platform
   before your handler runs. That is *desirable* here — but it means a curl test without a token
   returns 401 from Supabase, not from your code, and that is not a bug.

### 2b. The actual steps (we will walk this together — do not run it solo the first time)

```bash
# from client/
npx supabase login                        # once per machine, opens a browser
npx supabase link --project-ref <ref>     # <ref> is in the dashboard URL; writes .temp/, gitignored
npx supabase functions list               # sanity: expect an empty list
npx supabase functions deploy delete-account
npx supabase secrets set SUPABASE_SECRET_KEY=sb_secret_…
npx supabase secrets list                 # names only, never values
```

### 2c. Two risks to check *at* deploy, not before

1. **The secret name may be rejected.** Supabase reserves the `SUPABASE_` prefix for
   auto-injected variables, and `secrets set` can refuse names starting with it. The function
   reads `Deno.env.get('SUPABASE_SECRET_KEY')` (`index.ts:41`). If the CLI refuses it, rename
   both sides to `LF_SECRET_KEY` — one line in the function, one in the command. Do **not**
   fall back to the auto-injected `SUPABASE_SERVICE_ROLE_KEY`: PRODUCT.md forbids introducing
   the legacy JWT keys, which are deprecated end of 2026.
2. **CORS is `Access-Control-Allow-Origin: '*'`** (`index.ts:24`). Fine for a dev project with
   JWT verification in front of it; tighten to the real origin before any prod deploy. Not a
   blocker now — noted so it is not forgotten.

### 2d. Verify it

1. Sign in as a **throwaway** account — this deletes the account and every lead in its tenant,
   and there is no undo.
2. Profile → delete account → the two-step confirmation (7.3) → confirm.
3. Expected: signed out, and signing in again fails. In SQL: the `auth.users` row is gone, and
   its `profiles`, `memberships`, `tenants`, `leads`, `activities`, `reminders` and
   `qualification_answers` rows are gone with it via cascade + the orphan-tenant trigger.
4. Check the function logs for the 200.

**Never test this on your own working account.**

**Size:** ~1h including the walkthrough and one real deletion.

---

## 3. G-23 — per-field tooltips on the lead form

PRD §2 asks for tooltips explaining each field's purpose. This is the guidance layer, on the
screen where a beginner most needs it, so it is the highest-value item in this file.

**Do not use a hover tooltip.** The primary device is a phone; hover does not exist there, and
`title` attributes are invisible on touch. Follow the pattern the checklist already established
(SCREENS 3.4): a small **"?" toggle beside the label** that reveals one line of help beneath the
field, one open at a time. `lead-sheet.ts` already has exactly this mechanic for the checklist —
`whyOpen` signal plus `toggleWhy()` (`lead-sheet.ts:130`, `:171`). Generalise it:

1. Rename/duplicate the pattern as `helpOpen = signal<FieldKey | null>(null)` in `lead-sheet.ts`.
2. Add `LEAD_FIELD_HELP: Record<FieldKey, string>` to `core/copy.ts`, next to `CHECKLIST_WHY`
   (`copy.ts:118`) which is the same idea for the same reason.
3. In `lead-sheet.html`, add the toggle to each of the seven field labels, `aria-expanded` on the
   button and `aria-controls` pointing at the help line. The help line is real DOM, not a
   `title`, so a screen reader gets it and a phone can show it.
4. `TextField` (`shared/text-field.ts`) may need a slot for the toggle. Prefer projecting it into
   the existing label rather than adding a second layout.

**Copy — one line each, plain Hebrew, no jargon:** name (the only required field, and why), phone
and email (why either is enough), company (when it matters), source (this is what the insights
screen reads later — the one field whose payoff is elsewhere), status (points at the stage
guidance already in `STATUS_GUIDANCE`), estimated value (a guess is fine; it drives "value in
play", not a promise).

**Size:** ~half a day, most of it copy. **Test:** MANUAL-TESTS §1 scenario S12.

---

## 4. G-27 — register ignores `?source=`

**Confirmed to fix** (2026-08-03).

**Where the link is**, since it is easy to miss: not the nav. The `תובנות` menu item goes to
`/insights` with no parameter. Inside that screen, the **source-breakdown table's first column**
is a set of links — each source *name* (`הפניה`, `אתר`, …) is an anchor
(`insights.html:110-118`) pointing at `/?source=<source>`. To see it: `/insights` → click a
source name → read the address bar, then count the leads on the board.

**Why the link exists** — do not close this gap by deleting it. The table answers "referrals
close best: 8 came in, 5 closed". The immediate next question is "which ones?", and this link is
the only path from the figure to the leads behind it. Remove it and the source breakdown becomes
a number you can read but not act on, which is the opposite of the PRD's "Actionable Performance
Analytics".

**What is wrong, plainly.** Clicking it goes back to the board, but the board never looks at the
address bar and the store has no source filter at all — only search and status
(`leads.store.ts:139`). So the user asks "show me my referral leads", the app navigates, and
shows **everything**. Nothing errors; the answer is just wrong. That is the worst kind of bug on
an analytics screen, because it looks like it worked.

**Fix, three small parts:**

1. **Store** — add `sourceFilter = signal<LeadSource | 'all'>('all')` beside `statusFilter`, one
   more `.filter()` in `visibleLeads` (`leads.store.ts:139`), include it in `isFiltered`
   (`:179`) so the no-results state and `clearFilters()` keep telling the truth, and count it in
   the stage-chip counts the same way status does.
2. **Dashboard** — read the query param once on init and push it into the store. Keep it a
   *signal from the route*, not a one-time snapshot read, or a second click on a different
   source from the insights screen (same route, new param) will not update.
3. **Register** — show a removable chip naming the active source filter. A filter the user cannot
   see is a filter they will not think to remove, and then the board looks broken.

Also handle the invalid case: `?source=nonsense` must fall back to `'all'` silently, never render
an empty board. Validate against the `LeadSource` union, exactly as `safeReturnUrl`
(`features/auth/validate.ts:41`) validates untrusted query input today.

**Alternative considered and rejected:** removing the link from the insights row. Cheaper, but it
deletes the one path from "referrals close best" to "here they are" — which is the whole point of
the source breakdown.

**Size:** ~2h. **Test:** MANUAL-TESTS §4.

---

## 5. G-24 — business / tenant name not editable

`tenants.name` is written once by the signup trigger and no screen can change it.
`updateDisplayName` (`supabase.service.ts:271`) updates the auth metadata and `profiles`, and
deliberately leaves the tenant alone.

**Fix.** One field on the profile screen (6.6), under the display name, labelled as the business
name, with the same save mechanics the display name already uses:

```ts
// SupabaseService
async updateTenantName(tenantId: string, name: string): Promise<void> {
  await this.run(this.client.from('tenants').update({ name: name.trim() }).eq('id', tenantId));
}
```

RLS already covers it — check `tenants_update` in the init migration and confirm it is
**owner-only**, not any member. If the policy does not exist or allows any member, that is the
real fix and it belongs in a migration: a member renaming the business is not a permission you
want to hand out by accident.

Where the name is displayed: the masthead shows the *user's* monogram, not the tenant, so nothing
visual depends on this yet. It matters for invites (8.3) and for anything a customer might see.

**Size:** ~1h including the policy check.

---

## 6. G-25 — no offline signal on the signed-out screens

The banner is inside `Shell`, which only renders behind `authGuard`, so `/auth/*` has no offline
state at all. With no network, a sign-in attempt surfaces one toast that says something generic —
and the user cannot tell "wrong password" from "no internet". That is the single worst moment for
this ambiguity, because the recovery actions are opposite.

**Recommended fix (small):** extract the banner's markup into a standalone
`shared/offline-banner` component reading `NotifyService.online` — the service already tracks it
with `window` listeners and exposes `online` / `reconnected`, and it is root-provided so it works
outside the shell. Render it in `AuthPage` (`features/auth/auth-page.ts`), which every signed-out
screen already wraps itself in, so all four get it from one change. `Shell` keeps its copy in
place under the masthead.

**Also (cheap, do it at the same time):** when a submit fails while `online()` is false, say so
explicitly instead of the generic message. `NotifyService.blockedOffline()` already exists for
writes — the auth screens should use the same words rather than inventing a third phrasing.

**Rejected:** moving the banner above the router outlet globally. It would sit above the masthead
instead of under it, which contradicts the design (SCREENS 1.7) for every signed-in screen —
paying for four screens with a regression on thirty-two.

**Size:** ~2h.

---

## 7. G-19 / G-20 — privacy notice and terms

Deferred until just before a real user other than you, but here is the shape so it is not a
scramble later.

- **Two routes inside `Shell`**, plus links from sign-up (above the commit band) and from the
  profile screen. Reachable **without** an account too — a privacy notice you must sign up to
  read is not a notice.
- **Privacy must answer, in Hebrew, concretely** (ARCHITECTURE §9, Amendment 13): what personal
  data is stored — including *lead* data, which is third-party personal data the user is the
  controller of; why; where it physically lives (name the Supabase region); who can see it (RLS
  per tenant, no cross-tenant access); how long it is kept; how deletion works (point at 7.3 and
  say the cascade removes leads with the account); and who to contact.
- **Do not draft the legal text and ship it unreviewed.** Draft it, then have it checked. The
  screens and links are the engineering deliverable; the wording is not.
- **Terms** can be short for a free tool with no paid tier (PRODUCT.md:69): no warranty, no
  liability for lost data, account termination, governing law.

**Size:** ~half a day of engineering, unknown for review.

---

## 8. G-21 / G-22 / G-28 — deferred, and what unblocks them

| Item | Blocked on | First step when it comes back |
|---|---|---|
| G-21 email confirmation landing | An SMTP sender (G-15) | Set `enable_confirmations = true` in `config.toml:226`, then build the landing route; sign-up's `emailNotConfirmed` branch becomes reachable and must be tested for the first time. |
| G-22 tenant switcher | Invites (8.3) | Replace `.limit(1)` tenant resolution (`leads.store.ts:232`) with a real selection persisted per user. Do this **first** — it is the actual bug the switcher exposes: with two memberships, today's code picks arbitrarily. |
| G-28 OAuth | A decision that it matters | Enable one provider in `config.toml`, add a callback route, add provider buttons to 6.1/6.2. Until then, stop describing auth as "OAuth-ready" in docs where a reader will hear "OAuth works". |

---

## 9. G-29 — the toast rule (closed, no work)

The impeccable detector flags `border-inline-start: 4px solid` on the toast
(`toast-stack.ts:93`) as the side-tab-accent anti-pattern. **It is a false positive.** Justified
in full in `GAPS.md` §5: the design system specifies that exact rule three times, `4px` is the
system's own section-rule width, and every kind carries a Lucide mark so colour never signals
alone. Action: suppress the finding for `lf-toast-stack` so each audit does not re-raise it.

---

## 9b. G-30 — stale statements in the docs

**SCREENS.md: done 2026-08-03.** Fourteen rows plus the §6 footer, the count table and the
closing paragraph were reconciled against the code. What was wrong there: three surfaces
described as unable to open lead detail when all three link to it, two actions described as
having no target when both route to `/lead/new`, the toast finding still framed as undecided, a
count of 32 built screens after §4's three landed, and a "nearest useful next screen"
recommendation naming a screen that was already built.

**Still open — `PRODUCT.md:73`:** claims the app "runs the dashboard route against authored demo
data in `client/src/app/core/demo-leads.ts` — no Supabase connection yet". That file does not
exist and the store reads the cloud dev project. The same paragraph's ER-model sentence is
accurate; only the demo-data clause needs replacing.

**Do this on every doc pass, not as a project:** the failure mode is not a wrong sentence, it is
a reader who stops trusting the file and re-derives everything from code — at which point the
docs cost more than they save.

**Size:** 5 min for what remains.

---

## 10. Order of work

| # | Item | Size | Why here |
|---|---|---|---|
| 1 | **G-18** demo leads in analytics | 30 min | One line, and every insights number is wrong until it lands. Do it before validating the numbers by hand, or you will validate the wrong thing. |
| 1b | **G-26** `save_lead` leaves the follow-up open | 1h | Same migration pass as G-18 — two `create or replace` functions, one review. |
| 1c | **G-31** `רשום פעילות` writes a placeholder note | 2h | Every use of the menu until this lands puts a junk row in a lead's history, and history is not editable. |
| 1d | **Reschedule chooser** (updates G-3) | half day | Shared component, four call sites. Reminders workstream builds it; the row menu wiring is here. |
| ~~1e~~ | ~~**Checklist nudge action** (SCREENS 2.6)~~ | ~~done~~ | Shipped 2026-08-03. Verify with S16 on the manual round. |
| 2 | **G-16/G-17** run the manual tests | 2–3h | `MANUAL-TESTS.md`. Fourteen screens nobody has opened; whatever it finds reorders everything below. |
| 3 | **G-27** `?source=` filter | 2h | An analytics answer that is silently wrong. |
| 4 | **G-23** field tooltips | half day | The product's positioning, missing from its most important form. |
| 5 | **G-14** deploy `delete-account` | 1h | Walk the deploy together; the code is already written. |
| 6 | **G-25** offline on auth screens | 2h | Small, and removes a genuinely confusing moment. |
| 7 | **G-24** editable business name | 1h | Includes an RLS policy check worth doing anyway. |
| 8 | **G-19/G-20** privacy + terms | half day | Before any user but you. |

Deferred, no action: G-13, G-15, G-21, G-22, G-28. Closed: G-9, G-11, G-12, G-29.
Reminders (G-1…G-9, G-26): separate workstream.
