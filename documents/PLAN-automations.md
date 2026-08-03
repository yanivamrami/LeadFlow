# Implementation plan — Phase 2: per-stage automations

> When a lead enters a stage, do something. This phase builds **three action types** —
> reminder, internal (assign / note / auto-advance) and webhook. **Email and WhatsApp are
> specified in §9 and deliberately not built**; each has a prerequisite outside this codebase.
>
> Depends on `documents/PLAN-stages.md` shipping first: an automation attaches to a stage row, so
> stages must be rows.
>
> Written against the code as of 2026-08-03. Nothing here is built yet.

---

## 1. The decision this plan turns on

**Only actions that leave the database need a worker.**

This sounds obvious and it changes the whole shape of the phase. A reminder is
`insert into public.reminders`. An assignment is `update public.leads set assigned_to`. A note is
`insert into public.activities`. All three are already transactional, already RLS-covered,
already re-read by the client, and can run **inside the same trigger that detects the stage
change**. No queue, no Edge Function, no retries, no secrets, no cron.

A webhook is an HTTP call to a host you do not control. It can time out, it can be slow, it can
be down for an hour, and it must never hold a database transaction open while it finds out.
*That* is what needs the outbox, the worker and the retry policy.

So the phase splits cleanly, and the cheap half is genuinely cheap:

| Tier | Actions | Infrastructure | Effort |
|---|---|---|---|
| **A — in-database** | reminder, assign to member, add note, auto-advance after N days | A trigger, plus `pg_cron` for the delayed variants | ~2-3 days |
| **B — leaves the box** | webhook | Outbox table, `pg_net` sender, retries, dead-letter, URL guard, HMAC signing, run log | ~3-4 days |

Ship A first and it is a real feature on its own. B is what makes the *next* channel — email,
then WhatsApp — a day's work instead of a fortnight's, because they are then just another
`action_type` on a spine that already retries and logs.

### And no Edge Function, in either tier

**Nothing in this phase needs one.** Tier A is plain SQL in a trigger. Tier B needs to make an
outbound HTTP call, and Postgres can do that itself: `pg_net` queues the request and a background
worker sends it, so the transaction never waits on a remote host — the same property an Edge
Function would have provided, with no second runtime, no deploy step, and no secrets living
somewhere else. `pg_cron` handles the sweeps. HMAC signing is `pgcrypto`'s `hmac()`.

Both extensions ship with Supabase and enable with one `create extension`; `config.toml:15`
already carries `extensions` on the search path. **Confirm they are available on the dev project
before planning around them** — that is a dashboard check, not an assumption to build on.

What this buys, beyond the two days: `ARCHITECTURE.md` §6's "no server logic exists" stays true
through this phase, and the undeployed-function debt (G-14) stays a 7.3 problem instead of
becoming this feature's blocker.

**What it costs, stated plainly.** `pg_net` cannot resolve a hostname before sending, so the URL
guard in §2 is a *string* check, not an IP check — a user who points a webhook at a domain whose
DNS answers with `169.254.169.254` gets a request from our infrastructure to somewhere it should
not reach. Today that is close to theoretical: the only person who can create an automation is a
tenant owner pointing at their own endpoint, so they would be attacking themselves. **It stops
being theoretical the moment strangers are tenants**, and that is the trigger to move tier B's
sender into an Edge Function that resolves and validates first. Recorded as a condition, not a
someday: **before the first external tenant, tier B moves to a function or webhooks get an
allowlist.**

Two other things `pg_net` does less well, neither blocking here: the response body is awkward to
keep (rows in `net._http_response` are reaped on a schedule), so store only what the run log
needs; and redirect behaviour needs verifying rather than assuming — if it follows them, the
string guard is bypassable and redirects must be refused explicitly.

### What would actually force an Edge Function

Not sending. **Receiving.** A public HTTP endpoint is the one thing Postgres cannot be, and three
future things need one:

| Needs an inbound endpoint | Why |
|---|---|
| Email bounce and complaint handling (G-35) | The provider POSTs to us. Without it a dead address retries forever. |
| WhatsApp delivery receipts and inbound messages (G-36) | The 24-hour customer-service window opens on *their* message, so we must be told it arrived. |
| Public capture form (SCREENS 8.2) | Already listed in ARCHITECTURE §6 as `capture-form`. |

So the honest sequencing is: **outbound needs no function; inbound does.** Both deferred channels
in §9 need inbound eventually, which is another reason they are separate projects rather than two
more rows in the action enum.

