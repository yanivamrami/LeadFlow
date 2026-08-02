# CLAUDE.md files — generation guide

Generate a **root** `CLAUDE.md` plus a **per-stack** `CLAUDE.md` inside each present stack folder (`client/`, `api/`, `db/`). The root file orients any agent to the whole repo and points to the sub-files; each sub-file carries stack-specific best practices.

All baked-in conventions below are the user's usual defaults. **Mark each as overridable** and follow the PRD/ARCHITECTURE where they differ. Skip any stack not present in the project.

---

## Root CLAUDE.md template

```markdown
# <Project Name>

<One-line description from the PRD.>

## Repository layout
Monorepo. Key folders:
- `client/` — Angular frontend (see client/CLAUDE.md)
- `api/` — .NET minimal API (see api/CLAUDE.md)
- `db/` — Postgres schema & EF Core migrations (see db/CLAUDE.md)
- `docs/` — PRD, SRS, ARCHITECTURE, DESIGN-SYSTEM, DEV-HANDOFF, adr/

## Working agreements
- Update CHANGELOG.md for user-visible changes (Keep a Changelog format).
- Reflect current progress in STATUS.md; keep open work in TASKS.md.
- Record significant technical decisions as ADRs in docs/adr/.
- Read the relevant per-stack CLAUDE.md before working in a folder.

## Review gates
Two required reviews, run by dedicated skills — not left to memory:
- **Security** — run the `security-architect` skill.
- **Performance** — run the `performance-reviewer` skill.

Run both at two points:
1. **Per feature slice** — after the slice is code-complete, before it's "done".
2. **Before merge/PR** — as a check on the branch before squash-merge into `main`.

A slice/PR is not done until both gates pass or findings are triaged:
Sev 1 must be fixed; Sev 2/3 fixed or explicitly deferred with a note.
(Requires both skills installed in the environment.)

## Locale & compliance
<Text direction / applicable privacy law (e.g. Amendment 13) — include only if the PRD implies it.>

## Conventions
- **Commits — Conventional Commits**: `type(scope): subject`.
  Types: feat, fix, refactor, perf, docs, test, chore, build, ci.
  Scope = stack/folder or feature, e.g. `feat(api): add idempotency filter`,
  `fix(client): stop CD thrash on dashboard`, `chore(db): add users RLS policy`.
- **Branches**: `type/short-description` in kebab-case, e.g. `feat/payslip-export`,
  `fix/login-direction`. Prefix a ticket id if a tracker is used:
  `feat/PROJ-123-payslip-export`.
- **Flow**: trunk-based. Branch off `main`, keep branches short-lived and small,
  PR back into `main`. Squash-merge so the PR title (a Conventional Commit) becomes
  the single history entry. Release branches only if a project needs them.
- Commit types map to CHANGELOG.md sections (feat→Added, fix→Fixed, etc.).
- Definition of done references DEV-HANDOFF.md acceptance criteria.
```

---

## client/CLAUDE.md — Angular (defaults, overridable)

Include the subset that matches the project's Angular version.

Do NOT bake in a UI component framework, a font, or a text direction:
- **UI framework**: leave agnostic. When the user needs one, ask and offer **Angular Material** or **custom / design-system-driven components**. Only then write framework-specific guidance.
- **Font**: comes from docs/DESIGN-SYSTEM.md — never hardcode one here.
- **Direction (LTR/RTL)**: infer from the PRD; ask if unclear. Regardless of direction, always use CSS logical properties.
- **i18n**: include only if the PRD implies multiple languages; then note keys-not-literals and a library choice left open.

