---
name: project-bootstrap
description: Bootstrap a new monorepo project from an existing PRD (and optional SRS) by generating the downstream artifacts, per-stack CLAUDE.md files, and ceremony/process files. Use this whenever the user is starting a new project and wants to scaffold docs and conventions — e.g. "bootstrap this project", "set up a new repo from my PRD", "generate the architecture doc", "create the dev handoff", "scaffold CLAUDE.md files", "set up the changelog/status/ADR files", or refers to their standard PRD → SRS → Architecture → Design System → Dev Handoff flow. Default stack is Angular (client/) + .NET minimal API (api/) + Postgres via EF Core migrations (db/) in a single monorepo, but the skill adapts to whatever the PRD specifies. It does not assume a database provider, UI component framework, font, or text direction.
---

# Project Bootstrap

Scaffold a new project from an existing PRD following the user's established process. The PRD (and optionally an SRS) already exist — this skill produces everything downstream from them.

## Core principle: generate on request, not all at once

Do NOT chain all artifacts in one run. Each downstream artifact depends on the previous one, and the user reviews between steps (the design system in particular usually comes from an external Claude Design handoff package). Generate only what the user asks for in this turn. If they say "bootstrap the whole thing," still go one artifact at a time and confirm before moving to the next.

## The artifact pipeline

```
PRD.md ─┬─> ARCHITECTURE.md ──> DESIGN-SYSTEM.md ──> DEV-HANDOFF.md ──> dev work
SRS.md ─┘         │
                  └─> seeds ceremony files + per-stack CLAUDE.md
```

Dependencies: ARCHITECTURE reads PRD (+SRS). DESIGN-SYSTEM reads ARCHITECTURE plus any Claude Design handoff package the user provides. DEV-HANDOFF reads all three. CLAUDE.md files and ceremony files are seeded from ARCHITECTURE once it exists.

## Step 1 — Locate and read the inputs

Read `docs/PRD.md`. If `docs/SRS.md` exists, read it too. If neither is found, ask the user where the PRD lives (or whether one exists yet — without it there's nothing to generate from). Never invent product requirements; everything flows from these inputs.

## Step 2 — Determine the stacks and the market context

Infer the stacks from the PRD/SRS. Default assumption when unspecified: **monorepo** with
- `client/` — Angular
- `api/` — .NET minimal API (C#)
- `db/` — **Postgres + EF Core migrations** (EF Core is the migration source of truth)

Do NOT assume Supabase or any specific managed provider — the database provider is project-dependent. Default to plain Postgres with EF Core migrations unless the PRD/architecture specifies otherwise (in which case follow it). Apply Row Level Security wherever the target database supports it.

A monorepo means one Git repo containing all three side by side (as opposed to a separate repo per stack). This is the default because it keeps versioning, CI, and cross-cutting changes in one place.

**Market/locale**: do NOT assume RTL or any locale. Determine text direction, languages, and any compliance needs (e.g. Israeli privacy law / Amendment 13) from the PRD. If the PRD makes it clear, apply it. If it's ambiguous, ask the user — do not silently assume either LTR or RTL. Regardless of direction, always use CSS logical properties. Fonts are NOT set here — they come from the design system.

## Step 3 — Generate the requested artifact

Read the matching reference file, then write the artifact to the path shown. Each artifact is written to `docs/`.

| User asks for | Reference file | Output path |
|---|---|---|
| Architecture doc | `references/architecture.md` | `docs/ARCHITECTURE.md` |
| Design system | `references/design-system.md` | `docs/DESIGN-SYSTEM.md` |
| Dev handoff | `references/dev-handoff.md` | `docs/DEV-HANDOFF.md` |
| CLAUDE.md files | `references/claude-md.md` | root + per-stack (see below) |
| Ceremony / process files | `references/ceremony.md` | root (see below) |

For CLAUDE.md and ceremony files, read `references/claude-md.md` and `references/ceremony.md` respectively for the full templates and per-stack best-practice content.

## Review gates (security + performance)

Every bootstrapped project ships with two standing review gates, run by dedicated skills rather than left to inline reminders:
- **Security** — the `security-architect` skill (OWASP Top 10 + .NET/Angular/Node checklists).
- **Performance** — the `performance-reviewer` skill (.NET/EF Core + Angular checklists).

Both gates run at two moments:
1. **Per feature slice** — after a vertical slice is code-complete, before it's considered done.
2. **Before merge / PR** — as a required check on the branch before squash-merge into `main`.

When generating a project, seed this into the root `CLAUDE.md` (Review gates section — template in `references/claude-md.md`) and reference it from `DEV-HANDOFF.md` so each slice's definition of done includes both reviews. A slice is not "done" until both gates pass or their findings are triaged (Sev 1 fixed; Sev 2/3 fixed or explicitly deferred with a note). These skills must be installed in the environment; if they aren't, note that in the generated docs so the user installs them.

## Step 4 — Confirm and offer the next step

After writing an artifact, briefly summarize what was produced and name the next artifact in the pipeline, but wait for the user to ask before generating it.

## Target repo layout

```
<project>/
├── CLAUDE.md              # root: overview, cross-stack rules, pointers to sub-files
├── CHANGELOG.md           # dev log — Keep a Changelog format
├── STATUS.md              # current state / progress snapshot
├── TASKS.md               # open tasks / todo
├── docs/
│   ├── PRD.md             # provided
│   ├── SRS.md             # provided (optional)
│   ├── ARCHITECTURE.md    # generated
│   ├── DESIGN-SYSTEM.md   # generated
│   ├── DEV-HANDOFF.md     # generated
│   └── adr/
│       ├── README.md
│       └── 0001-record-architecture-decisions.md
├── client/ CLAUDE.md      # Angular conventions
├── api/    CLAUDE.md      # .NET conventions
└── db/     CLAUDE.md      # Postgres + EF Core migration conventions
```

Adapt folder names/stacks if the PRD specifies something different (e.g. a Node/TypeScript service instead of .NET).

## Baked-in conventions are defaults, not law

The per-stack CLAUDE.md content encodes the user's usual conventions (standalone Angular, .NET minimal API, Postgres + EF Core migrations). It does NOT bake in a UI component framework, a font, or a text direction — those are decided per project (UI framework via ask, font via design system, direction via PRD). Every default is marked as overridable in the generated file. If the PRD contradicts a default, follow the PRD and note the deviation. If a stack isn't present in the project, don't create its folder or CLAUDE.md.
