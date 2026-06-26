# Module API Contracts

This document is the canonical API route matrix for module teams. It defines route ownership and boundary expectations only; it does not mean every planned route is implemented.

Status values:

- `implemented`: route exists in backend code and has focused tests.
- `provisional-existing`: route exists, but a documented contract gap remains before production use.
- `planned`: route boundary is reserved for the owning module; no live HTTP handler is required by this matrix.

## Common API Rules

- Every public backend HTTP route must start with `/api`.
- Workspace-owned resources must use `/api/workspaces/:workspaceId/...`; `workspaceId` is a tenant locator from the route, not trusted request-body input.
- Authenticated context such as `userId`, `submittedByUserId`, workspace membership, role, and permissions must come from request context or middleware, not client request bodies.
- Public responses must use the shared `ApiResponse`, `ApiSuccess`, `ApiFailure`, or `ApiPaginatedSuccess` envelope unless a route row explicitly marks a provisional exception.
- List routes that can grow beyond one page must document shared pagination metadata expectations.
- Validation failures must use shared validation error expectations such as `validation.invalid_input` with field-level issues where useful.
- Missing authentication must map to `auth.unauthorized`; insufficient permission must map to `auth.forbidden`.
- Request DTOs must not accept generated IDs, lifecycle status, timestamps, raw credentials, tokens, password hashes, private infrastructure fields, or server-owned routing results unless a module OpenSpec change documents an exception.
- Cross-module data access must use APIs, DTOs, domain events, adapters, or public shared contracts instead of private module imports.
- Documentation-based verification does not require planned routes to have live HTTP handlers.

## Authentication

Owner module: `apps/backend/src/modules/authentication`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | None | `implement-authentication` request DTO | `ApiResponse` user/session summary | `planned` | Must never return password or password hash. |
| `POST` | `/api/auth/login` | Public | None | `implement-authentication` request DTO | `ApiResponse` session summary | `planned` | Invalid credentials use safe shared auth error expectations. |
| `POST` | `/api/auth/logout` | Authenticated | None | Empty or session-token context | `ApiResponse` logout acknowledgement | `planned` | Invalidates current session/token. |
| `GET` | `/api/auth/me` | Authenticated | None | Request context | `ApiResponse` current-user summary | `planned` | Source of user identity for protected frontend state. |

## Workspace Management

Owner module: `apps/backend/src/modules/workspace-management`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/workspaces` | Authenticated | User-accessible workspaces | Request context plus optional pagination | `ApiPaginatedSuccess` workspace summaries | `planned` | Lists workspaces visible to current user. |
| `POST` | `/api/workspaces` | Authenticated | Created workspace | `implement-workspace-management` create DTO | `ApiResponse` workspace summary | `planned` | Records provisioning state and delegates OpenClaw setup through worker/runtime boundary. |
| `GET` | `/api/workspaces/:workspaceId` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` workspace detail | `planned` | Detail may include related public summaries only. |
| `DELETE` | `/api/workspaces/:workspaceId` | Workspace admin | Route `workspaceId` | Request context | `ApiResponse` deletion acknowledgement | `planned` | Marks deletion and delegates runtime cleanup through worker/runtime boundary. |

## Workspace User Management

Owner module: `apps/backend/src/modules/workspace-user-management`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/workspaces/:workspaceId/members` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` member summaries | `planned` | Viewer can read according to module RBAC rules. |
| `POST` | `/api/workspaces/:workspaceId/invitations` | Workspace admin | Route `workspaceId` | `implement-workspace-user-management` invitation DTO | `ApiResponse` invitation summary | `planned` | Request body must not accept inviter user identity. |
| `PATCH` | `/api/workspaces/:workspaceId/members/:memberId` | Workspace admin | Route `workspaceId` | role update DTO | `ApiResponse` member summary | `planned` | Validates admin/editor/viewer role transitions. |
| `DELETE` | `/api/workspaces/:workspaceId/members/:memberId` | Workspace admin | Route `workspaceId` | Request context | `ApiResponse` removal acknowledgement | `planned` | Revokes workspace access. |

## Agent Management

