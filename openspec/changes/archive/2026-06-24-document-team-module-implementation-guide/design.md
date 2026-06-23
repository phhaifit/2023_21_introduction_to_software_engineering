## Context

The repository now has foundation specs for architecture, shared contracts, data model boundaries, and API route boundaries. It also has module ownership and PR checklist documents. However, teammate-facing guidance is still fragmented:

- `README.md` mixes project overview, feature descriptions, development commands, database notes, and Agent Management manual test steps.
- `docs/openspec-team-guide.md` explains the OpenSpec flow but does not give a module-by-module implementation checklist.
- `docs/module-ownership.md` assigns modules but does not tell each owner what to inspect before coding or how to avoid scope creep.
- `docs/api/module-api-contracts.md` defines route boundaries, but teammates still need a practical checklist that connects routes to shared contracts, Prisma models, tests, and PR expectations.

This change is documentation-only and prepares the team for parallel endpoint and persistence implementation.

## Goals / Non-Goals

**Goals:**

- Keep the root `README.md` concise: project overview, architecture summary, workspace entrypoints, setup/test commands, and links to detailed docs.
- Move feature-specific/manual-test details out of `README.md` and into module/team documentation.
- Add a teammate onboarding guide that explains the reading order, branch workflow, OpenSpec workflow, allowed edit scope, verification commands, and PR expectations.
- Add a per-module checklist template that each module owner can use before implementing endpoints, persistence, contracts, events, UI, and tests.
- Update existing team docs so contributors can find the onboarding guide and route/API matrix from one place.
- Add lightweight documentation verification if useful.

**Non-Goals:**

- Do not implement endpoints, persistence, workers, UI behavior, database migrations, or shared contracts.
- Do not rewrite all feature README files in this change.
- Do not change module ownership assignments.
- Do not remove detailed requirement information from `docs/requirements.md`.

## Decisions

### Keep README As The Project Entry Point

`README.md` will be a concise entry point for the repository. It will not list all feature behavior or contain module manual test instructions. Instead, it will link to `docs/requirements.md`, `docs/architecture.md`, `docs/module-ownership.md`, `docs/api/module-api-contracts.md`, `docs/openspec-team-guide.md`, and the new module implementation guide.

Alternative considered: keep all onboarding content in `README.md`. Rejected because the README becomes hard to scan and encourages teammates to treat feature summaries as implementation scope instead of OpenSpec.

### Add One Team Module Implementation Guide

Create a dedicated guide, likely `docs/team-module-implementation-guide.md`, that gives every module owner the same operational checklist:

- read order before coding
- assigned OpenSpec change
- owned backend/frontend folders
- public API route rows
- shared contracts and DTO rules
- Prisma/model ownership rules
- domain event rules
- tests to add and commands to run
- out-of-scope checks
- PR handoff checklist

Alternative considered: put this checklist only in `docs/module-ownership.md`. Rejected because ownership assignment should remain compact, while implementation guidance is longer and needs examples.

### Keep Module Details As References, Not Duplicated Specs

The guide should point module owners to `docs/api/module-api-contracts.md`, active `openspec/changes/implement-*`, and main specs instead of duplicating every detailed route, DTO, or Prisma field.

Alternative considered: copy every API route and schema field into the onboarding guide. Rejected because duplicate route/schema lists will drift from the API matrix and Prisma/OpenSpec sources of truth.

### Verify Documentation Boundaries

If a test is added, it should verify documentation structure rather than runtime behavior: README links, presence of the team guide, required checklist sections, and README not containing feature-specific manual test content.

Alternative considered: no test. Acceptable for a small doc-only change, but lightweight verification is useful because the goal is to keep README and onboarding boundaries stable.

## Risks / Trade-offs

- Documentation can drift from module implementation -> Link to canonical OpenSpec specs and route matrix rather than duplicating field-level contracts.
- Teammates may still skip the guide -> Update README and `docs/openspec-team-guide.md` to make the guide part of the required reading order.
- README may become too sparse -> Keep setup/test commands and key doc links so new contributors still have a clear entry point.
- Per-module checklist may be too generic -> Include module-owner fill-in fields and concrete references to module folders, active OpenSpec changes, API matrix, shared contracts, Prisma, events, and tests.
