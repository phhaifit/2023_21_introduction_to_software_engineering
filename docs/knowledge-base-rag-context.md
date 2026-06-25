# Knowledge Base / RAG Context

## Overview

Knowledge Base / RAG Management owns workspace knowledge sources before they
are used by RAG-enabled agents or task execution flows. It prepares, tracks,
indexes, and governs internal documents and external source data. It is not the
final chatbot, answer-generation, Agent Management, or Task Orchestration
module.

Parent issue: `[Phase 4] Quan ly Tri thuc & Du lieu noi bo (Knowledge Base / RAG Management) #35`

Current architecture issue: `[Architecture] Knowledge Base / RAG - Foundation Audit and Context Alignment`

OpenSpec change: `implement-knowledge-base-rag`

## Current Knowledge Base / RAG State

The frontend currently has a PA5 prototype under
`apps/frontend/src/features/knowledge-base-rag`:

- Base layout and local navigation for Documents, Upload Documents, Data
  Sources, Synchronization Scope, and Processing Status.
- Shared KB/RAG UI components in `knowledge-base-rag-components.tsx`.
- Mock data and shared local view types in `knowledge-base-rag-mock-data.ts`
  and `knowledge-base-rag-view.ts`.
- Documents screen in `knowledge-base-rag-documents.tsx`.
- Upload Documents screen in `knowledge-base-rag-upload.tsx`.
- Feature-prefixed CSS split by shell, shared components, documents, and upload
  screens.

The frontend is integrated into the app shell through `App.tsx`,
`types/navigation.ts`, and `Sidebar.tsx`. This architecture issue does not
change that integration.

The backend still needs a proper foundation before runtime implementation:

- DB schema ownership decisions for KB/RAG-owned records.
- Public API schema decisions.
- Shared contracts and DTOs for frontend/backend/worker boundaries.
- Public domain event definitions.
- Backend `api/application/domain/infrastructure` layering.
- Repository interfaces plus in-memory and Prisma infrastructure.
- Worker ingestion handoff for long-running document processing.
- Contract, boundary, backend, frontend, worker, and functional tests.

The worker path `apps/workers/src/jobs/document-ingestion` currently contains
README/context only. The queue type already reserves `document.ingest`, but no
handler or adapter implementation exists.

## Modular Monolith Alignment

The repository is a TypeScript/NPM workspaces Modular Monolith using vertical
slice boundaries. KB/RAG owns:

- Backend module: `apps/backend/src/modules/knowledge-base-rag`
- Frontend feature: `apps/frontend/src/features/knowledge-base-rag`
- Worker job boundary: `apps/workers/src/jobs/document-ingestion`
- Context docs: `docs/knowledge-base-rag-context.md` and
  `docs/knowledge-base-rag-codex-guide.md`

KB/RAG may import shared contracts from `@vcp/shared`, backend shared
infrastructure from `apps/backend/src/shared/*`, and database exports from
`@vcp/database` in backend/worker code only. It must not import private
repositories, services, UI components, or state stores from Agent Management,
Workflow Management, Task Orchestration, or other modules.

Other modules must not import KB/RAG internals. They should use public APIs,
shared DTOs, domain events, or explicit adapter ports.

## Reference Pattern From Agent Management

Agent Management is the main architecture discipline reference because it
demonstrates:

- Module boundary ownership.
- Backend layering under `api`, `application`, `domain`, and `infrastructure`.
- Repository abstraction with in-memory and Prisma implementations.
- Public API response helpers using shared API envelopes.
- Frontend API client pattern with typed fetch, shared error codes, and
  malformed-response handling.
- Contract and persistence tests around public behavior and Prisma adapters.

KB/RAG must not copy Agent Management entities or logic directly. Agent
Management owns agents, skill configuration, and agent lifecycle. KB/RAG owns
documents, uploads, validation, ingestion jobs, chunks, embedding/indexing
status, external data sources, sync scope, sync jobs, and knowledge retrieval
boundaries.

## Other Reference Patterns

Authentication shows strong colocated backend tests for routers, use cases,
in-memory repositories, Prisma mappers/repositories, and hashing adapters.

Workflow Management shows a useful handoff pattern: workflow execution is
delegated through an injected port instead of running another module's private
logic. KB/RAG should use the same discipline for worker ingestion, data-source
sync, embedding, and vector indexing adapters.

Task & Orchestration shows a clean application-port model for identity, clock,
external catalogs, repositories, and event publishing. KB/RAG should follow the
same approach for deterministic tests and cross-module references.

## Knowledge Base / RAG Domain Concepts

Future implementation should define these concepts before writing runtime code:

