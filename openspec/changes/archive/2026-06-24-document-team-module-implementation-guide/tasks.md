## 1. Discovery

- [x] 1.1 Check repository state with `git status --short --branch`.
- [x] 1.2 Re-read `README.md`, `docs/openspec-team-guide.md`, `docs/module-ownership.md`, `docs/pr-checklist.md`, and `docs/api/module-api-contracts.md`.
- [x] 1.3 Confirm README currently contains feature-specific details that should move out of the root project overview.

## 2. Documentation Updates

- [x] 2.1 Rewrite `README.md` as a concise project overview with setup, workspace commands, test commands, and links to detailed docs only.
- [x] 2.2 Create `docs/team-module-implementation-guide.md` with teammate onboarding reading order, branch workflow, OpenSpec workflow, module scope rules, and verification commands.
- [x] 2.3 Add a per-module implementation checklist template covering owned folders, active OpenSpec change, API matrix route rows, shared contracts, Prisma models, domain events, tests, out-of-scope checks, and PR handoff.
- [x] 2.4 Update `docs/openspec-team-guide.md` to link to the new team module implementation guide and make it part of the required reading order.
- [x] 2.5 Update `docs/module-ownership.md` or `docs/pr-checklist.md` with a short pointer to the new implementation guide without duplicating the checklist.

## 3. Documentation Verification

- [x] 3.1 Add a lightweight documentation contract test that verifies the new guide exists and contains the required checklist sections.
- [x] 3.2 Verify the README links to detailed docs and does not contain feature-specific manual test sections.
- [x] 3.3 Wire the documentation check into `npm run test:contracts` if it fits existing test conventions.

## 4. Review and Validation

- [x] 4.1 Run `npm run test:contracts`.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run `npm run build`.
- [x] 4.4 Run `openspec validate "document-team-module-implementation-guide" --strict`.
- [x] 4.5 Run `openspec validate --all --strict`.
- [x] 4.6 Run `git diff --check`.
- [x] 4.7 Review added code lines and confirm this documentation change stays within the 500-added-code-line PR rule.
- [x] 4.8 Prepare PR notes that explicitly state this change is documentation-only and does not implement module endpoints, persistence, workers, shared contracts, or UI behavior.