**Second decision: rules reference `stage_id`, and archiving a stage disables its rules loudly.**
Not silently, not by cascade. The stage manager must say `2 אוטומציות מושהות` when you archive a
stage, and the automations list must show them as suspended rather than deleted. A stale
automation firing on a renamed stage is the single fastest way to lose a user's trust in this
whole feature.

---

## 2. Data & backend

### Tables

```sql
create type public.automation_trigger as enum (
  'lead_enters_stage',      -- fires on the stage move itself
  'lead_idle_in_stage'      -- fires N days after entering, if still there
);

create type public.automation_action as enum (
  'set_reminder', 'assign_member', 'add_note', 'suggest_advance', 'webhook'
  -- 'send_email', 'send_whatsapp' — added when §9 is built, not now
);

create table public.automations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  stage_id      uuid not null,
  trigger       public.automation_trigger not null,
  idle_days     integer,                 -- required when trigger = 'lead_idle_in_stage'
  action        public.automation_action not null,
  config        jsonb not null default '{}'::jsonb,   -- per-action, validated in §2.3
  enabled       boolean not null default true,
  suspended_at  timestamptz,             -- set when its stage is archived; not the same as disabled
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint automations_stage_fkey
    foreign key (stage_id, tenant_id)
    references public.pipeline_stages (id, tenant_id) on delete restrict,

  constraint automations_idle_days_ck
    check ((trigger = 'lead_idle_in_stage') = (idle_days is not null))
);

create table public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.automations (id) on delete cascade,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  lead_id         uuid not null,
  status          text not null,          -- queued | done | failed | skipped
  attempt         integer not null default 0,
  skip_reason     text,                   -- why nothing happened; shown in the run log
  error           text,
  run_after       timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- The idempotency key. One automation fires at most once per lead per stage entry, even if
  -- the trigger runs twice or the worker retries after a partial failure.
  idempotency_key text not null unique,

  constraint automation_runs_lead_fkey
    foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete cascade
);

create index automation_runs_pending_idx
  on public.automation_runs (run_after)
  where status = 'queued';
```

`idempotency_key` is `automation_id || ':' || lead_id || ':' || <the activities.id of the stage
move>`. The stage-move activity row already exists — `log_lead_status_change` writes one on every
move (`init_schema:370-393`) — so it is a natural, unique, already-persisted identity for "this
entry into this stage". Re-entering the same stage later is a different activity row, so the
automation fires again, which is correct.

RLS on both tables: read for members, write for **owners only**, matching the stage table's
deviation in `PLAN-stages.md` §2. `automation_runs` gets **no insert or update policy at all** —
only the trigger and the worker write it, both `security definer`. A client that could forge a
run row could make the product send a webhook of its choosing.

### Execution — tier A

Extend the stage-change trigger (or add a second `after update of stage_id` trigger, which keeps
the audit trigger simple and independently testable). For each enabled, unsuspended automation
on the new stage:

- `trigger = 'lead_enters_stage'` and action is a tier-A action → **do it now**, in this
  transaction, and write an `automation_runs` row with `status = 'done'`.
- `trigger = 'lead_idle_in_stage'` → write `status = 'queued'`, `run_after = now() + idle_days`.
- action is tier B (`webhook`) → write `status = 'queued'`, `run_after = now()`.

Doing tier A inline means a rolled-back stage move sends nothing — the property an outbox exists
to buy, obtained for free.

**One cron job** (`pg_cron`, in-database, no Edge Function) sweeps queued tier-A rows whose
`run_after` has passed, re-checks the precondition (**is the lead still in that stage?** if not,
`status = 'skipped'` with a reason) and performs the action.

### Execution — tier B

A `pg_cron` job every minute runs a `security definer` function that claims work with
`for update skip locked`, so two overlapping ticks cannot double-send:

```sql
with claimed as (
  update public.automation_runs
     set status = 'sending', attempt = attempt + 1
   where id in (select id from public.automation_runs
                 where status = 'queued' and run_after <= now()
                 order by run_after limit 20
                 for update skip locked)
  returning *
)
select net.http_post(
         url     := …,
         body    := payload,
         headers := jsonb_build_object(
                      'content-type', 'application/json',
                      'x-leadflow-signature',
                      extensions.hmac(payload::text, secret, 'sha256')),
         timeout_milliseconds := 10000)
  from claimed;
```

