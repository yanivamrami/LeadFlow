# Design system document — generation guide

Produce `docs/DESIGN-SYSTEM.md`. Unlike the other artifacts, the design system usually originates **outside** this skill: the user typically delivers a design handoff package from Claude Design. So the primary job here is to **review and normalize** that package into a documented, implementation-ready system — not to invent visual design from scratch.

## Step 1 — Find the source

Ask the user for (or locate) the Claude Design handoff package / design files. If they have one, extract tokens and specs from it. If they explicitly have none, generate a sensible starting system from the ARCHITECTURE + PRD (brand cues, locale), and clearly mark it as a proposed baseline to be refined.

## Step 2 — Extract and normalize tokens

Pull these out of the handoff and record them as named tokens:
- Color: primary/secondary/accent, semantic (success/warn/error/info), surfaces, text.
- Typography: family, scale, weights, line-heights — the font family comes from the handoff/design source, never presupposed here.
- Spacing scale, radius scale, elevation/shadow, z-index layers.
- Motion: durations, easings.

## Step 3 — Document components

For each component in the handoff: variants, states (default/hover/focus/active/disabled/loading/error), sizes, and the implementation target it maps to — the chosen UI framework component (e.g. Angular Material) or a custom component. Do not assume a UI framework; use whatever the project selected. Include direction/mirroring behavior per component only if the product is RTL or bidirectional.

## Template

```markdown
# Design System — <Project Name>

> Source: <Claude Design handoff / proposed baseline>. Aligns with docs/ARCHITECTURE.md §7.

## 1. Foundations
### Design tokens
Color / Typography / Spacing / Radius / Elevation / Motion — as named tokens with values.

## 2. Direction & i18n (include only if applicable)
Text direction and mirroring rules (LTR/RTL/bidi per PRD), i18n key convention, number/date/currency locale. Omit this section entirely for a single-language LTR product.

## 3. Accessibility baseline
WCAG 2.1 AA: contrast, focus visibility, target sizes, keyboard nav, ARIA conventions.

## 4. Components
Per component: description, variants, states, sizes, implementation-target mapping (chosen framework or custom), direction notes if applicable, do/don't.

## 5. Patterns
Forms, tables/data views, empty states, loading, error/toast, modals.

## 6. Theming
How tokens map to CSS variables / the chosen framework's theme; light/dark if applicable.

## 7. Handoff notes
Anything engineering needs that isn't obvious from the tokens.
```

## After writing

Note that DESIGN-SYSTEM.md feeds DEV-HANDOFF.md, and offer to generate that next.
