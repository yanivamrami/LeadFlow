# Handoff: LeadFlow Manager — Design System v1.0

**To:** the developer agent implementing `client/` (Angular 20 + PrimeNG 20 + Supabase)
**From:** design
**Date:** 2026-08-02
**Scope:** the design system only. No application screens are designed yet — this package establishes the visual language, tokens and component rules that those screens will be built from.

---

## Overview

LeadFlow Manager is a mobile-first, Hebrew/RTL web app for freelancers and small-business owners with no sales training, per `documents/Product Requirements Document LeadFlow Manager.md` and `docs/ARCHITECTURE.md`.

This package delivers the design system §7 of the architecture calls for ("tokens come from `docs/DESIGN-SYSTEM.md` and map onto PrimeNG's theme designer/CSS variables. Font is NOT chosen here."). The font is now chosen. So is everything else.

**The visual base is Modernist:** flat and architectural, near-mono red on a light ground, a visible modular grid, zero corner radius, strong 2px rules. Nothing floats, nothing is decorated — alignment and the weight of the dividers do the organising.

---

## About the design files

The files in `prototype/` are a **design reference created in HTML** — a specimen sheet showing the intended look, not production code to copy. Your task is to **implement this system inside the existing Angular 20 + PrimeNG 20 client** using its established patterns: a PrimeNG preset, a CSS custom-property layer, and Angular components.

The two files in `theme/` are the exception — they are **written to be dropped into the codebase as-is**:

| File | Destination | What it is |
|---|---|---|
| `theme/tokens.css` | `client/src/theme/tokens.css` | every design token as a CSS custom property, light + dark, plus the guidance-layer classes and the reduced-motion block |
| `theme/leadflow-preset.ts` | `client/src/theme/leadflow-preset.ts` | the PrimeNG 20 preset (Aura base) plus `LEAD_STATUS_STYLE` and `CHART_PALETTE` |

Wire them up:

```ts
// app.config.ts
import { providePrimeNG } from 'primeng/config';
import { LeadFlowPreset } from './theme/leadflow-preset';

providePrimeNG({
  theme: {
    preset: LeadFlowPreset,
    options: { darkModeSelector: '[data-theme="dark"]' },
  },
});
```

```scss
// styles.scss — tokens FIRST, before the PrimeNG theme
@use './theme/tokens.css';
```

```html
<!-- index.html -->
<html dir="rtl" lang="he" data-theme="light">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&family=Archivo:wght@400;600;800&display=swap">
```

