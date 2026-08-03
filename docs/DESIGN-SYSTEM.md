# LeadFlow Manager — Design System v2.0

> Derived from `documents/Product Requirements Document LeadFlow Manager.md`, `docs/ARCHITECTURE.md`, `documents/Lead Qualification Checklist - PM Decisions.md` and `PRODUCT.md`.
> Visual world: **שלט שוק / the market sign** — Israeli street bill-posting and market-stall signage. Ink on poster stock, one fluorescent field for today, one red for commit.
> Comps: `.impeccable/mocks/dashboard-market-sign.html`. Implementation: `client/src/theme/tokens.css` + `client/src/theme/leadflow-preset.ts`.
> **v2.0 replaces the Modernist system of v1.0.** The near-mono ruled register is no longer the product's identity; nothing from it should be reintroduced piecemeal.

---

## 0. Principles

1. **Read it in one glance, in sunlight, at arm's length.** The world was chosen because market signage solves exactly the scene this product lives in: a phone, one hand, thirty seconds between jobs. Every decision answers to that.
2. **The day is a sheet.** What is owed today owns a full-bleed fluorescent field whose height *is* the workload. Clearing an item strikes it through in red and the sheet shortens. An empty sheet is the finish line — it says so rather than disappearing.
3. **Type is the interface.** Names and figures carry the hierarchy at display scale. Metadata is small and gets out of the way. A market sign never whispers a price.
4. **Colour owns regions, not edges.** Yellow is a field, red is a band. Neither is used to decorate a border.
5. **Advisory, never blocking.** Nothing in the visual language may read as a gate. Every nudge carries an exit.
6. **Mobile-first, RTL-native.** Designed at 390px, scaled to 1440px. Logical CSS properties only.

---

## 1. Colour

Roles, not materials — `--lf-ground` / `--lf-ink` / `--lf-surface` flip with the theme; `--lf-day` and `--lf-red` keep their meaning in both.

### Light (default)
| Token | Value | Use |
|---|---|---|
| `--lf-ground` | `#f7f1e4` | poster stock — the page |
| `--lf-surface` | `#efe7d4` | raised paper — cards, fields |
| `--lf-ink` | `#14110f` | primary ink, masthead, rules |
| `--lf-muted` | `#6b6358` | metadata — 5.3:1 on ground |
| `--lf-day` | `#ffe000` | today. attention. the sheet. 14.5:1 with ink |
| `--lf-red` | `#cc1b12` | commit: primary action, Won, cleared marks. 5.0:1 with white |
| `--lf-red-ink` | `#ae1800` | red as *text* on ground — error messages, destructive labels. 6.6:1. `--lf-red` is a fill colour and only reaches 4.0:1 as text |
| `--lf-tan` | `#e8dcc0` | pipeline ramp, step 2 |
| `--lf-tan-deep` | `#c9b98f` | pipeline ramp, step 3 |
| `--lf-rule-soft` | `rgba(20,17,15,.22)` | 1px row rules |

### Dark
| Token | Value | Note |
|---|---|---|
| `--lf-ground` | `#171512` | |
| `--lf-surface` | `#221f1b` | |
| `--lf-ink` | `#f7f1e4` | |
| `--lf-day` | `#ffe000` | unchanged — it is the one light in the room |
| `--lf-red` | `#ff6a4d` | `#cc1b12` drops to 3.3:1 on this ground |
| `--lf-red-ink` | `#ff8a72` | error text on the dark ground |
| `--lf-tan` / `--lf-tan-deep` | `#3a342a` / `#554c39` | ramp inverts, order preserved |

**Contrast is a system property, not a per-screen check.** `#cc1b12` was chosen over a brighter signage red precisely because white-on-it reaches 5.0:1; a brighter red would fail body-size text on fills. Do not "warm it up" without recomputing.

### Rules
`--lf-rule-w: 4px` section · `2px` group and control border · `1px` row. There is **no shadow scale**: paper does not float. Depth is overlap, rotation (`--lf-paste-tilt`, `--lf-stamp-tilt`) and hatching.

---

## 2. Typography

**Fredoka carries every Hebrew glyph in the product, at every size.** **Archivo** is figures and Latin only.

This is a hard rule, not a preference: **Archivo has no Hebrew coverage**, so any Hebrew string set in it silently falls back to a system face — the text still renders, which is exactly why the bug survives review. If a string can contain Hebrew, it is Fredoka. Use `.lf-label` (Fredoka) for Hebrew labels and `.lf-label-ltr` (Archivo, tracked, uppercase) only for Latin ones such as the brand lockup.

