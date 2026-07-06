# Agent Working Rules

These rules apply to the whole repository. Keep feature-specific behavior in
OpenSpec changes and specs, not in this file.

Follow these rules before project-specific chat context unless the user
explicitly overrides them.

## Communication

- Use Vietnamese by default; keep technical terms in English when clearer.
- Use English for OpenSpec artifact names, commit messages, branch names, and
  pull-request content.
- Use a pragmatic, scientific, and direct response style.
- Report concrete commands, changed files, verification results, and known gaps.
- Do not claim that a command passed unless it was actually executed.

## Protected Files

- Never read, modify, stage, or commit any file inside `.local-docs/`.
- Apply the same rule to any other directory explicitly identified as personal.
- Treat personal directories as invisible to repository analysis and Git
  operations.
- Do not use broad staging commands before checking that protected files are not
  included.

## Source of Truth

- OpenSpec is the source of truth for project planning and implementation.
- Do not implement product behavior from memory or chat context alone.
- Before coding, read the relevant source-of-truth files:
  1. `docs/requirements.md`
  2. `docs/architecture.md`
  3. `docs/module-ownership.md`
  4. `docs/team-module-implementation-guide.md`
  5. `docs/openspec-team-guide.md`
  6. relevant baseline specs under `openspec/specs/`
  7. the active change's `proposal.md`, `design.md`, `spec.md`, and `tasks.md`
- Use `docs/team-module-implementation-guide.md`, `docs/openspec-team-guide.md`,
  and `docs/pr-checklist.md` for detailed team workflow guidance.

## Working Workflow

- Start implementation work with:

  ```bash
  git status --short --branch
  ```

- If the worktree contains unrelated or unclear changes, stop and report the
  dirty files before pulling, switching branches, or editing files.
- For implementation work, start from the latest default integration branch
  unless the user instructs otherwise:

  ```bash
  git checkout master
  git pull --ff-only origin master
  ```

- Create a focused branch before editing:

  ```text
  feature/<module>/<change-short-name>
  test/<module>/<change-short-name>
  docs/<module>/<change-short-name>
  chore/<change-short-name>
  ```

- Implement only the selected OpenSpec task or explicitly requested scope.
- Do not implement later tasks in `tasks.md` unless the user explicitly requests
  them.
- Add focused automated tests together with implemented behavior.
- Update a `tasks.md` checkbox only after implementation and relevant
  verification commands pass.
- Archive a change only when all tasks are complete, main specs have been
  synchronized, required checks pass, and the user explicitly requests or
  approves archival.

## Scope Control

- Keep each PR focused on one OpenSpec task or one small implementation slice.
- Do not combine unrelated modules, unrelated features, or large refactors in
  one PR.
- If a change becomes broad, split it by behavior, test scope, or module
  boundary.
- Explain any large but necessary change in the PR summary.

## Module Boundaries

A module may import:

- `@vcp/shared`
- `@vcp/database` from backend or worker code only
- `apps/backend/src/shared/*`
- files inside the same module

A module must not import:

- another module's private service
- another module's private repository
- another module's private state store
- another module's private UI component
- Prisma internals by relative path
- backend, database, or worker files from frontend code

If another module's data is needed, use a public API, DTO, domain event,
adapter, or shared contract.

## Shared Boundaries and Dependencies

- Changing `packages/shared/src/contracts` or public `@vcp/shared` exports
  affects multiple modules.
- Before changing shared contracts, Prisma schema, API route boundaries, or
  domain events:
  1. explain why the existing boundary is insufficient
  2. confirm the active OpenSpec task requires the change
  3. update the relevant spec or design artifact
  4. add or update focused tests
  5. request review from another module owner
- Do not add a production dependency without explicit approval.
- Before proposing a dependency, explain the need, existing alternatives,
  bundle/test impact, and maintenance cost.
- Do not run dependency-upgrade commands unless explicitly requested.

## Verification

Before completing implementation work, run the relevant repository commands:

```bash
npm test
npm run build
openspec validate "<change-name>" --strict
openspec validate --all --strict
git diff --check
```

Run only when relevant:

```bash
npm run prisma -- validate
npm run test:e2e
```

Do not hide failed commands or unresolved issues.

## Git Safety

- Do not commit, push, or open a pull request unless explicitly requested.
- Before staging, review:

  ```bash
  git status --short
  git diff --stat
  git diff
  ```

- Stage only files that belong to the current task.
- Never stage `.local-docs/` or another personal directory.
- Do not use broad staging commands without reviewing what will be staged.

## Commit Message Convention

Use Conventional Commit format:

```text
<type>(<scope>): <summary>
```

Allowed types:

- `feat`: new product behavior
- `fix`: bug fix
- `test`: test-only change
- `docs`: documentation-only change
- `refactor`: code restructure without behavior change
- `chore`: tooling, config, dependency, or maintenance change
- `style`: formatting or CSS-only change with no behavior change

Scope should be the capability or area changed, for example:

```text
agent-management
task-orchestration
workflow-management
authentication
workspace-management
shared-contracts
database
openspec
docs
frontend
backend
```

Examples:

```text
feat(agent-management): redesign app shell sidebar
fix(task-orchestration): stop streaming after cancellation
test(agent-management): cover viewer mode restrictions
docs(openspec): add redesign app shell proposal
chore(frontend): add lucide icon dependency
```

Rules:

- Use imperative mood: `add`, `fix`, `update`, not `added` or `adds`.
- Keep the summary under 72 characters when practical.
- Do not include AI/tool branding.
- Do not mix unrelated modules in one commit.
- Use `BREAKING CHANGE:` in the commit body only when public behavior or
  contracts are intentionally incompatible.

## Pull Request Summary Template

Use this PR summary format unless the user requests a different one:

```md
## Summary

-
-

## OpenSpec

Change: `<change-name>`

Completed tasks:

- [x]

## Scope

-

## Out of Scope

-

## Files Changed

-

## Tests

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `openspec validate "<change-name>" --strict`
- [ ] `openspec validate --all --strict`
- [ ] `git diff --check`

Additional commands, if relevant:

- [ ] `npm run prisma -- validate`
- [ ] `npm run test:e2e`

## Manual Test

-

## Shared Boundary Impact

- Shared contracts changed: No / Yes
- Prisma schema changed: No / Yes
- API route boundary changed: No / Yes
- New production dependency: No / Yes

## Known Gaps / Risks

-
```

PR rules:

- Mark a test checkbox only if the command was actually run.
- Mention failed commands and unresolved issues directly.
- Keep PR scope tied to one OpenSpec task or one small implementation slice.
- If a dependency is added, explain why it is needed and why existing repo tools
  are insufficient.
- If shared contracts, Prisma, API routes, or events change, request review from
  another module owner.

## Completion Report

After implementation, report:

1. Files created or modified
2. Behavior implemented
3. Tests added or updated
4. Commands executed
5. Exact command results
6. Remaining risks or gaps
7. Suggested Conventional Commit message