`tokens.css` and `leadflow-preset.ts` duplicate the same values by necessity (PrimeNG's preset cannot read CSS custom properties at build time). **When one changes, change both**, and update `DESIGN-SYSTEM.md`.

## Fidelity

**High-fidelity.** Colours, type, spacing, states and motion are final. Reproduce them exactly. `DESIGN-SYSTEM.md` in this folder is the normative spec; the HTML prototype is its rendering.

---

## Design tokens

### Colour — light (default)

| Token | Value | Use |
|---|---|---|
| `--lf-bg` | `#f3f2f2` | screen ground |
| `--lf-surface` | `#eae9e9` | cards, inputs, raised rows |
| `--lf-text` | `#201e1d` | primary ink |
| `--lf-text-muted` | `#605d5d` | secondary copy, metadata |
| `--lf-accent` | `#ec3013` | primary action, Won, guidance rule, focus |
| `--lf-on-accent` | `#f3f2f2` | text on an accent fill |
| `--lf-divider` | `rgba(32,30,29,0.40)` | 2px section rules, field borders |
| `--lf-divider-soft` | `rgba(32,30,29,0.25)` | 1px row rules |
| `--lf-skeleton` | `#e2dfdf` | loading bars |

### Colour — dark

| Token | Value | Note |
|---|---|---|
| `--lf-bg` | `#1a1918` | |
| `--lf-surface` | `#262423` | |
| `--lf-text` | `#f3f2f2` | |
| `--lf-text-muted` | `rgba(243,242,242,0.65)` | |
| `--lf-accent` | `#ff563c` | accent-500 — `#ec3013` drops below 3:1 on a dark ground |
| `--lf-on-accent` | `#1a1918` | |
| `--lf-divider` | `rgba(243,242,242,0.35)` | |

Dark mode is toggled by `data-theme="dark"` on `<html>`. **Shadows do not exist in dark mode** — the three shadow tokens become a 1px hairline at 10–15% white. Persist the user's choice; default to `prefers-color-scheme`.

### Ramps

Neutral `100…900`: `#f8f4f4 · #eae7e7 · #d7d3d3 · #bab6b6 · #9b9797 · #7d7979 · #605d5d · #444141 · #2d2b2b`
Accent `100…900`: `#fff2ef · #ffe0d9 · #ffc4b8 · #ff9783 · #ff563c · #dd2b0f · #ae1800 · #7c1405 · #4d170e`

100–300 for tinted fills and hovers · 500 base · 700–900 for text on tinted fills and pressed states.
**Body-size text in the accent uses accent-700 (`#ae1800`), never accent-500** — contrast.

### Typography

**Fredoka** for Hebrew and all UI. **Archivo** for numerals, Latin and labels.

Archivo (Modernist's base face) has no Hebrew glyphs. Fredoka is rounded and warm — a deliberate counterpoint to the square corners that serves the PRD's "forgiving, beginner-friendly" promise. Figures stay in Archivo with `font-variant-numeric: tabular-nums` so money columns align.

| Role | Family | Size / weight | Line height | Mobile |
|---|---|---|---|---|
| Display | Fredoka | 44 / 600 | 1.1 | 32 |
| H1 — screen title | Fredoka | 28 / 600 | 1.2 | 24 |
| H2 — section | Fredoka | 21 / 600 | 1.25 | 19 |
| H3 — lead name | Fredoka | 17 / 500 | 1.3 | 17 |
| Body | Fredoka | 15 / 400 | 1.6 | 15 |
| Small — metadata, guidance | Fredoka | 13 / 400 | 1.5 | 13 |
| Label | Archivo | 11 / 800, uppercase, `letter-spacing: .1em` | 1.4 | 11 |
| Numeral | Archivo | 800, `tabular-nums` | — | — |

Nothing renders below 13px anywhere in the product.

### Space, geometry, elevation

Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Screen padding 16 (mobile) / 32 (desktop). Section gap 32 / 48.

- **Radius: 0 on every element** — buttons, inputs, cards, dialogs, avatars, tags. No exceptions.
- **2px rule** — section separators, nav underline, table header.
- **1px rule** — table rows, list items, field borders.
- **1px dashed** — Kanban drop zones and empty states only.
- **Shadow — three steps only:** `sm` dragged card, `md` floating menu, `lg` dialog. Everything else uses rules, not elevation.

### Motion

| Token | Value |
|---|---|
| `--lf-dur-state` — colour, border | 120ms linear |
| `--lf-dur-enter` — fade + 8px slide | 180ms ease-out |
| `--lf-stagger` — between list items | 60ms, capped at 8 items |
| `--lf-dur-settle` — Kanban card lands | 220ms ease-out |
| `--lf-dur-overlay` — dialog / drawer | 240ms ease-out |

The PRD's "animated icons" means **state transitions only**: the check draws itself on select, the bell tilts 8° when a reminder lands. **No running loops.** Under `prefers-reduced-motion` all motion collapses to an 80ms fade and stagger is removed — already handled in `tokens.css`.

---

## Components

### Buttons
Min-height **44px** in every variant. Radius 0.

| Variant | Rest | Hover | Active |
|---|---|---|---|
| primary | accent fill, `--lf-on-accent` text | `accent-600` | `accent-700` |
| secondary | transparent, 1px `--lf-divider` | ink @ 7% | ink @ 14% |
| ghost | `accent-700` text | accent @ 10% | accent @ 18% |
| icon | 44×44 square | as secondary | as secondary |
| disabled | 45% opacity, `cursor: not-allowed` | — | — |

**Labels in wide/block buttons align to the inline start, never centred** (Modernist rule). A trailing icon goes with the label at the start edge.

### Fields
44px min-height, `--lf-surface` fill, 1px `--lf-divider` border, radius 0, accent caret.
Focus: `outline: 2px solid var(--lf-accent); outline-offset: 0`.
Error: accent border plus an inline message with an alert icon that **states the fix**, not just the fault.
Label 12px `--lf-text-muted`; a Lucide `circle-help` icon opens the per-field tooltip the PRD asks for.

### Tri-state qualification row
Three 44px segments — **כן / לא / ?** — inside one bordered group.
Selected `yes` = accent fill. Selected `unknown` = `n-300` fill — **filled, not empty**, so "haven't asked" reads as an answer rather than a skipped field (the tri-state distinction the PM decisions doc is firm about).
Items appear in PM order: `interest → need → budget → authority → timeline`.

### Activity timeline
28px square icon nodes on a 1px vertical rule.
System-generated `status_changed` rows use an accent-filled node; user-logged rows use an outlined node.

### Avatars
**44px squares, not circles.** Monogram in Archivo 800. Tint derived deterministically from the row id across the neutral ramp; accent is reserved for the signed-in user. **No photography anywhere in the product.**

### Skeletons
Opaque `--lf-skeleton` bars, 1.2s fade. **No shimmer sweep.**

### Empty states
1px dashed container + a geometric diagram made of empty rectangles hinting at the missing structure + exactly one action. No illustration, no mascot, no photograph.

---

## Pipeline statuses

The neutral ramp darkens as the lead advances, so pipeline state is legible in a fast scan and in greyscale. **Red is the only colour in the pipeline and is reserved for success.** Lost is a hollow outline — present but muted, not punished with colour.

| # | `lead_status` | Hebrew | Fill | Text |
|---|---|---|---|---|
| 1 | `new` | ליד חדש | `#eae7e7` | `#605d5d` |
| 2 | `contacted` | יצרנו קשר | `#d7d3d3` | `#444141` |
| 3 | `qualified` | כשיר | `#bab6b6` | `#2d2b2b` |
| 4 | `proposal_sent` | נשלחה הצעה | `#7d7979` | `#f8f4f4` |
| 5 | `won` | נסגר בהצלחה | `#ec3013` | `#f3f2f2` |
| 6 | `lost` | לא יצא לפועל | transparent, 1px `#9b9797` | `#605d5d` |

Consume this from `LEAD_STATUS_STYLE` in `leadflow-preset.ts` — do not re-declare the hexes in components.

**Lead sources** (`website · referral · social_media · phone · other`) are neutral outline tags — descriptive, not ranked. Only `is_demo` leads carry an accent-100 tint plus a Lucide `sparkles` icon, so it is obvious they can be deleted.

---

## Kanban

Column identity is carried by **header rule weight + stage index**, never by colour:

| Stage | Header rule |
|---|---|
| 1 `new` | 2px `#9b9797` |
| 2 `contacted` | 3px `#7d7979` |
| 3 `qualified` | 4px `#605d5d` |
| 4 `proposal_sent` | 5px `#444141` |
| 5 `won` | 6px `#ec3013` |
| 6 `lost` | 2px dashed `#9b9797` |

- **Board flows right-to-left** — stage 1 sits at the right edge.
- Dragged card: `--lf-shadow-sm` + 1.5° tilt. No colour change.
- Drop zone: 1px dashed border + accent at 4% — **the only weak red fill permitted in the system**.
- Won cards: 3px accent border on the inline-start edge. Lost cards: 70% opacity, no fill.
- **Every card carries a "move to stage" menu.** Drag is never the only path (WCAG 2.1 AA, and architecture §9).
- Use **Angular CDK DragDrop**, not `pDraggable` — architecture §7, touch support.

---

## The guidance layer — the signature component

Build this as a bespoke Angular component: `<lf-guidance mode="note | nudge | tip">`. Every teaching moment in the product routes through it — status tips, "why ask?" copy, the checklist nudge, analytics insights. One treatment, three intensities.

| Mode | Form | Behaviour |
|---|---|---|
| **note** | 2px accent rule on the inline-start edge, no fill, no border | inline, always visible, not dismissible |
| **nudge** | note + 1px `--lf-divider` border + `--lf-surface` fill + action row | offers an action, **always has an exit** ("לא עכשיו") |
| **tip** | ink ground `--lf-text`, light text, accent inline-start rule | appears once after a stage change, auto-dismisses at 6s |

Base classes are already in `tokens.css` (`.lf-guidance`, `.lf-guidance--nudge`, `.lf-guidance--tip`).

**Never** a filled callout box, an icon-in-a-circle, or a rounded panel. It must read as an annotation in the margin.

### Copy rules
- Stage tips and empty states may be energetic: *"ליד חדש — הזמן להכשיר!"*
- **Checklist questions stay plain and conversational**: *"אתם מדברים עם מי שמחליט?"* — never *"הזמן לבדוק תקציב!"*. The user meets these on every lead, several times a week; cute copy is charming on day 1 and grating by week 3.
- Errors are factual and offer the fix.
- **No emoji anywhere in the interface.** No sales jargon ("לקוואליפיי", "פייפליין", "קונברז'ן").

All strings live in the Hebrew strings module per architecture §7 — none of this copy belongs in a template literal.

---

## Icons

**Lucide only**, 2px stroke, sizes 16 / 20 / 24.
Directional icons (arrows, chevrons) **mirror in RTL**. Object icons (phone, mail, calendar) **do not**.

Icons used in the prototype: `kanban`/`columns`, `list`, `search`, `list-filter`, `plus`, `bell`, `bar-chart-3`, `phone`, `mail`, `calendar`, `check`, `circle-help`, `circle-alert`, `ellipsis-vertical`, `sparkles`, `x`.

---

## RTL and formatting

- **Logical CSS properties only** — `margin-inline-start`, `padding-block`, `border-inline-end`. No `left` / `right`. This is enforceable in review; treat a physical property as a bug.
- **Isolate every LTR run** — phone numbers, emails, URLs, hex values, currency, mixed measurement strings inside Hebrew sentences. Use `dir="ltr"` + `unicode-bidi: isolate`, or the `.lf-ltr` helper in `tokens.css`. Without this, "1 / 6" renders as "6 / 1" and a trailing full stop jumps to the wrong side of the number. (The prototype hit exactly these bugs in review — they are easy to miss and easy to prevent.)
- Currency: `₪12,500` — symbol first, no decimals in lists; full precision only in the edit field. Above a million: `₪1.2מ׳`.
- Dates: `he-IL`. Relative within 7 days ("לפני יומיים"), absolute after ("2 באוגוסט 2026").
- All figures: Archivo, `tabular-nums`.
- Charts run their time axis right-to-left.

---

## PrimeNG 20 mapping

| System element | PrimeNG | Required override |
|---|---|---|
| buttons | `p-button` | radius 0, label aligned to inline start, 44px min-height |
| status tag | `p-tag` | six custom severities from `LEAD_STATUS_STYLE` |
| text field | `pInputText` | radius 0, 2px accent focus ring |
| view toggle (Kanban/List) | `p-selectbutton` | accent fill on the selected option |
| lead list | `p-dataview` / `p-table` | compact density, 1px row rules |
| Kanban drag | **Angular CDK DragDrop** | not `pDraggable` — no touch support |
| add-lead (mobile) | `p-drawer` bottom | no top radius; `p-dialog` on desktop |
| stage tip | `p-toast` | custom template — ink ground + accent inline-start rule |
| analytics | `p-chart` (Chart.js) | `CHART_PALETTE`, RTL axis |
| guidance layer | — | bespoke `<lf-guidance>` |

---

## Density

| | Comfortable (default) | Compact |
|---|---|---|
| Where | dashboard, lead detail, forms, analytics | Kanban cards, tables, reminders list |
| Row height | 48px | 36px |
| Padding | 16px | 10px |
| Body size | 15px | 14px |
| Meta size | 13px | 11px |

**Touch targets stay ≥44×44px in both densities**, achieved with transparent padding (`.lf-hit`). Density changes padding and type — never the hit area.

---

## Accessibility

- WCAG 2.1 AA (architecture §9).
- Accent-on-ground is ≥3:1 — adequate for icons, large text and chrome, **not for body copy**; paragraph text in the accent uses accent-700.
- Focus is always `2px solid var(--lf-accent)`, `outline-offset: 2px`. Never removed, never the browser default.
- Kanban has a complete keyboard path via the per-card stage menu.
- **Status is never communicated by colour alone** — the tag always ships with its label, and the ramp is greyscale-legible.
- `prefers-reduced-motion` honoured globally.

---

## What is NOT in this package

- **Application screens.** Dashboard (Kanban + List), lead detail, add-lead, analytics, auth/onboarding and reminders have not been designed yet. Do not infer layouts from the specimen sheet — it is a token and component reference, not a screen.
- Illustration or icon assets — Lucide is pulled from the library at build time.
- Photography — the product uses none.

---

## Files in this package

```
design_handoff_design_system/
├── README.md                      ← this file; self-sufficient
├── DESIGN-SYSTEM.md               ← the normative spec (same content, doc form)
├── theme/
│   ├── tokens.css                 → copy to client/src/theme/tokens.css
│   └── leadflow-preset.ts         → copy to client/src/theme/leadflow-preset.ts
└── prototype/
    ├── LeadFlow Design System.dc.html   ← the specimen sheet; open in a browser
    ├── support.js                       ← runtime for the prototype only — do not ship
    └── _ds/modernist-.../               ← the Modernist base stylesheet + its guide
```

The prototype is a **reference rendering**, not a build target. `support.js` and the `_ds/` folder exist only so the HTML opens offline.

---

## Source documents this system answers to

- `documents/Product Requirements Document LeadFlow Manager.md` — mobile-first, guidance-first, generous whitespace, staggered/fade-slide animation, animated icons
- `docs/ARCHITECTURE.md` §7 — Hebrew RTL, logical properties, PrimeNG 20, CDK DragDrop, signals, `docs/DESIGN-SYSTEM.md` as the token source
- `documents/Lead Qualification Checklist - PM Decisions.md` — fixed 5 items, tri-state, advisory not blocking, copy tone
