# LeadFlow Manager — Design System v1.0

> Derived from `documents/Product Requirements Document LeadFlow Manager.md`, `docs/ARCHITECTURE.md` and `documents/Lead Qualification Checklist - PM Decisions.md`.
> Visual base: **Modernist** — flat, architectural, near-mono red on a light ground, zero radius, strong 2px rules.
> Interactive spec: `LeadFlow Design System.dc.html`. Implementation: `client/src/theme/leadflow-preset.ts` + `client/src/theme/tokens.css`.

---

## 0. Principles

1. **Structure over decoration.** Alignment and the weight of the rules organise the page. No gradients, no rounded corners, no colour used decoratively.
2. **The guidance layer is the product.** Every teaching moment — status tip, "why ask?", checklist nudge, analytics insight — uses one treatment (§8). It is the component that makes this app itself.
3. **Advisory, never blocking.** Nothing in the visual language may read as a gate. Nudges always offer an exit.
4. **Mobile-first, RTL-native.** Designed at 390px, scaled to 1440px. Logical CSS properties only.
5. **Mono discipline.** Red is reserved for: the primary action, the Won status, the guidance rule, and focus. Everywhere else is the neutral ramp.

---

## 1. Colour

### Light (default)
| Token | Value | Use |
|---|---|---|
| `--lf-bg` | `#f3f2f2` | screen ground |
| `--lf-surface` | `#eae9e9` | cards, inputs, raised rows |
| `--lf-text` | `#201e1d` | primary ink |
| `--lf-text-muted` | `#605d5d` | secondary copy, metadata |
| `--lf-accent` | `#ec3013` | primary action, Won, guidance rule, focus |
| `--lf-divider` | `rgba(32,30,29,0.40)` | 2px section rules, field borders |
| `--lf-divider-soft` | `rgba(32,30,29,0.25)` | 1px row rules |

### Dark
| Token | Value | Note |
|---|---|---|
| `--lf-bg` | `#1a1918` | |
| `--lf-surface` | `#262423` | |
| `--lf-text` | `#f3f2f2` | |
| `--lf-text-muted` | `rgba(243,242,242,0.65)` | |
| `--lf-accent` | `#ff563c` | accent-500 — `#ec3013` drops below 3:1 on dark ground |
| `--lf-divider` | `rgba(243,242,242,0.35)` | |

Text on an accent fill is `--lf-bg` in light, `#1a1918` in dark. Shadows do not exist in dark mode — replace with a `1px` border at 15% white.

### Ramps
Neutral `100…900`: `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`
Accent `100…900`: `#fff2ef #ffe0d9 #ffc4b8 #ff9783 #ff563c #dd2b0f #ae1800 #7c1405 #4d170e`

Body-size text in the accent uses **accent-700** (`#ae1800`), never accent-500 — contrast.

---

## 2. Typography

**Fredoka** for Hebrew and UI, **Archivo** for numerals, Latin and labels.