- `KnowledgeDocument`: workspace-scoped document metadata for uploaded or
  synchronized knowledge.
- `KnowledgeDocumentChunk`: text chunk metadata prepared for embedding,
  indexing, retrieval, and source attribution.
- `UploadCandidateFile`: client- or API-visible file candidate before durable
  document creation.
- `UploadValidationResult`: validation outcome for file type, size, duplicate
  detection, workspace policy, and safe error reporting.
- `KnowledgeIngestionJob`: asynchronous parsing, chunking, embedding, and
  indexing work record.
- `KnowledgeDataSource`: external source such as Google Drive, Notion, or
  Confluence, excluding raw credentials from public DTOs.
- `KnowledgeSyncScopeNode`: selected external folder, file, page, or space
  included in synchronization.
- `KnowledgeSyncJob`: manual or scheduled sync work record.
- `KnowledgeSyncJobEvent` or processing event: append-only progress or failure
  record for ingestion/sync visibility.
- Embedding/indexing status: lifecycle state such as `pending`, `ingesting`,
  `ready`, and `failed`, aligned with shared statuses when made public.
- Worker ingestion handoff: the boundary from HTTP/API intent to background
  document processing.

## Proposed Future DB Ownership

This issue does not change Prisma schema or migrations. It documents the
intended ownership model for a later DB design issue.

Likely future KB/RAG-owned tables or entities:

- `KnowledgeDocument`
- `KnowledgeDocumentChunk`
- `KnowledgeIngestionJob`
- `KnowledgeDataSource`
- `KnowledgeSyncScopeNode`
- `KnowledgeSyncJob`
- `KnowledgeSyncJobEvent`

The existing Prisma skeleton already contains `Document`, `KnowledgeIndex`,
`KnowledgeAccessGrant`, and `Job`. A later persistence issue must decide whether
to extend those models or introduce additional additive models. That decision
must be captured in OpenSpec/design docs before a migration is created.

Rules:

- KB/RAG owns its document, chunk, ingestion, source, sync, index, and knowledge
  access tables.
- Other modules must not create or mutate KB/RAG tables directly.
- Other modules should use public APIs, shared DTOs, domain events, or explicit
  adapter ports.
- KB/RAG must not create or mutate tables owned by Authentication, Workspace,
  Agent Management, Workflow Management, Task Orchestration, Tools, or
  Subscription modules.
- Use shared conventions for `workspaceId`, actor identity, timestamps,
  statuses, API envelopes, and safe error shapes.
- Cross-module references such as `agentId`, `taskId`, or `workspaceId` should
  remain scalar public IDs unless an OpenSpec-backed DB design explicitly
  requires a relation.

## Proposed Public API Contract Roadmap

This issue only documents a roadmap. It does not implement API routes.

The current API route matrix reserves workspace-scoped Knowledge routes under
`/api/workspaces/:workspaceId/knowledge/...`. The following shorter route list
is a candidate future contract shape that must be reconciled with the API
matrix and tenant-boundary rules before implementation:

```text
GET    /api/knowledge-base/documents
POST   /api/knowledge-base/uploads/validate
POST   /api/knowledge-base/uploads/prepare
GET    /api/knowledge-base/ingestion-jobs
GET    /api/knowledge-base/data-sources
POST   /api/knowledge-base/data-sources/:sourceId/connect
GET    /api/knowledge-base/sync-scope
PUT    /api/knowledge-base/sync-scope
POST   /api/knowledge-base/sync-jobs
GET    /api/knowledge-base/sync-jobs
```

Before any endpoint is implemented, the team must decide whether these routes
should include `/api/workspaces/:workspaceId/...` directly or derive workspace
from authenticated context. The existing architecture guidance prefers
workspace-scoped routes for workspace-owned resources.

## Proposed Shared DTO / Contract Roadmap

Likely future public DTOs:

- `KnowledgeDocumentDto`
- `KnowledgeDocumentChunkDto`
- `UploadCandidateFileDto`
- `UploadValidationRequest`
- `UploadValidationResponse`
- `PrepareUploadRequest`
- `PrepareUploadResponse`
- `IngestionJobDto`
- `ExternalDataSourceDto` or `KnowledgeDataSourceDto`
- `SyncScopeNodeDto`
- `SyncJobDto`
- `KnowledgeBaseApiError`

Shared DTOs must expose only stable cross-boundary fields. They must not expose
raw credentials, tokens, provider secrets, private vector DB configuration,
embedding-provider internals, object-storage private paths, or server-owned
mutation fields.

Frontend local mock types should be migrated or mapped to shared DTOs once the
contracts exist. Until then, mock types remain module-local prototype types.

## Proposed Domain Events Roadmap

