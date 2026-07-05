# Virtual Company Platform

Virtual Company Platform là nền tảng ảo hóa công ty dựa trên OpenClaw. Dự án tổ chức frontend, backend, worker, shared contracts và database schema trong một NPM Workspaces monorepo để nhiều thành viên có thể phát triển module song song nhưng vẫn giữ ranh giới kiến trúc rõ ràng.

## Project Overview

Dự án dùng mô hình modular monolith theo vertical slices. Mỗi product capability có backend module, frontend feature folder và OpenSpec change riêng. Các phần dùng chung như identity, role, status, API envelope, domain event, Prisma schema boundary và worker boundary được quản lý ở tầng foundation.

OpenSpec là source of truth cho planning và implementation. Không implement module behavior chỉ dựa trên README hoặc chat context.

## Workspace Layout

| Workspace | Package | Responsibility |
| --- | --- | --- |
| `apps/frontend` | `@vcp/frontend` | React + Vite application |
| `apps/backend` | `@vcp/backend` | Express API development server and backend modules |
| `apps/workers` | `@vcp/workers` | Background job entry points |
| `packages/shared` | `@vcp/shared` | Shared contracts, IDs, roles, statuses, events, and API shapes |
| `packages/database` | `@vcp/database` | Prisma schema, migrations, generated client access, and database exports |

## Setup

Recommended Node.js version:

- Node.js `22.14.0`
- On Windows, this project has been tested with local Node at `D:\.tools\node-v22.14.0-win-x64`

Install dependencies:

```bash
npm install
```

Install Playwright browsers when E2E tests are needed:

```bash
npx playwright install
```

## Local Development

Run the local backend and frontend from the repository root:

```bash
npm run dev
```

Windows PowerShell example:

```powershell
cd D:\University\third_year\hk6\cnpm\project\2023_21_introduction_to_software_engineering
$env:Path = 'D:\.tools\node-v22.14.0-win-x64;' + $env:Path
npm.cmd run dev
```

Or use the included helper script:

```powershell
.\run-dev-local.cmd
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:3001`

Keep the terminal running while demoing the application. Press `Ctrl + C` to stop the dev server.

If the backend cannot connect to Prisma/PostgreSQL, it falls back to in-memory repositories for local demo use. In-memory data is reset when the server stops.

If a port is already in use, check existing processes:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

## Database

Prisma commands must run from the repository root through the database workspace:

```bash
npm run prisma -- validate
npm run prisma -- migrate deploy
```

`DATABASE_URL` for Prisma may include `?schema=public`. For `psql`, use a URL without that query parameter.

## Environment And Secrets

Do not commit real environment files or credentials. The repository ignores:

- `.env`
- `.env.*`
- log files
- `node_modules`
- build output such as `dist`

Use `.env.example` as the template for local configuration. For email invitation sending, configure SMTP values locally only. If SMTP is not configured, the app can still run, but email delivery may be skipped or fail depending on the flow being tested.

## Verification

Run the focused Workspace User Management verification commands from the repository root:

```powershell
$env:Path = 'D:\.tools\node-v22.14.0-win-x64;' + $env:Path
.\node_modules\.bin\vitest.cmd run --config vitest.config.ts --environment jsdom tests/component/accept-invite-page.test.tsx tests/component/authentication-page-validation.test.tsx tests/component/authentication-api-client.test.ts tests/component/authentication-context.test.tsx tests/component/workspace-unified-routing.test.ts tests/component/workspace-user-management-api-client.test.ts tests/component/workspace-management-api-client.test.ts tests/component/workspace-invitation-extra2.test.ts
.\node_modules\.bin\vitest.cmd run --config vitest.config.ts --environment jsdom apps/backend/src/modules/workspace-user-management/application/workspace-user-management-service.test.ts apps/backend/src/shared/email/email-service.test.ts apps/backend/src/modules/workspace-management/application/workspace-use-cases.test.ts
npm run build
git diff --check
```

Additional commands:

```bash
npm test
npm run test:contracts
npm run test:e2e
openspec validate --all --strict
```

Note: the full `npm test` suite may fail in the task-orchestration contract runner if Node runs `.mjs` files that import `.ts` files directly. That failure is outside Workspace User Management. Use the focused commands above for this feature.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Module ownership](docs/module-ownership.md)
- [Team module implementation guide](docs/team-module-implementation-guide.md)
- [OpenSpec team guide](docs/openspec-team-guide.md)
- [API route matrix](docs/api/module-api-contracts.md)
- [Pull request checklist](docs/pr-checklist.md)
- [Knowledge Base / RAG local demo](docs/knowledge-base-rag-local-demo.md)
- [Final local KB/RAG demo script](docs/demo/kb-rag/final-local-rag-demo-script.md)

## OpenSpec

Use these commands to inspect and validate active changes:

```bash
openspec list
openspec status --change "<change-name>"
openspec validate "<change-name>" --strict
openspec validate --all --strict
```

Before coding a module, read the assigned OpenSpec change and follow the team module implementation guide.
