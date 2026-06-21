# Agent Management UI/API Handoff

OpenSpec change: `connect-agent-management-ui-api`

## Implemented And Tested

- Editable configuration use case and workspace-scoped HTTP route.
- Typed frontend client for list, create, configuration read, update, enable, disable, and delete.
- API-backed initial loading, empty state, error state, and retry behavior.
- Create and edit submissions with validation details, preserved values, canonical list refresh, and duplicate-request prevention.
- Enable, disable, and confirmed/cancelled delete flows with canonical list refresh.
- Local Express composition root, representative seed agents, and Vite `/api` proxy.
- Optional Prisma/PostgreSQL repository when `DATABASE_URL` is set.
- Contract tests, API-client tests, React component interaction tests, production build, and manual desktop/mobile browser verification.

## Deferred Scenarios

- Real Authentication, RBAC permission enforcement, and workspace membership resolution.
- Production backend composition, deployment configuration, observability, and rate limiting.
- Playwright end-to-end tests in CI.
- OpenClaw/workspace `skill.md` writes.

The local API still uses mock request context. Without `DATABASE_URL`, it uses resettable in-memory seed data. With `DATABASE_URL`, it uses PostgreSQL through `@vcp/database`, so the list reflects database records and may be empty.
