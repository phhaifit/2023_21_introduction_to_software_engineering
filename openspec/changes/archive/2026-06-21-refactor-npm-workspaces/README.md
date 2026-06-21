# refactor-npm-workspaces

Refactor the existing modular-monolith repository into an NPM Workspaces layout to eliminate dependency pollution and establish package-level boundary isolation. Extract the codebase into five workspaces: @vcp/shared (contracts and interfaces), @vcp/database (Prisma ORM and migrations), @vcp/backend (Express API server), @vcp/frontend (Vite React application), and @vcp/workers (background job entry points). Configure the root package.json to orchestrate workspace symlinks, centralize shared dev tooling, and provide unified build/dev/test scripts.