Fredoka is rounded and warm — a deliberate counterpoint to the hard edges, serving the PRD's "forgiving, beginner-friendly" promise. It carries the display voice at 26–52px, which is what makes this world a sign rather than a table. Figures stay in Archivo 800 with `tabular-nums` so money columns align.

Hebrew takes no tracking: it has no uppercase and letterspacing only pulls its letterforms apart. Hebrew labels sit at `0.01em`; the `.12em` register belongs to Latin only.

| Role | Family | Size / weight | Line height |
|---|---|---|---|
| Day heading (`היום`, count) | Fredoka | 40 / 600 · 52 desktop | 0.85 |
| Lead name — mobile | Fredoka | 26 / 600 | 1.05 |
| Lead name — desktop | Fredoka | 30 / 600 | 1.05 |
| Register title | Fredoka | 28 / 600 · 34 desktop | 1.0 |
| Board column | Fredoka | 20 / 600 | 1.05 |
| Body | Fredoka | 15 / 400 | 1.55 |
| Small — metadata | Fredoka | 13 / 400 | 1.4 |
| Label — Hebrew | Fredoka | 12 / 600, `.01em` | 1.35 |
| Label — Latin only | Archivo | 12 / 800, `.12em`, caps | 1.3 |
| Figure | Archivo | 800, `tabular-nums`, 17–30 | 1.05 |
| Hebrew monogram (avatar) | Fredoka | 16 / 600 | 1 |

Nothing below 12px anywhere — including labels and stamps, which is why the label size is a token (`--lf-size-label`) rather than a literal. The brand lockup is Latin-only (`LeadFlow` + `MANAGER` in Archivo 800 caps) per `PRODUCT.md`.

---

## 3. Space, geometry, material

Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Screen padding 16 (mobile) / 32 (desktop).

- **Radius: 0** on every element.
- **Touch targets ≥44×44px** in every density, via transparent padding.
- **Grain**: one fixed noise layer at 5% opacity on `body::before`. Never animated, never repeated per component.
- **Rotation** is the world's depth cue: pasted strips sit at `-0.4°`, stamps at `-4°`, a dragged card at `-2°`. All collapse to `0deg` under `prefers-reduced-motion`.

---

## 4. Attention — the flag

The signature device. A 10px tab stuck to the inline-start edge of a row (at the screen edge, not inside the padding). It replaces v1's hairline gutter.

| State | Treatment | Meaning |
|---|---|---|
| `now` | solid `--lf-day` + 2px ink border | overdue reminder, silent proposal, or an unqualified new lead |
| `drift` | 135° hatch, `--lf-muted` at 50% | no contact past the stage's threshold |
| `none` | transparent | nothing owed — most rows, most days |

Solid versus hatch is a **texture** difference, not a hue difference, so the distinction survives greyscale and colour blindness. Board cards use the same vocabulary: `now` fills the card yellow, `drift` hatches its ground.

**Thresholds** (`DRIFT_DAYS` in `client/src/app/core/lead.model.ts`): `new` 3 · `contacted` 7 · `qualified` 7 · `proposal_sent` 3 · Won/Lost never. These are product decisions — change them there, not in CSS.

---

## 5. Pipeline statuses

The paper ramp darkens as the lead advances, so pipeline state is legible in a fast scan and in greyscale. Red is reserved for success; Lost is hatched rather than tinted — present, not punished.

| # | `lead_status` | Hebrew | Fill | Text |
|---|---|---|---|---|
| 1 | `new` | ליד חדש | transparent, 2px ink border | ink |
| 2 | `contacted` | יצרנו קשר | `--lf-tan` | ink |
| 3 | `qualified` | כשיר | `--lf-tan-deep` | ink |
| 4 | `proposal_sent` | נשלחה הצעה | `--lf-ink` | ground |
| 5 | `won` | נסגר בהצלחה | `--lf-red` | white |
| 6 | `lost` | לא יצא לפועל | 135° hatch, muted border | muted |

**Status is never carried by colour alone** — the tag always ships its Hebrew label. Lead sources are plain text, never tagged: they describe, they do not rank. Demo leads tint their row with `--lf-day` at 16% and carry a rotated `לדוגמה` stamp, so it is obvious they are deletable.

---

## 6. The board

Six posted bills, right-to-left, stage 1 at the inline-start edge. Column identity is the **header block**, not a rule weight:

