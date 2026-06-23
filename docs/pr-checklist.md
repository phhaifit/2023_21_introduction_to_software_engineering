# Pull Request Checklist

Use this checklist before requesting review.

For module implementation work, complete the full per-module checklist in `docs/team-module-implementation-guide.md` before opening the PR.

## OpenSpec

- [ ] PR references the relevant OpenSpec change
- [ ] PR references the relevant task from that change's `tasks.md`
- [ ] The implemented behavior matches the relevant capability spec
- [ ] Any behavior change is reflected in the spec
- [ ] Any architecture change is reflected in `design.md`
- [ ] The per-module checklist from `docs/team-module-implementation-guide.md` has been reviewed

## Module Boundary

- [ ] Code stays inside the assigned `apps/backend` module and `apps/frontend` feature unless shared work is intentional
- [ ] No private imports from another capability module
- [ ] Shared contracts changed only when necessary and reviewed
- [ ] Database access goes through `@vcp/database`, not relative Prisma imports

## Tests

- [ ] Contract tests pass if shared contracts or skeleton paths changed
- [ ] Unit/component/service tests added for implemented behavior
- [ ] E2E tests added or updated when an integrated flow is affected

## Commands

Run before PR:

```bash
npm test
openspec validate "<change-name>"
openspec validate --all --strict
git diff --check
```

Add any feature-specific commands to the PR description.