`net.http_post` returns a request id, not a result — the send is asynchronous by design, which is
exactly why the transaction is safe to commit. A second cron job reconciles: read
`net._http_response` by request id, mark `done` on 2xx, `failed` otherwise, and re-queue with
backoff (1m, 5m, 30m, 2h) up to attempt 5, then dead-letter with the error kept. Store the request
id on the run row so the reconciler can find it.

Two failure modes this shape must handle and an Edge Function would not have: a response row that
never appears (reaped, or the request never completed) — so a `sending` row older than 15 minutes
is treated as failed and re-queued; and the fact that attempt counting happens at claim time, so a
crash between claim and send costs one attempt rather than duplicating a send. That trade is the
right way round.

### Webhook safety

| Risk | Mitigation | Good enough? |
|---|---|---|
| **SSRF** — a URL resolving to loopback, link-local (`169.254.169.254`) or a private range, using our egress to reach what the caller cannot | String-level guard at save time: HTTPS only, reject literal private/loopback/link-local addresses and obvious hostnames. **`pg_net` cannot pre-resolve DNS**, so a hostname whose A record points inward is not caught. | **No, eventually.** Acceptable while the only author is a tenant owner targeting their own endpoint. Before the first external tenant: move the sender to an Edge Function that resolves first, or restrict to an owner-confirmed host allowlist. Tracked as a release condition in §1. |
| Redirects bypassing the guard | Refuse redirects. **Verify `pg_net`'s default behaviour before relying on it** — if it follows, a 302 to `127.0.0.1` defeats the string guard entirely. | Yes, once verified. |
| Receiver cannot verify the call came from us | HMAC-SHA256 over the raw body in `X-LeadFlow-Signature`, per-automation secret shown **once** at creation. `pgcrypto`'s `hmac()`. | Yes. |
| Replay | Signed timestamp in the payload; document a 5-minute tolerance. | Yes. |
| A slow endpoint stalling everything | `timeout_milliseconds := 10000`, 20 rows per tick, per-tenant cap per minute. `pg_net` sends on a background worker, so a slow host never blocks a user's transaction. | Yes. |
| Secret leakage | Supabase Vault, referenced by name from `automations.config` — never the secret itself in a column the client can select. Enabling Vault is a `config.toml:56` change that is currently commented out. | Yes. |
| Personal data leaving the tenant | Lead data going to a third party the user chose. Must appear in the privacy notice (G-19), and the run log records **what** was sent, not merely that something was. | Yes, with G-19 done. |

### Loop guard

`suggest_advance` writes only a note, so nothing in this phase moves a lead. The guard exists for the future: an action that DID move one would fire the trigger again. Cap the chain at **depth 1**: a run
created by an automation is marked as such, and automations do not fire for a move that an
automation performed. Without this, two stages that advance into each other are an infinite loop
that writes activity rows until something breaks.

### Never fires

Demo leads (`leads.is_demo`), bulk backfills, and any move performed by a migration. A demo lead
firing a real webhook on the user's first run would be indefensible.

---

## 3. Actions in scope, precisely

| Action | `config` | Notes |
|---|---|---|
| `set_reminder` | `{ days: int, title?: string }` | `insert into public.reminders`, 09:00 local on the target day, `assigned_to` = the lead's assignee or the mover. Honours the one-open-reminder-per-lead rule that `save_lead` already enforces — reschedules rather than duplicating. |
| `assign_member` | `{ user_id: uuid }` | Validate membership in the tenant at save time **and** at fire time. Effectively inert until invites (8.3), and worth building anyway because it is three lines on the spine. |
| `add_note` | `{ body: string }` | `insert into public.activities (type='note')`. Author is the automation, which the timeline must say plainly — an automated note that looks hand-typed is a lie about the record. |
| `suggest_advance` | `{ stage_id: uuid }` | **Offers** the move, never performs it — the user decided this on 2026-08-03. Implemented as a Hebrew note proposing the change; `leads.stage_id` is deliberately not written. Usually paired with `lead_idle_in_stage`. |
| `webhook` | `{ url, secret_ref }` | Payload: event, tenant, lead (id, name, company, stage before/after, source, value), timestamp. No checklist answers and no activity bodies — those are the most sensitive fields in the product and no integration needs them by default. |

---

## 4. Screens

### 9.2 Automations on a stage

Lives **inside the stage manager** (`PLAN-stages.md` §5), as an expandable section per stage
rather than a separate route. The mental model is "this stage does this", and splitting it across
two screens breaks that.