| Stage | Header |
|---|---|
| 1–4 | ink block, ground text |
| 5 won | red block, white text |
| 6 lost | transparent, 2px dashed muted border |

- Dragged card: `-2°` rotation, 3px border, ground fill. No shadow — paper peeled off a wall, not a card lifted off a surface.
- Drop placeholder: 3px dashed red on a 6% red wash. The only weak red fill the system permits.
- Won cards take a red border and a red figure. **They take no side tab** — the column header already carries the meaning, and a thick coloured edge border is the single most recognisable tell of generated UI.
- **Every card carries the same stage menu the register uses.** Drag is never the only path (WCAG 2.1 AA).
- The board activates at ≥768px only. Below that the register is the view; a toggle is not offered where six columns cannot honestly fit.

---

## 7. Components

**Buttons** — min-height 44px, 2px ink border, radius 0, no shadow. Solid: ink fill (or `--lf-day` on the sheet). Primary commit: `--lf-red` fill. Bare: transparent border, underline on hover. Labels align to the inline start in wide buttons.

**The action band** — on mobile the add-lead action is a full-width red band above the tab bar, 60px, with a 4px ink rule above it. This is the one place red owns a whole region. There is **no round FAB**; radius 0 is systemic.

**Fields** (`lf-text-field`) — 44px min-height (48px on the auth screens, where the field is the whole task), surface fill, 2px ink border, radius 0. Focus is `3px solid var(--lf-red)` with `outline-offset: 2px` — on `:focus-within` for composite fields. Stacked fields pull up `-2px` so adjacent borders collapse into one shared rule. Input font-size stays ≥16px or iOS zooms the page on focus. Email and password inputs are `dir="ltr"` islands inside the RTL page.

**Field error** (`lf-form-error`) — a `--lf-red-ink` line under the field behind a 3px red block, `role="alert"` so it is announced when it appears. Never a colour-only signal.

**The posted bill** (`lf-auth-page`) — the signed-out surface. A single sheet on the poster ground: full-bleed under 900px, a 460px bordered bill above it. It owns the `<form>`, so a screen only supplies fields. Children reach the sheet edge with `margin-inline: var(--lf-bleed)` — an inherited custom property, because content projection means a child cannot know its parent's padding.

**Commit band** (`lf-commit-band`) — the auth screens' submit: the same 60px red band as the action band, pinned to the bottom of the bill with `margin-block-start: auto`. Signing in and adding a lead are the same gesture, so they look the same.

**Paste strip** (`lf-paste-strip`) — secondary routes out of a screen (create an account, forgot the password), as an ink-filled strip rotated by `--lf-paste-tilt` with yellow links. The rotation collapses under `prefers-reduced-motion`.

**Filter chips** — a scrolling strip under a 3px ink rule. Selected chip is an ink fill. Counts in Archivo 800.

**View toggle** — two segments in a 2px ink frame; the selected segment fills `--lf-day`.

**Row menu** (`lf-lead-menu`) — 3px ink border, no shadow, opens on the row's inline-end edge. Carries all six stages plus log-activity, snooze, and delete-for-demo. Closes on outside click and Escape, returning focus to its trigger.

**Stamps** — provenance and guidance marks: 3px border, Archivo 800 at 11px, `.1em` tracking, rotated off-axis. Never a rounded pill, never an emoji.

---

## 8. The guidance layer

One vocabulary, three intensities. It is the component that makes this app itself.

| Mode | Form | Behaviour |
|---|---|---|
| **explainer** | ink strip pasted at `-0.4°` on the day sheet, ground text, yellow emphasis | teaches the sheet once; dismissible, and stays dismissed |
| **nudge** | ink block pasted at the corner of the viewport, yellow title, two buttons | follows an action, never precedes it; always carries `לא עכשיו` |
| **status line** | plain sentence in the row or empty state | always visible, never dismissible |

Never a filled callout box, never an icon-in-a-circle, never a rounded panel, never a modal. Guidance is annotation, not interruption.

### Copy tone
- Stage tips and empty states may be energetic: `ליד חדש — הזמן להכשיר!`
- Checklist questions stay plain and conversational: `אתם מדברים עם מי שמחליט?`
- Errors are factual and offer the fix.
- No emoji anywhere. No sales jargon. All strings live in `client/src/app/core/copy.ts`.

---

## 9. Empty states

Dashed 2px container, a geometric mark of empty rectangles hinting at the missing rows, one sentence of guidance, and at most one action. No illustration, no photography, no mascot. The day sheet's empty state is a statement of completion, not an absence — it never collapses to nothing.

