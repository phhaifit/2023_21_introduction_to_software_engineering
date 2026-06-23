## 1. Scope and Current-State Review

- [x] 1.1 Check repository state with `git status --short --branch` before implementation edits.
- [x] 1.2 Re-read `docs/requirements.md`, `docs/architecture.md`, `docs/module-ownership.md`, and the current shared-contract specs before editing route-boundary files.
- [x] 1.3 Confirm current backend route progress for Agent Management and Subscription & Payment from source code and tests.
- [x] 1.4 Confirm remaining module feature changes are not completed enough to implement new runtime routes in this foundation change.

## 2. API Matrix Documentation

- [x] 2.1 Create or update `docs/api/module-api-contracts.md` as the canonical API route matrix.
- [x] 2.2 Document common API rules for `/api` prefixing, workspace scoping, authenticated context, shared response envelopes, pagination, validation errors, auth errors, and owner modules.
- [x] 2.3 Add Authentication route rows for register, login, logout, and current-user lookup with public/authenticated status.
- [x] 2.4 Add Workspace Management route rows for list, create, detail, and delete with OpenClaw worker handoff notes.
- [x] 2.5 Add Workspace User Management route rows for members, invitations, role updates, and member removal.
- [x] 2.6 Add Agent Management route rows matching the implemented `/api/workspaces/:workspaceId/agents` API.
- [x] 2.7 Add Subscription & Payment route rows for existing `/api/subscriptions` endpoints and mark shared-envelope alignment as provisional.
- [x] 2.8 Add Tools & Integration route rows for catalog, integration setup, masked credentials, assignments, and revocation.
- [x] 2.9 Add Workflow Management route rows for list, detail, create, update, publish, archive, and execution-request handoff.
- [x] 2.10 Add Task & Orchestration route rows for submit, detail, cancel, runs, and logs.
- [x] 2.11 Add Knowledge Base / RAG route rows for documents, upload, delete, ingestion status, retrieval, and access assignment.

## 3. Verification

- [x] 3.1 Add a lightweight contract test that verifies the API matrix document exists.
- [x] 3.2 Verify the matrix includes every module owner from `docs/module-ownership.md`.
- [x] 3.3 Verify the matrix includes required common API rules and workspace scoping rules.
- [x] 3.4 Verify implemented Agent Management routes are represented with `implemented` status.
- [x] 3.5 Verify existing Subscription & Payment routes are represented with `provisional-existing` status.
- [x] 3.6 Keep verification documentation-based and do not require unimplemented planned routes to have live HTTP handlers.

## 4. Review and Validation

- [x] 4.1 Run `npm run test:contracts`.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run `npm run build`.
- [x] 4.4 Run `openspec validate "establish-api-route-boundaries" --strict`.
- [x] 4.5 Run `openspec validate --all --strict`.
- [x] 4.6 Run `git diff --check`.
- [x] 4.7 Review added code lines and confirm this change stays within the 500-added-code-line PR rule.
- [x] 4.8 Prepare PR notes that explicitly state this change defines route boundaries only and does not implement controllers, services, repositories, Prisma migrations, workers, or frontend API clients.