Per rule, one line: trigger, action, a plain-Hebrew summary (`כשליד מגיע לשלב הזה — קבע תזכורת
ל‑3 ימים`), an enabled toggle, and edit. Suspended rules are visibly suspended, with the reason.

### 9.3 Rule editor

In-place expansion, not a modal — the pattern 3.6, 3.7 and 4.2 already set. Trigger first, then
action, then the action's own fields. Every rule ends with a full-sentence Hebrew restatement of
what it will do, because a rule the user cannot read back is a rule they will not trust.

### 9.4 Run log

Per automation, last 50 runs: when, which lead, `done` / `failed` / `skipped`, and for skipped
the reason in words (`הליד כבר לא בשלב הזה`). **Not optional.** An automation with no visible
history is a support burden with a UI, and the run log is also the only place a user can discover
that their webhook endpoint has been failing for a week.

### Dry run

`בדוק` on any rule: executes against a lead of the user's choosing in a mode that reports what
*would* happen and writes nothing — except a `skipped` run row saying it was a test. An
automation you cannot test before pointing it at real clients is a liability.

---

## 5. Tests

- Idempotency: the same `(automation, lead, stage-entry activity)` inserted twice → one run row,
  the second rejected by the unique index rather than by application logic.
- Precondition re-check: a `lead_idle_in_stage` rule whose lead has since moved → `skipped`, with
  a reason, and no write.
- Loop guard: two stages that advance into each other → exactly one move, then stop.
- Suspension: archiving a stage suspends its rules; unarchiving does **not** silently re-enable
  them (the user re-enables deliberately).
- SSRF guard as a pure function of a URL string → allowed | rejected-with-reason. Cover
  `localhost`, `127.0.0.1`, `10.x`, `192.168.x`, `169.254.169.254`, `http://`, and a redirect to
  any of them.
- HMAC signature computed over the exact bytes sent, verified by an independent implementation in
  the test rather than by the same helper that produced it.
- Demo leads never fire.

---

## 6. Order of work

| Step | Delivers | Size | Why here |
|---|---|---|---|
| 1 | `automations` + `automation_runs`, RLS, indexes, idempotency key | half day | The shape. |
| 2 | Tier-A trigger: `set_reminder`, `add_note`, `assign_member` on `lead_enters_stage` | 1 day | A real feature, no new infrastructure, and it proves the trigger path. |
| 3 | Editor + list inside the stage manager (9.2, 9.3), for tier A only | 1.5 days | Users can build rules. Shippable here. |
| 4 | `pg_cron` sweep + `lead_idle_in_stage` + `suggest_advance` + loop guard | 1 day | Adds the delayed trigger. First extension enabled. |
| 5 | Run log (9.4) + dry run | 1 day | Before webhooks, not after — the first time something fails, this is what the user needs. |
| 6 | Outbox sender: `pg_net`, claim / reconcile / retry / dead-letter | 1 day | No deploy, no second runtime. Verify `pg_net` and redirect behaviour on dev first. |
| 7 | `webhook` action: URL guard, HMAC, Vault secret, payload contract | 1.5 days | Riding the spine from step 6. |
| 8 | Specs, docs, manual round | 1 day | Includes the privacy-notice consequence: a third-party data flow now exists. |

**~8 days**, of which steps 1-5 (~5 days) deliver a complete, useful feature with **no extension
beyond `pg_cron`, no deploy, and no outbound traffic at all**. That is the natural place to stop
and ship.

---

## 7. What this drags in beyond code

- **ARCHITECTURE §6 needs a smaller amendment than first thought.** "No server logic exists"
  stays true — nothing here deploys. What changes is the extension list (`pg_cron`, `pg_net`,
  `pgcrypto`, Vault) and the fact that the database now makes outbound calls, which §6 does not
  currently contemplate. The Edge-Functions-vs-.NET decision recorded there remains unexercised,
  and §6.1's note that a scheduled job is only justified when a reminder must reach someone not
  looking at the app is worth re-reading before enabling `pg_cron`: this phase justifies it,
  reminders did not.
- **Deploy debt stays where it is.** `delete-account` is still written-and-undeployed (G-14) and
  this phase does not make that this feature's blocker. Good — it means G-14 can be solved on its
  own schedule instead of gating automations.
- **The privacy notice (G-19) becomes load-bearing.** A webhook sends lead data to a third party.
  Amendment 13 expects that disclosed.