```markdown
# Client — Angular

> Conventions below are defaults; override per docs/ARCHITECTURE.md.
> UI component framework, font, and text direction are project-specific
> (framework: TBD/ask; font: from DESIGN-SYSTEM.md; direction: per PRD).

## Stack
- Angular, standalone components; modern control flow @if/@for/@switch.
- UI component framework: <unset — Angular Material or custom/design-system-driven>.

## Structure
- Feature-based folders; smart/presentational split.
- Standalone components + lazy-loaded routes.
- Signals for local/component state; prefer signal inputs/outputs where the version supports it.

## Best practices
- Develop with efficiency, performance, and security in mind — treat these as first-class constraints, not afterthoughts.
- OnPush change detection everywhere.
- Use @defer for below-the-fold / heavy blocks.
- Type everything; no `any`. Strict template checking on.
- HTTP through typed services; never call APIs from components directly.
- Reactive forms (or Signal Forms on v21+) — no template-driven for real forms.
- Use pipes and directives in templates whenever they're the right tool; reuse
  existing pipes/directives before writing new ones (prefer pure pipes).
- Never call component methods from the template just to compute styling / CSS
  classes — it runs on every change detection cycle. Use [class.x], [ngClass],
  [style.x], host bindings, a directive, or a precomputed signal/field instead.
- Accessibility: WCAG 2.1 AA, visible focus, ARIA on custom controls.
- Always use CSS logical properties (margin-inline, inset-inline, padding-inline)
  instead of left/right, so the app is direction-safe by default.

## Don't
- No business logic in components.
- No method calls in templates for styling / CSS class computation.
- No direct DOM manipulation outside directives.
- No hardcoded font or hardcoded UI framework assumptions — honor the design system.
```

---

## api/CLAUDE.md — .NET minimal API (defaults, overridable)

```markdown
# API — .NET (C#) Minimal API

> Conventions below are defaults; override per docs/ARCHITECTURE.md.

## Stack
- .NET minimal API, C#
- EF Core (Npgsql) against Postgres
- JWT auth

## Structure
- Endpoints grouped by feature (MapGroup); thin endpoints, logic in services/handlers.
- **Hard rule — DTOs at the boundary.** Never expose EF/DB entities to the client,
  in any direction (request or response). Every endpoint takes and returns DTOs that
  ship only what the client needs — no over-posting, no leaking internal columns.
- Records for DTOs; nullable reference types enabled.

## Best practices
- Develop with efficiency, performance, and security in mind — treat these as first-class constraints, not afterthoughts.
- Consistent error envelope; use ProblemDetails.
- Validate input (FluentValidation or minimal-API filters).
- Idempotency keys for unsafe operations where the PRD implies retries/payments.
- Async all the way; no blocking .Result/.Wait().
- Structured logging with correlation IDs across requests (Serilog is a good option; not mandated).
- Resilience where calling external systems: retries + circuit breaker (Polly).
- Config/secrets via IOptions + environment; never commit secrets.
- Migrations reviewed against db/CLAUDE.md before applying.

## Patterns to reach for when relevant
- Outbox for reliable event/side-effect dispatch.
- Rate limiting (built-in middleware or Redis) on public endpoints.

## Don't
- No exposing EF/DB entities across the API boundary — DTOs only.
- No raw string-concatenated SQL — parameterize / use EF.
- No secrets or connection strings in source.
- No sync-over-async.
```

---

## db/CLAUDE.md — Postgres + EF Core migrations (defaults, overridable)

Default is plain Postgres with EF Core migrations. Do NOT assume Supabase or any specific managed provider — if the PRD/architecture names one, adapt (provider-specific auth, connection, and RLS tooling) but keep EF Core migrations as the schema source of truth unless the project explicitly chooses another migration tool.

```markdown
# DB — Postgres (EF Core migrations)

> Conventions below are defaults; override per docs/ARCHITECTURE.md.
> Provider is project-specific (plain Postgres by default; not assumed managed).

## Approach
- EF Core migrations are the source of truth for schema.
- One logical change per migration; reviewed before apply.
- Never edit an already-applied migration; add a new one.
- Migrations live with the api/ project; keep them in source control.

## Best practices
- Apply Row Level Security wherever the target Postgres deployment supports it;
  explicit policies per role. Prefer RLS over relying solely on app-layer checks.
- snake_case names; pick singular or plural and document the choice.
- Foreign keys + indexes on FK columns; index by query pattern.
- created_at/updated_at columns; soft-delete only if the PRD needs it.
- Store money as integer minor units or numeric — never float.
- Seed/reference data via idempotent seed scripts.

## Migration hygiene
- Test migrations against a local Postgres instance before pushing.
- Document connection specifics (host, pooling, SSL, encoded password) here
  if the project runs into environment-specific connection issues.

## Don't
- No schema changes applied outside a tracked migration.
- No disabling RLS to "make it work".
- No destructive migration without an explicit, reviewed down path or backup note.
```

---

## After writing

List which CLAUDE.md files were created and remind the user that the baked-in conventions are defaults they can edit. Offer to generate the ceremony/process files if not already present.
