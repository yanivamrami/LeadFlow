# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Hebrew-speaking freelancers and micro-business owners in Israel (1–5 people) who have never used a CRM and currently track leads in a spreadsheet, a notes app, or their head. They are beginners at *lead management*, not at business — they know their trade, but nobody taught them what "qualified" means or when to follow up. They work mostly on a phone, between jobs, in short bursts.

**Also confirmed:** small sales teams of roughly 2–10 people working one shared pipeline. The tenant/membership model in `docs/ARCHITECTURE.md` targets this as a real near-term audience, not a hypothetical. Roles at launch: tenant **owner** (created the business, manages leads) and tenant **member** (teammate working the same pipeline). Team invites are post-launch, but every design decision must assume a lead can be created by one person and worked by another.

**Job:** capture a lead the moment it appears, know at a glance what to do next with each one, and stop losing deals to forgotten follow-ups.

## Product Purpose

LeadFlow Manager replaces the spreadsheet with a guided pipeline: capture → qualify → engage → advance → close. It exists because the beginner's real problem is not storage, it is *not knowing what to do next* — so the app teaches the process while the user works it, rather than presenting an empty grid.

Success (per the PRD's strategic metrics): users log in and update lead statuses 3–4× per week; they actually follow the guided workflow rather than routing around it; time spent on manual tracking drops; lead-to-customer conversion rises; users rate it easy to use.

## Positioning

Every CRM stores leads. This one **teaches lead management while you use it** — and the teaching layer is the product, not a help centre bolted on. Its distinguishing mechanism is a *guidance layer* that is advisory by design: a fixed, beginner-worded 5-item qualification checklist, per-status "what to do next" copy, and nudges that always offer an exit. Nothing in the product gates or blocks; a beginner who wants to jump a lead straight from "Contacted" to "Qualified" always can, and is taught in the same moment.

Mobile-first and Hebrew/RTL-native from the first pixel — not a desktop CRM squeezed onto a phone and not an English product with a translation layer.

## Operating Context

- **Where it's used:** phone, one-handed, in gaps between real work — after a call, walking out of a meeting, at the end of a day. Desktop is the secondary, not the primary, scene. Designed at 390px, scaled to 1440px.
- **Locale:** Hebrew UI, RTL layout, `he-IL` dates and numbers, `₪` currency. Confirmed as the only locale in scope. Copy lives in a single strings module keyed by feature so future extraction is cheap; no i18n framework at launch.
- **Core workflow (the PRD's five steps):** Capture → Qualify → Engage → Advance → Close. Pipeline stages: `new` · `contacted` · `qualified` · `proposal_sent` · `won` · `lost`.
- **Qualification checklist:** fixed 5 items in this order — interest → need → budget → authority → timeline. Tri-state answers (`yes` / `no` / `unknown` — "no" and "haven't asked" are distinct signals), stored per lead with timestamp and who answered. Advisory only; unanswered items produce a dismissible nudge on stage move, never a gate. Uniform across lead sources. Rationale: `documents/Lead Qualification Checklist - PM Decisions.md`.
- **First run:** signup auto-creates a personal tenant plus one Hebrew sample lead (`is_demo = true`) so the board is never empty on arrival. Demo leads are obviously deletable and excluded from analytics.
- **Reminders:** in-app only at launch — reminders list, badge, toast on login. No email digest, no push, no PWA in v1.
- **Reference documents (authoritative, keep in sync):** `documents/Product Requirements Document LeadFlow Manager.md` (source of truth for scope), `docs/ARCHITECTURE.md`, `docs/DESIGN-SYSTEM.md`, `documents/Lead Qualification Checklist - PM Decisions.md`.

## Capabilities and Constraints

**Confirmed capabilities (v1):**
- Dashboard with toggle between List and Kanban; touch drag-and-drop stage moves, plus a per-card "move to stage" menu as a full keyboard/non-drag path.
- Search and filter by lead name, status, source, or date added.
- Lead record: name, email, phone, company, source, status, estimated value, lost reason; per-field tooltips explaining purpose.
- Chronological activity log (call · email · meeting · note · system `status_changed`), with prompts to log after key actions.
- Automated follow-up reminders derived from status and last interaction.
- Analytics: total leads, conversion rate (won vs. total), source breakdown, pipeline progression over time — each metric paired with a plain-language explanation of what it means and what to do about it.
- Multi-tenant from day one; access control is 100% Postgres RLS on `tenant_id`.

**Stack (existing codebase, not a decision to reopen):** Angular 20 standalone + signals, PrimeNG 20 on a custom Aura preset, Angular CDK DragDrop for Kanban (PrimeNG `pDraggable` has no touch support), Lucide icons, Supabase (Postgres + Auth + Realtime) accessed directly with no custom backend, Vercel static hosting. Schema source of truth is Supabase CLI SQL migrations.

**Constraints future work must respect:**
- Logical CSS properties only (`margin-inline-start`, `padding-block`) — no `left`/`right`.
- Touch targets ≥ 44×44px in every density.
- `prefers-reduced-motion` honoured globally.
- Nothing may read as a gate or a punishment. Advisory, never blocking.
- No emoji in the interface. No sales jargon.
- Only the anon Supabase key ships to the client; the service-role key never leaves Edge Function secrets.

**Explicitly deferred (do not design as if shipped):** embeddable web-form capture, team invite flow, user-editable checklist items, email/push notifications, PWA/offline, preview environments.

**Undecided:** pricing and plan structure (see Product Intent below) — no tiers, prices, or limits exist; future work must not invent them.

## Brand Commitments

- **Name:** "LeadFlow Manager", in Latin script, including inside the Hebrew UI. No Hebrew product name exists. No logo, wordmark, or other brand asset exists yet.
- **Voice (confirmed and split by context):** stage tips and empty states may be energetic ("ליד חדש — הזמן להכשיר!"); checklist questions stay plain and conversational ("אתם מדברים עם מי שמחליט?"); errors are factual and state the fix. Warm-instructional, never teacherly, never cutesy — the user meets this copy many times a week.
- **Visual system:** `docs/DESIGN-SYSTEM.md` (Modernist base — flat, zero radius, 2px rules, near-mono neutral ramp with `#ec3013` accent reserved for primary action / Won / guidance rule / focus; Fredoka for Hebrew and UI, Archivo for numerals and labels). The user has confirmed this is **directional, not frozen** — it may be tuned to fit the product's vibe. The mono discipline, radius-0 language, and the guidance layer as signature component are the parts worth defending; specific values are open to refinement.
- **Product intent:** free tool / lead magnet. No paid tier is planned. Value is adoption and goodwill, not revenue — so no upsell surfaces, no plan gates, no "upgrade" affordances anywhere.

## Evidence on Hand

- **Exists:** the PRD, architecture doc, design-system doc and PM decision record listed above; an interactive design-system prototype at `documents/design_handoff_design_system/prototype/LeadFlow Design System.dc.html`; implemented tokens at `client/src/theme/tokens.css` and a PrimeNG preset at `client/src/theme/leadflow-preset.ts`. Angular 20 app is scaffolded (`client/`) with routes still empty — effectively pre-feature.
- **Does not exist — must not be fabricated:** customers, testimonials, case studies, usage statistics, conversion benchmarks, press, logos, screenshots of real usage, pricing, launch dates, team bios, security certifications. There is no `supabase/` folder or applied schema in the repo yet either; the ER model in `docs/ARCHITECTURE.md` is the design, not a deployed database.
- Demo/sample lead content is Hebrew and explicitly labelled as demo — never present it as a real customer.

## Product Principles

1. **Teach in the flow, never in a manual.** Guidance appears where the decision is made, at the moment it is made. If it needs a help article, the interface failed.
2. **Advisory, never blocking.** Every nudge offers an exit. The user is always allowed to be wrong and move on; the app teaches rather than gates.
3. **The phone is the real scene.** One hand, poor light, thirty seconds between jobs. Anything that only works with a mouse and a wide screen is not done.
4. **Hebrew and RTL are the native case, not an adaptation.** Mirrored layout, `he-IL` formats, and Hebrew-legible type are the baseline the design is judged against.
5. **Show the pipeline, not the database.** A beginner should read state — what to do next, what is stalling — in one glance, before reading any number.

## Accessibility & Inclusion

WCAG 2.1 AA target. Specific product-driven requirements:
- Kanban must have a complete non-drag path (per-card stage menu), fully keyboard-operable — drag is never the only route.
- Status is never carried by colour alone: tags always carry their label and the neutral ramp stays legible in greyscale.
- Focus is always a visible `2px` accent ring, never removed or left to the browser default.
- Body copy in the accent uses accent-700 (`#ae1800`); accent-500 is for icons, large text, and chrome only.
- `prefers-reduced-motion` collapses all motion to a short fade and removes stagger.
