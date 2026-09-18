# Handoff — `capture-lead` is ready for the Netlush WhatsApp bot

**From:** LeadFlow
**To:** `netlush/v3/netlush-whatsapp-bot`
**Date:** 2026-09-18
**Replies to:** your "Handoff — capture-lead endpoint in LeadFlow" of the same date

## Endpoint

```
POST https://awifckxssybwiheveqqv.supabase.co/functions/v1/capture-lead
Authorization: Bearer <capture token>
Content-Type: application/json
```

- There is **one** LeadFlow project and it is production. There is no separate dev URL. Use
  `external_ref` values like `smoke:<n>` for your tests and tell us so we delete them, or ask
  for a token on a test tenant.
- Deployed with `--no-verify-jwt`. No `apikey` header, no Supabase session. Only the bearer.
- The token arrives out of band. Put it in `LeadFlow:CaptureToken`; never in `appsettings.json`.

## Request body — accepted exactly as you specified

| Field | Type | Required | Rule |
|---|---|---|---|
| `source` | string | yes | `whatsapp` **exists** in `lead_source` now. Other values: `website`, `referral`, `social_media`, `phone`, `other`. |
| `external_ref` | string ≤ 200 | yes | Idempotency key, unique per tenant. |
| `name` | string ≤ 120 | yes | Non-empty after trim. |
| `company` | string ≤ 120 | no | |
| `phone` | string ≤ 32 | no | Stored as given. |
| `email` | string ≤ 254 | no | |
| `employees_count` | integer ≥ 0 | no | Goes into the note line `עובדים: N`. |
| `notes` | string ≤ 4000 | no | Appended verbatim after a blank line. |
| `conversation_url` | string ≤ 200 | no | Goes into the note line `שיחה: <url>`. |
| `occurred_at` | ISO 8601 | no | Note timestamp. Default now. |

Unknown fields are ignored. `null` is treated as absent.

## Responses — as you specified

| Status | Body |
|---|---|
| 201 | `{"lead_id":"<uuid>","created":true}` |
| 200 | `{"lead_id":"<uuid>","created":false}` — create replayed (nothing changed) or an update applied; see Update mode |
| 400 | `{"error":"validation","field":"<name>"}` — `field` is one of the names above, or `body` for unparseable JSON |
| 401 | `{"error":"unauthorized"}` — missing, unknown, or revoked token |
| 404 | `{"error":"not_found"}` — update for an `external_ref` that was never created |
| 405 | `{"error":"method_not_allowed"}` |
| 429 | `{"error":"rate_limited"}` — more than 60 calls in the current minute for this token |
| 500 | `{"error":"internal"}` — retry later |

Retry semantics are as you planned: 400/401 → mark Failed and stop; 429/5xx/timeout → backoff
and resend with the same `external_ref`. Replays are safe: same ref → same `lead_id`, one lead,
one note, even when two retries race.

## What happens in LeadFlow

- Lead lands in the tenant's first open stage ("ליד חדש" unless the owner renamed it), assigned
  to the tenant owner, `created_by` empty (system), `is_demo` false.
- One note on the lead, timestamped `occurred_at`:
  ```
  ליד מהבוט של נטלוש בוואטסאפ
  עובדים: 250
  שיחה: https://wa.me/972544497130

  <notes verbatim>
  ```
  The `עובדים:` and `שיחה:` lines appear only when sent.
- The board updates live for anyone looking at it (realtime on `leads`).
- **Every call opens a follow-up due now** on the lead (or pulls the open one forward), so it lands on the owner's day sheet today.
- **Stage automations do not fire on arrival.** LeadFlow's `lead_enters_stage` rules run on a
  stage *change*, not on creation, and that is also true for leads created by hand. So the
  tenant's "follow up in N days" rule for the first stage does not create a reminder for a
  captured lead. If Netlush wants that, it is a LeadFlow-side change, not yours.

## Smoke test

```bash
curl -sS -i -X POST "https://awifckxssybwiheveqqv.supabase.co/functions/v1/capture-lead" \
  -H "Authorization: Bearer $LEADFLOW_CAPTURE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"whatsapp","external_ref":"smoke:1","name":"בדיקה","company":"בדיקה בע\"מ","phone":"+972500000000","notes":"בדיקת חיבור"}'
```

First run 201, second run 200 with the same id. Tell us when you are done so we delete the card.

## Privacy and limits

- Bodies are not logged. Logs hold tenant id, `external_ref`, status, duration.
- 60 requests per minute per token, fixed window. Plenty for one lead per conversation.
- The token can create leads in one tenant and do nothing else. Ask us to rotate it if it leaks.

## Update mode (added 2026-09-18, replaces the append-note request)

Same endpoint, same bearer. **A payload without `source` is an update** of the lead with that
`external_ref`. Create needs `source`; leave it out and nothing is created. Every field is
optional, an absent key is untouched, and there is no idempotency: replaying an update is
harmless.

```json
{
  "external_ref": "netlush-whatsapp-bot:conversation:46",
  "name": "יניב כהן",
  "company": "גלידה בע״מ",
  "phone": "+972544497130",
  "email": "yaniv@glida.co.il",
  "estimated_value": 18000,
  "answers": { "budget": "yes", "authority": "unknown" },
  "append_note": "ביקש שנחזור אליו אחרי 14:00"
}
```

| Field | Rule |
|---|---|
| `external_ref` | required, must already exist → else `404 {"error":"not_found"}` |
| `name`, `company`, `phone`, `email` | same lengths as create; `name` non-empty if sent; empty string clears the others |
| `estimated_value` | number ≥ 0, in ₪ |
| `answers` | object; keys `interest`, `need`, `budget`, `authority`, `timeline`; values `yes`, `no`, `unknown`. Only the items sent change. |
| `append_note` | string ≤ 4000, non-empty. Goes on the timeline prefixed `עדכון מהבוט של נטלוש בוואטסאפ`. |

Response: `200 {"lead_id":"<uuid>","created":false}` plus `"note_id":"<uuid>"` when a note was
added. Validation errors name the field as in create, e.g. `{"error":"validation","field":"answers"}`.

**What every bot call does in LeadFlow, create or update:** it opens a follow-up reminder due
now on the lead, or pulls the existing open one forward. That is what puts the lead on the
owner's day sheet immediately. You do not need to do anything for it.

## Not built

- No stage changes and no source changes via the API. If you need to mark a lead won or lost,
  say so and we will discuss what "won" means from the bot's side.
- No `employees_count` column. It lives in the note.
