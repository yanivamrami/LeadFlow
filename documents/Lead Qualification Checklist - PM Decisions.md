# Lead Qualification Checklist — PM Decisions

**Date:** 2026-08-02
**Context:** The PRD mentions the qualification checklist only once (User Workflow, step 2 "Qualify": *"guide users on how to assess a lead's potential, perhaps with a checklist or suggested questions"*). This document records the product decisions that flesh out that requirement, anchored to the PRD's core identity: beginner audience, guidance-first, forgiving UX.

---

## 1. What "qualified" means / minimum bar to leave "New"

The target user is a freelancer or small business owner with no sales training. "Qualified" must mean: **had real contact + confirmed genuine interest worth pursuing**. Minimum before leaving "New":

- At least one interaction logged (call/email/meeting) — ties into the Activity Log pillar
- Qualification questions answered (even partially)

Do not demand full BANT. Beginners don't know budget on the first call. The bar is "you talked to them and they're not junk," not enterprise-grade qualification.

## 2. Fixed vs. user-editable checklist

**V1: fixed checklist, not editable.** Reasons:

- The audience doesn't know what good qualification looks like — that's why they need the app. An editable checklist for someone who has never qualified a lead recreates the blank-page problem, the same reason they left spreadsheets.
- A fixed list is teachable, consistent, and analytics-comparable later (see §5).
- Editing means settings UI, per-user schema, migration headaches — cost with negative value for beginners.

V2: allow adding custom items, never deleting the core items. Backlog item; do not build now.

## 3. Question set — keep / cut / add

The proposed baseline (budget / decision maker / need fit / timeline) is BANT — correct framework, wrong wording for this audience.

| Item | Verdict | Beginner-friendly phrasing |
|---|---|---|
| **Interest confirmed** | **Add as #0** | "Did they respond / show real interest?" — filters dead leads before the other questions even matter |
| Need matches offering | Keep, move to #1 | "Do they actually need what you offer?" |
| Budget exists | Keep | "Can they afford it?" (rough sense, not an exact number) |
| Decision maker identified | Keep | "Are you talking to the person who decides?" |
| Timeline defined | Keep | "Do they want it soon, or 'someday'?" |

Cut nothing. Five items is the ceiling — six or more creates friction and beginners abandon the flow.

Order matters: need first (easiest for a beginner to answer), budget/authority after. Classic BANT order is optimized for enterprise sales reps, not solo freelancers.

## 4. Blocking vs. advisory

**Advisory. Firm on this.** The PRD explicitly promises a "forgiving user experience" — a hard gate contradicts it. Beginners often qualify in one call and want to jump straight from "Contacted" to "Qualified"; blocking means they fight the tool, which means churn.

Design: leads move freely between stages. If items are unchecked at the moment of a move, show a gentle nudge — "2 questions unanswered — want to fill them in now?" — with a skip option. A nudge is a teaching moment (supports the Process Adherence success metric); a gate is a punishment.

## 5. Stored per lead vs. on-screen prompt

**Stored per lead.** Three reasons:

- PRD pillar 4 is Actionable Performance Analytics. Stored answers unlock the killer educational insight later: "Leads with confirmed budget close 3× more often" — exactly the "educational insights" the PRD promises.
- Visible in lead detail, the user sees *why* a lead is where it is, weeks later.
- An ephemeral prompt throws data away; storage cost is trivial. Model each answer as a tri-state (yes / no / unknown) plus timestamp. Tri-state matters — "no" and "haven't asked yet" are different signals.

This also matches the "reasons for lost leads" pattern the PRD already defines at the Close stage — same data-capture philosophy.

## 6. Differ by lead source?

**No — uniform in V1.** A referral vs. a website lead differs in *trust level*, not in *what makes them qualified* — need/budget/authority/timeline apply to both. Per-source checklists add matrix complexity, confuse beginners ("why did the questions change?"), and have zero PRD support. Source is already captured as a field — analytics can slice qualification-vs-source later without checklist branching. Revisit only if usage data shows demand.

## 7. Copy tone

**Warm-instructional, not teacherly.** The PRD's own example copy sets the tone ("New Lead: Time to qualify!") — encouraging, with exclamation points. But draw a distinction:

- **Status nudges / empty states:** energetic is fine ("Time to qualify!").
- **Checklist items themselves:** plain conversational questions ("Are you talking to the decision maker?") — not "Time to check budget! 🎉".

Reason: the user hits the checklist on every lead, many times per week. Cutesy copy is charming on day 1 and grating by week 3. Guidance text *around* the checklist can teach ("Why ask? Deals without a budget stall."); the questions themselves stay neutral. The PRD targets small business owners — beginners at *lead management*, not children.

---

## Summary of decisions

Fixed 5-item checklist (interest → need → budget → authority → timeline), tri-state answers stored per lead with timestamps, advisory not blocking (nudge on stage move), uniform across lead sources, conversational-neutral question copy with warm guidance around it. All V1-scoped; editable items and per-source variants go to the backlog.

**Follow-up:** fold these decisions into the PRD as a "Lead Qualification Checklist" subsection under Guided Lead Administration — "perhaps with a checklist" is currently the weakest spec in the document.