- **Support surface.** "Why did my client get two messages?" is answerable only if the run log
  exists, which is why it is step 5 and not step 9.
- **One release condition, not a someday.** Before the first external tenant, tier B's sender
  moves to a function that resolves DNS, or webhook hosts get an allowlist. §1 and §2 both say so;
  it belongs on whatever list gates that release.

---

## 8. Definition of done (this phase)

- A rule created on a stage fires on the next move into it, once, and its run appears in the log.
- Rolling back a stage move sends nothing — verifiable by forcing a failure in the same
  transaction.
- A webhook to a literal private IP or a non-HTTPS URL is refused with a readable reason at save
  time, not at fire time. A hostname that *resolves* inward is knowingly not caught — see the
  release condition in §1.
- `pg_net`'s redirect behaviour was checked on dev, not assumed, and redirects are refused.
- A `sending` run whose response never arrives is re-queued rather than left hanging.
- Archiving a stage suspends its rules and says so in the stage manager.
- Demo leads never fire an automation.
- No automation can be created, edited or run by a non-owner member.
- Verified at 390px and desktop.

---

## 9. Deferred channels — specified, not built

Both are entered in `documents/GAPS.md` so they are tracked rather than remembered. Each becomes
one new `automation_action` value plus a worker branch **once its prerequisite is met** — the
spine from steps 6-7 is what makes them small.

### 9a. Email (GAPS G-35) — deferred

**Prerequisite: an SMTP or transactional sender, which the product already lacks** (G-15 blocks
password reset, email confirmation and email change today). Solve it once, for all four.

When picked up: a provider (Resend / SendGrid / Brevo) with a verified sending domain, SPF +
DKIM + DMARC, a per-tenant from-name, tenant-authored templates with lead-field placeholders,
plus bounce and complaint handling — a hard bounce must disable the rule rather than retry it
forever. Unsubscribe handling depends on whether the message is transactional or advertising,
which is the same question §9b turns on.

**Estimate once the sender exists:** 3-5 days. Not before.

### 9b. WhatsApp (GAPS G-36) — deferred, and a separate project

**Prerequisite: a legal decision, taken before any code.**

The technical work is ordinary: Meta Cloud API or a BSP (Twilio / 360dialog), business
verification, a WABA and a dedicated number, then message templates **pre-approved by Meta** —
outside a 24-hour window opened by the *recipient's* message, only approved templates may be
sent. Approval latency is not ours to control, so the UI must handle "rule enabled, template
rejected". Every message costs money, which changes the product's pricing model, not just its
code.

The hard part is not that. **The recipients are leads — people who gave a phone number to get a
quote, not to be messaged automatically.** Israel's anti-spam regime (תיקון 40 to the
Communications Law) requires prior consent for advertising messages and has produced class
actions with per-message statutory damages. Whether a given automated message is *advertising* or
a *service message* is a lawyer's call, not an engineer's, and the answer determines the design:
if consent is required, then consent capture becomes a field on the lead form, a filter on every
send, and a column in the audit log — which reaches back into Phase 1's territory and into
screens that are already built.

**Do not start this without counsel.** Sequence when it happens: legal opinion → consent capture
in the lead form and privacy notice → BSP contract and template approval → the channel itself.
The channel is the smallest part.

**Estimate:** 2-4 weeks, most of it not code, and it should not be scheduled against the same
calendar as the rest of this plan.

---

## 10. Open questions (PM, not engineering)

1. ~~**Does `advance_stage` belong in v1 at all?**~~ **DECIDED 2026-08-03: offer, never perform** — shipped as `suggest_advance`. Original argument kept: It is the only action that changes the pipeline
   on the user's behalf, and this product's stated principle is advisory-never-blocking. A rule
   that silently moves leads is the closest thing here to a gate. Alternative: it *offers* the
   move on the day sheet instead of performing it — which is also the answer to
   `PLAN-reminders.md` §11 question 3, and the two should be decided together.
2. **Per-tenant automation cap.** Unbounded rules on a stage is a footgun and a cost. Ten per
   stage, thirty per tenant, would be invisible to a real user.
3. **Webhook payload contract, versioned from day one?** A `version` field costs nothing now and
   is impossible to add politely once integrations exist.
4. **Does a suspended rule stay suspended forever?** This plan says un-archiving a stage does not
   auto-re-enable its rules. Deliberate, and worth confirming: the alternative surprises people.