Archivo (Modernist's base) carries no Hebrew glyphs. Fredoka is rounded and warm — a deliberate counterpoint to the square corners that serves the PRD's "forgiving, beginner-friendly" promise. Figures stay in Archivo with `tabular-nums` so money columns align.

| Role | Family | Size / weight | Line height |
|---|---|---|---|
| Display | Fredoka | 44 / 600 | 1.1 |
| H1 — screen title | Fredoka | 28 / 600 | 1.2 |
| H2 — section | Fredoka | 21 / 600 | 1.25 |
| H3 — lead name | Fredoka | 17 / 500 | 1.3 |
| Body | Fredoka | 15 / 400 | 1.6 |
| Small — metadata, guidance | Fredoka | 13 / 400 | 1.5 |
| Label | Archivo | 11 / 800, uppercase, `.1em` | 1.4 |
| Numeral | Archivo | 800, `tabular-nums` | — |

Mobile: display drops to 32, H1 to 24. Nothing below 13px anywhere.

---

## 3. Space, grid, edges

Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Screen padding 16 (mobile) / 32 (desktop). Section gap 32 / 48.

- **Radius: 0** on every element — buttons, inputs, cards, dialogs, avatars, tags.
- **2px rule** — section separators, nav underline, table header.
- **1px rule** — table rows, list items, field borders.
- **1px dashed** — Kanban drop zones and empty states only.
- **Shadow** — three steps only: `sm` dragged card, `md` floating menu, `lg` dialog. Everything else uses rules.

---

## 4. Density

| | Comfortable (default) | Compact |
|---|---|---|
| Where | dashboard, lead detail, forms, analytics | Kanban cards, tables, reminders list |
| Row height | 48px | 36px |
| Padding | 16px | 10px |
| Body size | 15px | 14px |
| Meta size | 13px | 11px |

**Touch targets stay ≥44×44px in both densities**, achieved with transparent padding — density changes padding and type, never the hit area.

---

## 5. Pipeline statuses

The neutral ramp darkens as the lead advances, so pipeline state is legible in a fast scan and in greyscale. Red is the only colour in the pipeline and is reserved for success. Lost is a hollow outline — present but muted, not punished with colour.

| # | `lead_status` | Hebrew | Fill | Text |
|---|---|---|---|---|
| 1 | `new` | ליד חדש | `#eae7e7` (n-200) | `#605d5d` |
| 2 | `contacted` | יצרנו קשר | `#d7d3d3` (n-300) | `#444141` |
| 3 | `qualified` | כשיר | `#bab6b6` (n-400) | `#2d2b2b` |
| 4 | `proposal_sent` | נשלחה הצעה | `#7d7979` (n-600) | `#f8f4f4` |
| 5 | `won` | נסגר בהצלחה | `#ec3013` | `#f3f2f2` |
| 6 | `lost` | לא יצא לפועל | transparent, 1px `#9b9797` | `#605d5d` |

**Lead sources** (`website · referral · social_media · phone · other`) are neutral outline tags — descriptive, not ranked. Only `is_demo` leads carry an accent-100 tint plus a sparkle icon, so it is obvious they are deletable.

---

## 6. Kanban

Column identity is carried by **header rule weight + stage index**, not by colour:

| Stage | Rule |
|---|---|
| 1 new | 2px `#9b9797` |
| 2 contacted | 3px `#7d7979` |
| 3 qualified | 4px `#605d5d` |
| 4 proposal_sent | 5px `#444141` |
| 5 won | 6px `#ec3013` |
| 6 lost | 2px dashed `#9b9797` |

- Dragged card: `shadow-sm` + 1.5° tilt, no colour change.
- Drop zone: 1px dashed border + accent at 4% — the only weak red fill permitted in the system.
- Won cards carry a 3px accent border on the inline-start edge; Lost cards drop to 70% opacity with no fill.
- **Every card has a "move to stage" menu.** Drag is never the only path (WCAG 2.1 AA).
- Board flows right-to-left: stage 1 sits at the right edge.

---

## 7. Components

Built on Modernist classes; PrimeNG mapping in §11.

**Buttons** — min-height 44px. Primary: accent fill, `accent-600` hover, `accent-700` active. Secondary: 1px divider border. Ghost: `accent-700` text. Icon: 44×44. **Labels in wide buttons align to the inline start, never centred.**

**Fields** — 44px min-height, surface fill, 1px divider border, radius 0, accent caret. Focus: `2px solid var(--lf-accent)`, `outline-offset: 0`. Error: accent border + inline message with an alert icon, stating the fix. Labels 12px muted; a help icon opens the field tooltip the PRD asks for.

**Tri-state checklist row** — three 44px segments (כן / לא / ?) in one bordered group. Selected `yes` = accent fill. Selected `unknown` = `n-300` fill — filled, not empty, so "not asked" reads as an answer rather than a skipped field. The five items appear in PM order: interest → need → budget → authority → timeline.

**Activity timeline** — 28px square icon nodes on a 1px vertical rule. System-generated `status_changed` entries use an accent-filled node; user entries use an outlined node.

**Avatars** — 44px squares, monogram in Archivo 800, tint derived deterministically from the row id across the neutral ramp. Accent is reserved for the signed-in user. No photographs anywhere in the product.

**Skeletons** — opaque `#e2dfdf` bars, 1.2s fade, no shimmer sweep.

---

## 8. The guidance layer — signature component

One treatment, three intensities. `<lf-guidance mode="note|nudge|tip">`.

| Mode | Form | Behaviour |
|---|---|---|
| **note** | 2px accent rule on the inline-start edge, no fill, no border | inline, always visible, not dismissible |
| **nudge** | note + 1px divider border + surface fill + action row | offers an action, always has an exit ("לא עכשיו") |
| **tip** | ink ground `#201e1d`, light text, accent inline-start rule | appears once after a stage change, auto-dismisses at 6s |

Never a filled callout box, never an icon-in-a-circle, never a rounded panel. It reads as an annotation in the margin.

### Copy tone
- **Stage tips and empty states** may be energetic: "ליד חדש — הזמן להכשיר!"
- **Checklist questions stay plain and conversational**: "אתם מדברים עם מי שמחליט?"
- **Errors are factual and offer the fix.**
- No emoji anywhere in the interface. No sales jargon.

---

## 9. Empty states

Dashed 1px container + a geometric diagram made of empty rectangles hinting at the missing structure + exactly one action. No illustration, no photography, no mascot.

---

## 10. Icons and motion

**Lucide only**, 2px stroke, sizes 16 / 20 / 24. Directional icons (arrows, chevrons) mirror in RTL; object icons (phone, mail, calendar) do not.

| Token | Value |
|---|---|
| item enter — fade + 8px slide | 180ms ease-out |
| stagger between items | 60ms, capped at 8 items |
| component state (colour, border) | 120ms linear |
| Kanban card settle | 220ms ease-out |
| dialog / drawer | 240ms ease-out |

"Animated icons" from the PRD means **state transitions only**: the check draws itself on select, the bell tilts 8° when a reminder lands. No running loops. Under `prefers-reduced-motion` all motion collapses to an 80ms fade and stagger is removed.

---

## 11. Formats and RTL

- Currency: `₪12,500` — symbol first, no decimals in lists; full precision only in the edit field. Over a million: `₪1.2מ׳`.
- Dates: `he-IL`. Relative within 7 days ("לפני יומיים"), absolute after ("2 באוגוסט 2026").
- Phone, email, URL: wrapped `dir="ltr"`, aligned to the inline end, set in Archivo.
- Percentages and all figures: Archivo, `tabular-nums`.
- **Logical CSS properties only** — `margin-inline-start`, `padding-block`, `border-inline-end`. No `left`/`right`.
- Charts run their time axis right-to-left.

---

## 12. PrimeNG 20 mapping

Custom preset on the **Aura** base, fed by the tokens above (`client/src/theme/leadflow-preset.ts`).

| System element | PrimeNG | Override |
|---|---|---|
| buttons | `p-button` | radius 0, label aligned to start, 44px |
| status tag | `p-tag` | six custom severities from the neutral ramp |
| text field | `pInputText` | radius 0, 2px accent focus ring |
| view toggle | `p-selectbutton` | accent fill on selected |
| lead list | `p-dataview` / `p-table` | compact density, 1px row rules |
| Kanban drag | **Angular CDK DragDrop** | not `pDraggable` — no touch support |
| add-lead (mobile) | `p-drawer` bottom | no top radius; `p-dialog` on desktop |
| stage tip | `p-toast` | custom template: ink ground + accent rule |
| analytics | `p-chart` (Chart.js) | neutral-ramp palette + accent; RTL axis |
| guidance layer | — | bespoke `<lf-guidance>` component |

---

## 13. Accessibility

- WCAG 2.1 AA. Accent-on-ground is ≥3:1 — fine for icons, large text and chrome; body copy in accent uses accent-700.
- Focus is always `2px solid var(--lf-accent)` with `outline-offset: 2px`. Never removed, never the browser default.
- Kanban has a full keyboard path via the per-card stage menu.
- Status is never communicated by colour alone — the tag always carries its label, and the ramp is greyscale-legible.
- `prefers-reduced-motion` honoured globally.
