# Dev handoff document — generation guide

Produce `docs/DEV-HANDOFF.md`. This is the bridge from design/architecture into actual dev work. It reads ARCHITECTURE + DESIGN-SYSTEM (+ PRD/SRS) and turns them into something a developer (or Claude Code) can start executing against immediately. It should be concrete and buildable — file paths, component names, endpoint signatures, acceptance criteria — not restating the architecture.

## Before writing

- Confirm ARCHITECTURE.md and DESIGN-SYSTEM.md exist. If design system is still pending, generate a handoff scoped to backend/data work and flag the UI sections as blocked on the design system.
- Slice the PRD scope into buildable units (features/epics), each traceable back to a PRD requirement.

## Template

```markdown
# Dev Handoff — <Project Name>

> Reads: PRD, SRS, ARCHITECTURE.md, DESIGN-SYSTEM.md. Last updated: <date>

## 1. How to use this doc
Build order, where each artifact lives, how to update ceremony files as you go.

## 2. Environment setup
Prereqs, repo clone, per-stack install/run commands, env vars, local Postgres setup, EF Core migration apply, seed data.

## 3. Build order / milestones
Ordered list of slices with dependencies. Map to STATUS.md / TASKS.md.

## 4. Data layer tasks
Migrations to create, schema, RLS policies, seed. Reference db/CLAUDE.md.

## 5. API tasks
Per endpoint: method + path, auth, request/response shape, validation, error cases, idempotency where relevant. Reference api/CLAUDE.md.

## 6. Frontend tasks
Per screen/feature: route, components (mapped to design system), state, API calls, i18n keys (if applicable), empty/loading/error states. Reference client/CLAUDE.md.

## 7. Cross-cutting
Auth wiring, logging, config, error envelope contract shared client↔api.

## 8. Acceptance criteria
Per slice: testable criteria traceable to PRD. Include the definition of done.
Definition of done must include the review gates: `security-architect` and
`performance-reviewer` both run on the slice (per slice) and before merge, with
Sev 1 findings fixed and Sev 2/3 fixed or explicitly deferred with a note.

## 9. Testing strategy
Unit/integration/e2e expectations per layer; what must be covered before a slice is "done".

## 10. First-week plan
A concrete ordered checklist to get from empty repo to first working vertical slice.
```

## After writing

Confirm the project is ready for dev, and remind the user the ceremony files (STATUS/TASKS/CHANGELOG) should be updated as slices complete. Offer to seed TASKS.md from the build order in §3 if not already done.
