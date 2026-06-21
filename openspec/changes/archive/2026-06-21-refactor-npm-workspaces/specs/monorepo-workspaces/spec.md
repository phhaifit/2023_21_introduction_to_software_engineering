## ADDED Requirements

### Requirement: NPM Workspaces configuration
The repository MUST be structured as an NPM Workspaces monorepo containing `shared`, `database`, `backend`, `frontend`, and `workers` packages.

#### Scenario: Running npm install
- **WHEN** a developer runs `npm install` at the project root
- **THEN** dependencies for all workspaces are installed and hoisted to the root `node_modules` directory where NPM can safely hoist them

### Requirement: Cross-workspace dependency resolution
Packages within the monorepo MUST be able to import from each other using their declared package names.

#### Scenario: Backend importing shared contracts
- **WHEN** the `@vcp/backend` code imports from `@vcp/shared`
- **THEN** the module bundler and Node.js runtime correctly resolve the import to the local `shared` package directory instead of searching external registries

### Requirement: Dependency direction boundaries
Workspace packages MUST follow the platform dependency direction rules.

#### Scenario: Frontend dependency review
- **WHEN** `@vcp/frontend` declares its workspace dependencies
- **THEN** it depends on `@vcp/shared` but not on `@vcp/backend`, `@vcp/database`, or `@vcp/workers`

#### Scenario: Backend and workers use persistence boundary
- **WHEN** backend code or worker code needs database access
- **THEN** it imports database entry points through `@vcp/database` rather than importing Prisma files through relative paths

#### Scenario: Shared contracts remain infrastructure-free
- **WHEN** `@vcp/shared` declares its dependencies
- **THEN** it does not depend on backend, frontend, worker, database, Express, React, or Prisma packages

### Requirement: Root execution of development scripts
The root `package.json` MUST provide unified scripts to run development servers for all workspaces.

#### Scenario: Running the dev script
- **WHEN** a developer runs `npm run dev` at the root
- **THEN** the Vite frontend server and Express backend server start concurrently

### Requirement: Workspace-aware verification
The repository MUST keep root-level verification commands after the workspace migration.

#### Scenario: Running tests from the root
- **WHEN** a developer runs `npm test` at the project root
- **THEN** shared contract, backend, frontend component, and relevant integration tests run against the workspace layout

#### Scenario: Running frontend build from the root
- **WHEN** a developer runs the root build command
- **THEN** the command builds the frontend workspace without requiring the developer to manually enter `apps/frontend`

#### Scenario: Running OpenSpec validation
- **WHEN** a developer runs OpenSpec validation from the root
- **THEN** validation still resolves the repository-local OpenSpec configuration and change artifacts