---

## 10. Icons and motion

**Lucide only**, 2.4px stroke, sizes 17 / 19 / 21 / 22. Directional icons mirror in RTL; object icons (phone, bell, clipboard) do not. Icons are sized in CSS, never by attribute.

One authored gesture: **paper settling**.

| Token | Value |
|---|---|
| row / item enter — fade + 6px rise | `--lf-dur-enter` 180ms `--lf-ease` |
| stagger between items | `--lf-stagger` 60ms, capped at 8 |
| control state | `--lf-dur-state` 120ms linear |
| card settle after drop | `--lf-dur-settle` 220ms |
| pasted nudge | 220ms, resolving into its `-0.4°` rest angle |

Under `prefers-reduced-motion` every duration collapses to 80ms, stagger goes to 0, and both tilt tokens go to `0deg`.

---

## 11. Formats and RTL

- Currency: `₪12,500` via `Intl` `he-IL`, no decimals in lists. Over a million: `₪1.2מ׳`.
- Dates: relative inside a week (`אתמול`, `לפני יומיים`, `לפני 5 ימים`), absolute after (`2 באוגוסט`). Hebrew dual is handled explicitly — `יומיים`, never `2 ימים`.
- Phone, email, URL: `dir="ltr"`, aligned to the inline end, set in Archivo.
- **Logical CSS properties only** — `margin-inline-start`, `padding-block`, `border-inline-end`. No `left`/`right`.
- Charts run their time axis right-to-left.

---

## 12. PrimeNG 20 mapping

Custom preset on the **Aura** base, fed by the tokens above (`client/src/theme/leadflow-preset.ts`). Primitive ramps are `red` and `paper`; `primary` maps to red.

| System element | PrimeNG | Override |
|---|---|---|
| buttons | `p-button` | radius 0, 2px border, 44px, weight 600 |
| status tag | `p-tag` | six stage styles from §5 |
| text field | `pInputText` | radius 0, 2px border, 3px red focus ring |
| view toggle | `p-selectbutton` | `--lf-day` fill on selected |
| add-lead (mobile) | `p-drawer` bottom | 3px border, no shadow; `p-dialog` on desktop |
| stage tip | `p-toast` | ink ground, 4px inline-start rule, no shadow |
| row menu | bespoke `lf-lead-menu` | — |
| board drag | **Angular CDK DragDrop** | not `pDraggable` — no touch support |
| analytics | `p-chart` (Chart.js) | `CHART_PALETTE`, RTL axis |
| guidance | bespoke, per §8 | — |

---

## 13. Accessibility

- WCAG 2.1 AA. Every text-on-fill pair in §1 and §5 was computed, not eyeballed.
- Focus is always `3px solid var(--lf-red)`, offset 2px. Never removed, never the browser default.
- The board has a full keyboard path via the per-card stage menu; a skip link opens the shell.
- Status and attention are never colour-only: labels ship with tags, hatch distinguishes drift, and screen-reader-only text names the attention state on every flagged row.
- Stage moves announce through a polite live region.
- Navigation items that are not built yet are marked `aria-disabled` and visibly muted rather than linking nowhere.
- `prefers-reduced-motion` honoured globally, including rotation.

---

## 14. Implementation map

| Concern | File |
|---|---|
| tokens | `client/src/theme/tokens.css` |
| PrimeNG preset, stage styles, chart palette | `client/src/theme/leadflow-preset.ts` |
| Hebrew copy and formatters | `client/src/app/core/copy.ts` |
| domain model, drift thresholds, sheet cap | `client/src/app/core/lead.model.ts` |
| dashboard state | `client/src/app/core/leads.store.ts` |
| shell (masthead, tabs, action band) | `client/src/app/features/shell/shell.*` — a routed layout, so the signed-out screens render without it |
| theme choice (light/dark/system) | `client/src/app/core/theme.service.ts` · pre-paint boot script in `client/src/index.html` |
| route guards | `client/src/app/core/auth.guard.ts` |
| auth screens (sign in, sign up, reset) | `client/src/app/features/auth/` |
| profile, account deletion | `client/src/app/features/profile/` |
| account deletion, server side | `client/supabase/functions/delete-account/index.ts` |
| day sheet | `client/src/app/features/dashboard/day-sheet.*` |
| register | `client/src/app/features/dashboard/register.*` |
| board | `client/src/app/features/dashboard/board.*` |
| stage tag, row menu, text field, form error | `client/src/app/shared/` |
