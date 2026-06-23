## Why

Feature teams now have route boundaries, shared contracts, and module ownership, but teammates still need a single operational guide that explains how to start module work, stay inside scope, update contracts safely, and verify PRs before merging.

This change creates onboarding and module implementation guidance before the team implements many endpoints and persistence layers in parallel, reducing accidental cross-module imports, ad hoc DTOs, database drift, and README clutter.

## What Changes

- Add a team module implementation guide that tells each teammate what to read first, which files they own, which OpenSpec change to follow, which commands to run, and what must be included in each PR.
- Add a per-module checklist template covering module ownership, allowed files, public API route rows, shared contracts, Prisma models, domain events, tests, and out-of-scope items.
- Add guidance for when a teammate may update shared contracts, Prisma schema, API matrix, or domain events.
- Add reviewer-oriented checks that confirm a module PR follows the assigned OpenSpec task and does not implement unrelated module behavior.
- Simplify `README.md` so it contains only project overview, architecture summary, repository entrypoints, and links to detailed docs; feature details and manual test steps move to module/team docs.
- Keep this change documentation-only; do not implement module endpoints, persistence, workers, or UI behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `team-workflow`: Add requirements for team onboarding documentation, per-module implementation checklists, README scope boundaries, and documentation verification before feature teams implement module endpoints and persistence.

## Impact

- Affected docs: `README.md`, likely `docs/team-module-implementation-guide.md`, `docs/module-ownership.md`, and `docs/pr-checklist.md`.
- Affected OpenSpec: `openspec/specs/team-workflow/spec.md` after sync/archive.
- Affected tests: optional documentation contract check under `tests/contract` to verify the onboarding guide, README scope, and checklist links remain present.
- Runtime behavior: none.
- Dependencies: no new production dependency.