Owner module: `apps/backend/src/modules/agent-management`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/workspaces/:workspaceId/agents` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` agent public summaries | `implemented` | Existing route lists enabled and disabled agents; deleted agents are omitted. |
| `POST` | `/api/workspaces/:workspaceId/agents` | `agents:manage` | Route `workspaceId` | name, role, model, instructions | `ApiResponse` agent public summary | `implemented` | Existing route derives workspace from request context. |
| `GET` | `/api/workspaces/:workspaceId/agents/models` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` model catalog entries | `implemented` | Returns selectable static server-side model catalog entries for the creation assistant change. |
| `POST` | `/api/workspaces/:workspaceId/agents/skill-preview` | `agents:manage` | Route `workspaceId` | `AgentSkillPreviewRequest` | `ApiResponse` `AgentSkillPreviewResponse` | `implemented` | Renders Markdown from a draft payload without creating or updating an agent. |
| `POST` | `/api/workspaces/:workspaceId/agents/assistant/draft` | `agents:manage` | Route `workspaceId` | `AgentCreationAssistantDraftRequest` | `ApiResponse` `AgentCreationAssistantDraftResponse` | `planned` | Reserved for Gemini/OpenRouter draft generation; must not return raw provider errors or credentials. |
| `POST` | `/api/workspaces/:workspaceId/agents/assistant/import-skill` | `agents:manage` | Route `workspaceId` | `AgentSkillImportAnalysisRequest` | `ApiResponse` import validation or extracted draft response | `provisional-existing` | Phase 1 validates Markdown payloads only; later assistant phase will return extracted editable drafts. |
| `GET` | `/api/workspaces/:workspaceId/agents/:agentId/skill.md` | Workspace member | Route `workspaceId` | Request context | `text/markdown` generated `skill.md` | `implemented` | Downloads the current generated skill artifact for enabled or disabled agents; deleted and cross-workspace agents are rejected. |
| `GET` | `/api/workspaces/:workspaceId/agents/:agentId/configuration` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` editable configuration | `implemented` | Only route that returns private instructions; generated skill content is never returned. |
| `PATCH` | `/api/workspaces/:workspaceId/agents/:agentId` | `agents:manage` | Route `workspaceId` | role, model, instructions | `ApiResponse` agent public summary | `implemented` | Agent name is not changed by this route. |
| `POST` | `/api/workspaces/:workspaceId/agents/:agentId/enable` | `agents:manage` | Route `workspaceId` | Request context | `ApiResponse` agent public summary | `implemented` | Enables an existing disabled agent. |
| `POST` | `/api/workspaces/:workspaceId/agents/:agentId/disable` | `agents:manage` | Route `workspaceId` | Request context | `ApiResponse` agent public summary | `implemented` | Disables an available agent. |
| `DELETE` | `/api/workspaces/:workspaceId/agents/:agentId` | `agents:manage` | Route `workspaceId` | Request context | `ApiResponse` agent public summary | `implemented` | Marks the agent as deleted. |

## Subscription & Payment

Owner module: `apps/backend/src/modules/subscription-payment`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/subscriptions/details` | Authenticated | User subscription context | Request context | Provisional response, align to `ApiResponse` | `provisional-existing` | Existing route reads current user subscription details. |
| `POST` | `/api/subscriptions/checkout` | Authenticated | User subscription context | plan selection DTO | Provisional response, align to `ApiResponse` | `provisional-existing` | Existing route starts mock checkout for standard or premium plan. |
| `POST` | `/api/subscriptions/upgrade` | Authenticated | User subscription context | subscription upgrade DTO | Provisional response, align to `ApiResponse` | `provisional-existing` | Existing route starts an upgrade flow. |
| `POST` | `/api/subscriptions/mock-callback` | Callback or local mock context | Transaction context | transaction callback DTO | Provisional response, align to `ApiResponse` | `provisional-existing` | Existing route reconciles directly or enqueues payment webhook work. |

## Tools & Integration

Owner module: `apps/backend/src/modules/tools-integration`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/workspaces/:workspaceId/tools/catalog` | Workspace member | Route `workspaceId` | Request context plus optional filters | `ApiPaginatedSuccess` tool catalog entries | `planned` | Lists available tools and provider templates. |
| `POST` | `/api/workspaces/:workspaceId/tools/integrations` | Workspace editor/admin | Route `workspaceId` | integration setup DTO | `ApiResponse` integration summary | `planned` | Starts quick integration or records provider setup intent. |
| `PATCH` | `/api/workspaces/:workspaceId/tools/integrations/:integrationId/credentials` | Workspace admin | Route `workspaceId` | masked credential update DTO | `ApiResponse` masked integration summary | `planned` | Raw secrets, tokens, API keys, and private config must never be returned. |
| `POST` | `/api/workspaces/:workspaceId/tools/assignments` | Workspace editor/admin | Route `workspaceId` | agent-tool assignment DTO | `ApiResponse` assignment summary | `planned` | Assigns tool access to an agent. |
| `DELETE` | `/api/workspaces/:workspaceId/tools/assignments/:assignmentId` | Workspace editor/admin | Route `workspaceId` | Request context | `ApiResponse` revocation acknowledgement | `planned` | Revokes agent tool access. |

## Workflow Management

