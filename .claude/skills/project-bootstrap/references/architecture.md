# Architecture document — generation guide

Produce `docs/ARCHITECTURE.md` from the PRD (+ SRS). This is the source of truth that the design system, dev handoff, CLAUDE.md files, and initial ADRs all derive from. Keep it decision-oriented — describe what was chosen and why, not a textbook of the technologies.

## Before writing

- Extract functional scope, non-functional requirements (perf, scale, compliance), and any explicit tech constraints from the PRD/SRS.
- Identify integrations named in the PRD (payment providers, SAP B1 Service Layer, POS, WhatsApp, etc.).
- Note locale/compliance requirements only if the PRD raises them (text direction, applicable privacy law such as Amendment 13, data residency). Do not assume a locale.
- For every meaningful either/or decision, capture the alternatives and the reason for the pick — these become ADR 0002+.

## Template

```markdown
# Architecture — <Project Name>

> Derived from PRD (and SRS). Last updated: <date>

## 1. Overview
One paragraph: what the system is and the shape of the solution.

## 2. System context
- Actors / user types
- External systems and integrations
- A context diagram (mermaid `graph` or ASCII) showing the boundary

## 3. High-level architecture
- Monorepo layout: client/ (Angular), api/ (.NET minimal API), db/ (Postgres + EF Core migrations)
- Component/container diagram (mermaid)
- Request/data flow for the 1–2 most important journeys

## 4. Stack decisions
Per layer: chosen tech, version target, and rationale. Table form:
| Layer | Choice | Version | Why | Alternatives considered |

## 5. Data architecture
- Core entities and relationships (ER diagram)
- Multi-tenancy model (if any)
- Migration strategy (EF Core migrations by default; note provider if the PRD specifies one)
- RLS / row-level security posture

## 6. API design
- Style (REST minimal API), versioning, auth (JWT/…)
- Cross-cutting: idempotency, error envelope, pagination
- Reference patterns the user favors when relevant: Outbox, circuit breaker, rate limiting

## 7. Frontend architecture
- Angular app structure, routing, state approach
- Text direction / i18n strategy — only if the PRD requires it (do not assume direction)
- UI component framework: state it as decided for this project (e.g. Angular Material or custom/design-system-driven); do not default to one
- Design-system integration point

## 8. Non-functional requirements
Performance, scalability, availability, observability, security posture — each tied back to a PRD requirement.

## 9. Compliance & locale
Israeli privacy law (Amendment 13) consent/retention, data residency, accessibility (WCAG 2.1 AA) — include only what the PRD implies.

## 10. Cross-cutting concerns
Logging, config/secrets, error handling, auth/authz, caching.

## 11. Deployment & environments
Environments, hosting, CI/CD outline, migration flow.

## 12. Risks & open questions
Bullet list. Anything the PRD left ambiguous goes here rather than being invented.

## 13. Decisions log pointer
"Key decisions are recorded as ADRs under docs/adr/."
```

## After writing

Propose seeding ADR entries (0002+) for the significant decisions surfaced in sections 4–6, and offer to generate the CLAUDE.md files and ceremony files next. Do not auto-generate them.
