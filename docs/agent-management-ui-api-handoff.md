# Agent Management UI/API Handoff

OpenSpec change: `connect-agent-management-ui-api`

## Implemented And Tested

- Editable configuration use case and workspace-scoped HTTP route.
- Typed frontend client for list, create, configuration read, update, enable, disable, and delete.
- API-backed initial loading, empty state, error state, and retry behavior.
- Create and edit submissions with validation details, preserved values, canonical list refresh, and duplicate-request prevention.
- Enable, disable, and confirmed/cancelled delete flows with canonical list refresh.
- Local Express composition root, representative seed agents, and Vite `/api` proxy.
- Contract tests, API-client tests, React component interaction tests, production build, and manual desktop/mobile browser verification.

## Deferred Scenarios

- Prisma/PostgreSQL persistence and database restart durability.
- Real Authentication, RBAC permission enforcement, and workspace membership resolution.
- Production backend composition, deployment configuration, observability, and rate limiting.
- Playwright end-to-end tests in CI.
- OpenClaw/workspace `skill.md` writes.

The local API uses mock request context and resettable in-memory data. It must not be treated as the production authorization or persistence boundary.