Owner module: `apps/backend/src/modules/workflow-management`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/workspaces/:workspaceId/workflows` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` workflow summaries | `planned` | Lists workflows visible in the workspace. |
| `POST` | `/api/workspaces/:workspaceId/workflows` | Workspace editor/admin | Route `workspaceId` | workflow create DTO | `ApiResponse` workflow detail | `planned` | Validates referenced public agent summaries before activation. |
| `GET` | `/api/workspaces/:workspaceId/workflows/:workflowId` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` workflow detail | `planned` | Returns workflow definition without private module internals. |
| `PATCH` | `/api/workspaces/:workspaceId/workflows/:workflowId` | Workspace editor/admin | Route `workspaceId` | workflow update DTO | `ApiResponse` workflow detail | `planned` | Updates name, status, and ordered steps. |
| `POST` | `/api/workspaces/:workspaceId/workflows/:workflowId/publish` | Workspace editor/admin | Route `workspaceId` | Request context | `ApiResponse` workflow summary | `planned` | Publishes an active workflow after validation. |
| `POST` | `/api/workspaces/:workspaceId/workflows/:workflowId/archive` | Workspace editor/admin | Route `workspaceId` | Request context | `ApiResponse` workflow summary | `planned` | Archives a workflow. |
| `POST` | `/api/workspaces/:workspaceId/workflows/:workflowId/execution-requests` | Workspace member | Route `workspaceId` | execution request DTO | `ApiResponse` execution request summary | `planned` | Hands execution to Task & Orchestration or worker processing; Workflow does not execute task steps directly. |

## Task & Orchestration

Owner module: `apps/backend/src/modules/task-orchestration`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/workspaces/:workspaceId/tasks` | Workspace member | Route `workspaceId` | `CreateTaskRequest` prompt plus routing input | `ApiResponse` `CreateTaskResponse` | `planned` | Workspace and submitter identity come from route and authenticated context. |
| `GET` | `/api/workspaces/:workspaceId/tasks/:taskId` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` task detail | `planned` | Returns task status and public result state. |
| `POST` | `/api/workspaces/:workspaceId/tasks/:taskId/cancel` | Workspace member | Route `workspaceId` | cancellation request DTO | `ApiResponse` task detail | `planned` | Terminal tasks must preserve final state. |
| `GET` | `/api/workspaces/:workspaceId/tasks/:taskId/runs` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` task run summaries | `planned` | Lists execution attempts or work records. |
| `GET` | `/api/workspaces/:workspaceId/tasks/:taskId/logs` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` task log entries | `planned` | Lists processing logs without private worker internals. |

## Knowledge Base / RAG

Owner module: `apps/backend/src/modules/knowledge-base-rag`

| Method | Path | Auth | Workspace Scope | Request Contract | Response Contract | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/workspaces/:workspaceId/knowledge/documents` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` `KnowledgeDocumentDto` summaries | `implemented` | Lists uploaded, synchronized, pending, ready, and failed documents. |
| `POST` | `/api/workspaces/:workspaceId/knowledge/uploads/validate` | Workspace editor/admin | Route `workspaceId` | `UploadValidationRequest` | `ApiResponse` `UploadValidationResponse` | `implemented` | Validates upload candidates without creating durable documents or running ingestion. |
| `POST` | `/api/workspaces/:workspaceId/knowledge/uploads/prepare` | Workspace editor/admin | Route `workspaceId` | `PrepareUploadRequest` | `ApiResponse` `PrepareUploadResponse` | `implemented` | Creates safe document and queued ingestion-job metadata through application ports; worker execution remains separate. |
| `GET` | `/api/workspaces/:workspaceId/knowledge/ingestion-jobs` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` `IngestionJobDto` summaries | `implemented` | Lists document ingestion jobs and safe processing status. |
| `GET` | `/api/workspaces/:workspaceId/knowledge/data-sources` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiResponse` `KnowledgeDataSourceDto` list | `implemented` | Lists external source placeholders without credentials or provider secrets. |
| `POST` | `/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect` | Workspace editor/admin | Route `workspaceId` | `ConnectKnowledgeDataSourceRequest` | `ApiResponse` `KnowledgeDataSourceDto` | `implemented` | Records a safe connection placeholder; raw credentials are never accepted or returned by this contract. |
| `GET` | `/api/workspaces/:workspaceId/knowledge/sync-scope` | Workspace member | Route `workspaceId` | Request context | `ApiResponse` `SyncScopeNodeDto` list | `implemented` | Reads selectable external source scope nodes. |
| `PUT` | `/api/workspaces/:workspaceId/knowledge/sync-scope` | Workspace editor/admin | Route `workspaceId` | `UpdateSyncScopeRequest` | `ApiResponse` `SyncScopeNodeDto` list | `implemented` | Updates selected scope nodes; request body must not include workspace or actor identity. |
| `POST` | `/api/workspaces/:workspaceId/knowledge/sync-jobs` | Workspace editor/admin | Route `workspaceId` | `RequestKnowledgeSyncJobRequest` | `ApiResponse` `SyncJobDto` | `implemented` | Records manual sync intent as a queued job; worker execution remains separate. |
| `GET` | `/api/workspaces/:workspaceId/knowledge/sync-jobs` | Workspace member | Route `workspaceId` | Request context plus optional pagination | `ApiPaginatedSuccess` `SyncJobDto` summaries | `implemented` | Lists manual or future scheduled sync jobs and safe failure summaries. |
