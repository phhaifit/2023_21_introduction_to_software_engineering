## Why

The current modular-monolith repository has good source-folder boundaries, but it still mixes frontend, backend, worker, shared-contract, and database dependencies in a single root `package.json`. That creates dependency pollution (for example, Express and Prisma are visible to the Vite React app) and makes module boundary reviews, security audits, and future deployment scripts harder than necessary.

Refactoring to standard NPM Workspaces keeps the existing modular-monolith architecture while raising the boundary from folder convention to package-level dependency isolation.

## What Changes

- Extract shared contracts into an isolated package (`@vcp/shared`).
- Extract the Prisma ORM and database models into an isolated package (`@vcp/database`).
- Extract the Express API server into an isolated package (`@vcp/backend`).
- Extract the Vite React app into an isolated package (`@vcp/frontend`).
- Extract background worker entry points into an isolated package (`@vcp/workers`) so async jobs use the same shared/database boundaries as the backend.
- Update root `package.json` to configure `"workspaces"` and unify dev tooling (TypeScript, Playwright).
- **BREAKING**: All internal imports across boundaries will need to use package references (e.g., `import { ... } from '@vcp/shared'`) instead of relative paths.
- Preserve the existing product module ownership model inside the backend and frontend packages.

## Capabilities

### New Capabilities
- `monorepo-workspaces`: Infrastructure setup for NPM workspaces and dependency isolation.

### Modified Capabilities

## Impact

- Root `package.json` and scripts.
- Location of frontend, backend, worker, shared contract, and Prisma source files.
- TypeScript, Vite, Vitest, Playwright, and Prisma configuration paths.
- `package-lock.json` workspace metadata.
- CI/CD build and test scripts.
- Documentation that references top-level `frontend/`, `backend/`, `workers/`, `shared/`, or `prisma/` paths.
