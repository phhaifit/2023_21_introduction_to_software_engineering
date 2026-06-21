## Context

Before this change, the repository was already organized as a modular monolith with vertical slices: product capabilities lived under backend modules and frontend feature folders, shared contracts lived under `shared/contracts`, workers lived under `workers`, and Prisma lived under `prisma`.

The architectural issue addressed by this change is dependency isolation. A single root `package.json` exposed frontend, backend, worker, database, and test dependencies to every part of the repository. That made it easy for the frontend to accidentally depend on backend-only packages, for workers to bypass shared/database boundaries, and for reviews to miss dependency-boundary regressions.

This change keeps the modular-monolith runtime architecture. It does not split the product into independently deployed microservices.

## Goals / Non-Goals

**Goals:**
- Completely isolate dependencies for the frontend, backend, workers, database, and shared contracts.
- Use NPM Workspaces to maintain a single `npm install` step and a hoisted `node_modules` structure for disk efficiency.
- Ensure cross-boundary imports use module resolution (e.g., `@vcp/shared`) instead of relative paths (e.g., `../../../shared`).
- Preserve the existing vertical-slice module boundaries inside `apps/backend/src/modules/*` and `apps/frontend/src/features/*`.
- Keep root scripts as the developer entrypoint for install, dev, test, build, and OpenSpec validation.

**Non-Goals:**
- Adopting complex monorepo tools like Nx, Lerna, or Turborepo. Standard NPM Workspaces are sufficient for now.
- Refactoring the internal hexagonal architecture of the `backend` module.
- Changing Agent Management behavior, API semantics, persistence behavior, RBAC behavior, or worker job semantics.
- Turning the modular monolith into independently deployed services.

## Decisions

- **5-Workspace Split**: We will create 5 workspaces:
  - `packages/shared` (`@vcp/shared`): TS definitions and contracts.
  - `packages/database` (`@vcp/database`): Prisma schema, migrations, and database client entry points. Extracted from backend so background workers can use the same persistence boundary.
  - `apps/backend` (`@vcp/backend`): Express server and domain logic.
  - `apps/frontend` (`@vcp/frontend`): React Vite app.
  - `apps/workers` (`@vcp/workers`): background worker entry points and queue/job placeholders.
- **Directory Structure Strategy**: Group shared libraries under `packages/` and runnable applications under `apps/` for semantic clarity.
- **Root Tooling**: Keep Vite configuration inside `apps/frontend` because it is app-specific. Keep Playwright at the root because it verifies cross-package user flows. TypeScript and Vitest may use root aggregate configs plus per-workspace configs where needed.
- **Dependency Direction**:
  - `@vcp/frontend` may depend on `@vcp/shared`.
  - `@vcp/backend` may depend on `@vcp/shared` and `@vcp/database`.
  - `@vcp/workers` may depend on `@vcp/shared` and `@vcp/database`.
  - `@vcp/database` must not depend on backend, frontend, or workers.
  - `@vcp/shared` must not depend on backend, frontend, workers, or database.
- **Package Imports**: Cross-boundary imports must use package names (`@vcp/shared`, `@vcp/database`) rather than relative paths into another workspace.
- **Testing Layout**: Existing root tests can remain at `tests/` during the migration, but imports must be updated to package/workspace entry points where they cross a package boundary. E2E tests remain root-level.

## Risks / Trade-offs

- **Risk: Symlink Issues in Vite/TypeScript** → Mitigation: Configure Vite's module resolution and TypeScript's `paths` or `references` correctly to ensure it watches for changes in `@vcp/shared`.
- **Risk: Prisma Client Generation Path** → Mitigation: Ensure the `@vcp/database` workspace specifies the correct output path for the generated Prisma Client so other workspaces can import it properly.
- **Risk: Big-bang Path Churn** → Mitigation: Apply this as an infrastructure-only branch and avoid feature behavior changes in the same PR.
- **Risk: Test Imports Mask Boundary Problems** → Mitigation: Prefer imports through workspace package entry points in tests when testing cross-workspace contracts; keep deep imports only for package-internal tests.
