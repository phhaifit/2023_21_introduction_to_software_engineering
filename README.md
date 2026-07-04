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

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:3001`

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

## Verification

Run the main verification commands from the repository root:

```bash
npm test
npm run build
openspec validate --all --strict
git diff --check
```

Additional commands:

```bash
npm run test:contracts
npm run test:e2e
```

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Module ownership](docs/module-ownership.md)
- [Team module implementation guide](docs/team-module-implementation-guide.md)
- [OpenSpec team guide](docs/openspec-team-guide.md)
- [API route matrix](docs/api/module-api-contracts.md)
- [Pull request checklist](docs/pr-checklist.md)
- [Knowledge Base / RAG local demo](docs/knowledge-base-rag-local-demo.md)

## OpenSpec

Use these commands to inspect and validate active changes:

```bash
openspec list
openspec status --change "<change-name>"
openspec validate "<change-name>" --strict
openspec validate --all --strict
```

Before coding a module, read the assigned OpenSpec change and follow the team module implementation guide.
