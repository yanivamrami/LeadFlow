# Ceremony / process files — generation guide

Seed the four standardized process files at repo root, plus the ADR folder under `docs/adr/`. These are living files — create them pre-populated with structure and the first real entry (drawn from ARCHITECTURE where relevant), not empty stubs. Use today's date.

Create these:
- `CHANGELOG.md`
- `STATUS.md`
- `TASKS.md`
- `docs/adr/README.md` + `docs/adr/0001-record-architecture-decisions.md` (+ 0002+ for real decisions from ARCHITECTURE)

---

## CHANGELOG.md (Keep a Changelog format)

```markdown
# Changelog

All notable changes to this project are documented here.
Format based on Keep a Changelog; project adheres to semantic versioning.

## [Unreleased]
### Added
- Project scaffolding: docs, CLAUDE.md files, process files.

<!-- On release, move Unreleased items under a version heading with a date. -->
```

---

## STATUS.md (progress snapshot — overwrite as it changes)

```markdown
# Status

> Snapshot of current project state. Update as work progresses.

**Phase:** Bootstrap
**Last updated:** <date>

## Now
- What is actively being worked on.

## Done
- Docs generated: <list>.

## Next
- The next milestone from DEV-HANDOFF.md §3.

## Blockers
- Anything blocking progress (or "none").

## Health
- Build: n/a · Tests: n/a · Deploy: n/a
```

---

## TASKS.md (open work)

```markdown
# Tasks

> Open tasks. Check off or move to CHANGELOG when done.
> Seed from DEV-HANDOFF.md build order once it exists.

## In progress
- [ ] ...

## Todo
- [ ] ...

## Backlog
- [ ] ...

## Done
- [x] Project bootstrapped (<date>)
```

---

## docs/adr/README.md

```markdown
# Architecture Decision Records

Significant technical decisions are recorded here, one file per decision,
using MADR-style format. Numbered sequentially. Never delete an ADR —
supersede it with a new one and link back.

Status values: Proposed · Accepted · Superseded by ADR-XXXX · Deprecated.
```

## docs/adr/0001-record-architecture-decisions.md

```markdown
# 1. Record architecture decisions

Date: <date>
Status: Accepted

## Context
We need a lightweight, durable way to capture the "why" behind technical
decisions so future contributors (and agents) understand the reasoning.

## Decision
We record significant decisions as ADRs in docs/adr/, one file per decision,
numbered sequentially, in MADR-style format.

## Consequences
- Decisions are discoverable and versioned with the code.
- Superseded decisions remain for historical context rather than being deleted.
```

## ADR 0002+ (real decisions)

For each significant choice surfaced in ARCHITECTURE.md §4–6 (stack picks, data model, auth, integration strategy), create an ADR:

```markdown
# <N>. <Decision title>

Date: <date>
Status: Accepted

## Context
<Problem and constraints from the PRD/ARCHITECTURE.>

## Decision
<What was chosen.>

## Alternatives considered
<Options and why they were rejected.>

## Consequences
<Trade-offs, follow-ups.>
```

---

## After writing

List the files created and point out that STATUS/TASKS/CHANGELOG are meant to be updated during dev, while ADRs are append-only.
