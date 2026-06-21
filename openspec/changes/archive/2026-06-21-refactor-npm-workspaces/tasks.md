## 1. Directory Setup & Root Configuration

- [x] 1.1 Create `packages/shared`, `packages/database`, `apps/backend`, `apps/frontend`, and `apps/workers` directories
- [x] 1.2 Update root `package.json` to define `"workspaces": ["packages/*", "apps/*"]`
- [x] 1.3 Remove application-specific dependencies from root `package.json` while keeping root-level orchestration and shared dev tooling
- [x] 1.4 Regenerate `package-lock.json` with `npm install` so workspace links and dependency ownership are recorded

## 2. Migrate Shared Contracts (@vcp/shared)

- [x] 2.1 Move `shared/` contents to `packages/shared/src/`
- [x] 2.2 Create `packages/shared/package.json` with name `@vcp/shared`
- [x] 2.3 Set up package entry points to export shared contracts and demo workspace constants
- [x] 2.4 Ensure `@vcp/shared` has no dependency on backend, frontend, workers, database, Express, React, or Prisma packages

## 3. Migrate Database (@vcp/database)

- [x] 3.1 Move `prisma/` directory from root to `packages/database/`
- [x] 3.2 Move or update Prisma configuration so schema and migration paths resolve under `packages/database/`
- [x] 3.3 Create `packages/database/package.json` with name `@vcp/database` and database-only Prisma dependencies
- [x] 3.4 Add database client export entry points in `@vcp/database`
- [x] 3.5 Update root Prisma scripts or documentation to run Prisma commands through the database workspace

## 4. Migrate Backend (@vcp/backend)

- [x] 4.1 Move `backend/` source files to `apps/backend/src/`
- [x] 4.2 Create `apps/backend/package.json` with name `@vcp/backend`, adding dependencies on Express, PG, `@vcp/shared`, and `@vcp/database`
- [x] 4.3 Update backend code imports to use `@vcp/shared` and `@vcp/database` instead of relative paths
- [x] 4.4 Preserve the existing backend modular-monolith layout under `apps/backend/src/modules/*` and `apps/backend/src/shared/*`

## 5. Migrate Frontend (@vcp/frontend)

- [x] 5.1 Move `frontend/` contents, `index.html`, and `vite.config.ts` to `apps/frontend/`
- [x] 5.2 Create `apps/frontend/package.json` with name `@vcp/frontend`, React dependencies, Vite dev dependencies, and `@vcp/shared`
- [x] 5.3 Update frontend code imports to use `@vcp/shared`
- [x] 5.4 Ensure `@vcp/frontend` does not depend on backend, database, or worker packages

## 6. Migrate Workers (@vcp/workers)

- [x] 6.1 Move `workers/` source files to `apps/workers/src/`
- [x] 6.2 Create `apps/workers/package.json` with name `@vcp/workers`, adding dependencies on `@vcp/shared` and `@vcp/database` as needed
- [x] 6.3 Update worker imports to use `@vcp/shared` and `@vcp/database` instead of relative paths
- [x] 6.4 Keep worker jobs as async/background boundaries; do not add new product behavior in this refactor

## 7. Tooling, Tests, and Documentation

- [x] 7.1 Update root `package.json` scripts to delegate app-specific commands through `--workspace`
- [x] 7.2 Update TypeScript configuration for workspace package resolution
- [x] 7.3 Update Vite and Vitest configuration paths for `apps/frontend`
- [x] 7.4 Update Playwright configuration so root E2E tests start the workspace-aware dev script
- [x] 7.5 Update root contract, component, persistence, and E2E tests to import through package entry points for cross-workspace boundaries
- [x] 7.6 Update architecture/team documentation that references moved top-level paths
- [x] 7.7 Run `npm test`
- [x] 7.8 Run `npm run build`
- [x] 7.9 Run `openspec validate "refactor-npm-workspaces"`
- [x] 7.10 Run `openspec validate --all --strict`
- [x] 7.11 Run `git diff --check`
