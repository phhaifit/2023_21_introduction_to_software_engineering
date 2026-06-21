# OpenSpec Team Guide

OpenSpec is the source of truth for project planning and implementation.

Do not start coding from memory or chat messages. Start from the relevant OpenSpec change.

## Foundation Baseline

```bash
openspec list
openspec validate --all --strict
```

The foundation change has been completed and archived:

```text
openspec/changes/archive/2026-06-20-design-virtual-company-platform-architecture
```

The active baseline is now in:

```text
openspec/specs/platform-architecture/spec.md
openspec/specs/project-skeleton/spec.md
openspec/specs/shared-contracts/spec.md
openspec/specs/team-workflow/spec.md
```

These specs define architecture, shared contracts, skeleton layout, and team workflow. They do not contain detailed feature behavior specs for authentication, agents, payment, RAG, or other product modules.

## Files to Read First

Read these in order:

1. `docs/requirements.md`
2. `docs/architecture.md`
3. `openspec/specs/platform-architecture/spec.md`
4. `openspec/specs/shared-contracts/spec.md`
5. `docs/module-ownership.md`
6. The proposal/design/spec/tasks for your module-specific OpenSpec change, such as `implement-authentication` or `implement-agent-management`

## Daily Workflow

```text
Pull latest code
  -> openspec status
  -> read the foundation baseline specs
  -> read your module-specific change
  -> pick a task in that change's tasks.md
  -> create a branch
  -> implement only your capability boundary
  -> run tests
  -> run openspec validate
  -> open PR
```

Commands:

```bash
openspec list
openspec status --change "<your-module-change>"
openspec validate "<your-module-change>"
openspec validate --all --strict
npm test
```

For feature work, replace `<your-module-change>` with your assigned module-specific change name.

## When to Update OpenSpec

| Situation | Update |
| --- | --- |
| Requirement behavior changes | Your module change's `specs/<capability>/spec.md` |
| Architecture or module boundary changes | Create a new architecture change; do not edit archived foundation history |
| Scope changes | The relevant change's `proposal.md` |
| New implementation work is discovered | The relevant change's `tasks.md` |
| Only code changes according to current spec | No OpenSpec artifact change required |

## Task Checkbox Rule

Use `tasks.md` as the team checklist.

- Leave `[ ]` while a task is not done.
- Mark `[x]` only after implementation and verification are complete.
- If the task requires another person or unclear design, do not guess. Raise it in PR or team chat.

## Contract Change Rule

Changing anything in `packages/shared/src/contracts` or the `@vcp/shared` public exports affects multiple modules.

Before changing contracts:

1. Explain why the current contract is insufficient.
2. Update affected specs/design if behavior or architecture changes.
3. Run contract tests.
4. Ask at least one other module owner to review.

## Module Boundary Rule

You may import:

- `@vcp/shared`
- `@vcp/database` from backend or worker code only
- `apps/backend/src/shared/*`
- files inside your own module

You should not import another module's internal service/repository/UI files.

If you need another module's data, use an API, DTO, domain event, or shared contract.

## Workspace Commands

Run these from the repository root:

```bash
npm install
npm run dev
npm test
npm run build
npm run prisma -- validate
```

Feature-specific scripts can still be delegated explicitly through npm workspaces, for example:

```bash
npm run dev --workspace=@vcp/frontend
npm run dev --workspace=@vcp/backend
```