The shared contracts currently include `knowledge.document_uploaded` and
`knowledge.index_ready`. A later reviewed shared-contract issue may replace or
extend them with more granular events such as:

- `knowledge.document.uploadValidated`
- `knowledge.document.ingestionQueued`
- `knowledge.document.ingestionStarted`
- `knowledge.document.ingestionCompleted`
- `knowledge.document.ingestionFailed`
- `knowledge.dataSource.connected`
- `knowledge.dataSource.connectionFailed`
- `knowledge.sync.scopeUpdated`
- `knowledge.sync.requested`
- `knowledge.sync.started`
- `knowledge.sync.completed`
- `knowledge.sync.failed`

Payload principles:

- Include `eventId`.
- Include `eventType` or the shared event name.
- Include `workspaceId`.
- Include `actorId` when user-triggered.
- Include `documentId`, `sourceId`, or `jobId` when relevant.
- Include public `status`.
- Include `occurredAt`.
- Include `errorCode` and safe `errorMessage` for failures.
- Do not leak internal implementation details such as pgvector internals,
  embedding-provider private payloads, raw chunk storage operations, queue
  internals, or credentials unless explicitly made public later.

## Backend Layering Roadmap

Future backend implementation should use this structure:

```text
apps/backend/src/modules/knowledge-base-rag/
|-- api/
|-- application/
|-- domain/
`-- infrastructure/
```

Likely future files, not to be created in this architecture issue:

- `api/knowledge-base-rag-router.ts`
- `api/api-response.ts`
- `application/document-use-cases.ts`
- `application/upload-validation-use-cases.ts`
- `application/ingestion-job-use-cases.ts`
- `application/sync-use-cases.ts`
- `application/ports.ts`
- `application/knowledge-document-repository.ts`
- `application/knowledge-ingestion-job-repository.ts`
- `domain/knowledge-document.ts`
- `domain/upload-validation.ts`
- `domain/knowledge-ingestion-job.ts`
- `domain/knowledge-data-source.ts`
- `domain/knowledge-sync-job.ts`
- `domain/knowledge-events.ts`
- `infrastructure/in-memory-knowledge-document-repository.ts`
- `infrastructure/prisma-knowledge-document-repository.ts`
- `infrastructure/prisma-knowledge-mappers.ts`
- `infrastructure/vector-index-adapter.ts`

Application code should depend on repository and adapter ports. Infrastructure
should implement those ports. API code should translate HTTP/request context
into application commands and return shared API envelopes.

## Worker Handoff Roadmap

Long-running ingestion and synchronization must not run inside an HTTP request.

Expected flow:

1. Upload candidates are validated.
2. Valid uploads are prepared into durable document metadata.
3. An ingestion job is queued through the worker/job boundary.
4. The worker processes document ingestion.
5. The worker parses, chunks, embeds, and indexes through adapter ports.
6. Ingestion and indexing status are updated.
7. Domain events are emitted for public state transitions.
8. The UI reads document, job, and status state through the API.

Manual or scheduled sync should follow the same pattern: record sync intent,
queue work, process in workers, update status, and expose progress through API
reads.

## Testing Roadmap

Future KB/RAG work should add focused tests with each implemented behavior:

- Shared contract tests for DTOs, events, error codes, and dependency safety.
- DB schema and migration tests for KB/RAG-owned tables and indexes.
- Domain tests for documents, upload validation, ingestion lifecycle, sync
  scope, and access rules.
- Application/use-case tests for validation, preparation, queue handoff,
  ingestion status updates, sync requests, and retrieval/access checks.
- Repository tests for in-memory behavior.
- Prisma mapper/repository tests for persistence behavior.
- API router tests for auth, RBAC, workspace scoping, validation, and response
  envelope behavior.
- Frontend API client tests for routes, envelope parsing, API errors, network
  errors, and malformed responses.
- Component tests for existing Documents and Upload screens once behavior
  moves beyond static mock display.
- Import-boundary tests to prevent private cross-module imports.
- Worker handoff tests for queue payloads, handler registration, adapter usage,
  success, and failure.
- Functional PA5 cases for upload validation, prepare, queued ingestion,
  processing status, failed ingestion, data-source placeholder connection, sync
  scope update, manual sync, and status display.

## Current Constraints

- Do not continue UI-only implementation for new KB/RAG flows until DB/API,
  shared contract, and event foundation is defined.
- Do not add runtime backend routes in architecture-only issues.
- Do not add Prisma schema or migrations in documentation alignment issues.
- Do not add repositories, frontend API clients, worker handlers, or new UI
  screens in this issue.
- Do not add dependencies.
- Keep PRs small and scoped.
