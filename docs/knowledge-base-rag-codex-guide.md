# Knowledge Base / RAG Codex Guide

## How To Work On This Feature

Work only inside the Knowledge Base / RAG boundary unless the user explicitly
asks for broader integration. This module prepares internal and external
knowledge sources for future RAG use; it does not implement final answer
generation, Agent Management, Workflow Management, or Task Orchestration.

Before each task, read:

1. `AGENTS.md`
2. `README.md`
3. `docs/requirements.md`
4. `docs/architecture.md`
5. `docs/module-ownership.md`
6. `docs/team-module-implementation-guide.md`
7. `docs/api/module-api-contracts.md`
8. `docs/pr-checklist.md`
9. `docs/openspec-team-guide.md`
10. `docs/knowledge-base-rag-context.md`
11. `openspec/changes/implement-knowledge-base-rag/proposal.md`
12. `openspec/changes/implement-knowledge-base-rag/design.md`
13. `openspec/changes/implement-knowledge-base-rag/specs/knowledge-base-rag/spec.md`
14. `openspec/changes/implement-knowledge-base-rag/tasks.md`
15. The README in the relevant frontend, backend, or worker Knowledge Base path.

If the OpenSpec CLI is unavailable, read the repository artifacts directly and
report that the CLI command could not be run.

## Current State

The Knowledge Base / RAG frontend currently includes:

- Base layout and local navigation.
- Shared KB/RAG UI components.
- Mock data and shared local view types.
- Documents screen.
- Upload Documents screen.
- Typed frontend API client for the workspace-scoped KB/RAG routes.

The Documents, Upload, Data Sources, and Synchronization Scope screens now use
the typed KB/RAG API client for runtime loading, metadata-only upload
validation/preparation, safe data-source placeholder connection, sync-scope
updates, manual sync requests, and sync job reads. Local mock data remains
available for isolated prototype/test use. Do not wire Processing Status to API
calls outside its own scoped frontend integration issue.

The backend now has an internal foundation for future runtime implementation:

- Domain models for documents, chunks, ingestion jobs, data sources, sync scope,
  sync jobs, and sync job events.
- Application repository ports.
- Application use cases for document reads, metadata-only upload validation,
  safe upload preparation, ingestion-job reads, data-source placeholders,
  sync-scope updates, and queued manual sync requests.
- Safe DTO mappers to shared contracts.
- Prisma repositories using KB/RAG-owned tables through `@vcp/database`.
- Deterministic in-memory repositories for future use-case tests.
- A thin workspace-scoped HTTP API router that maps shared route contracts to
  application use cases and shared API envelopes.
- A worker handoff skeleton that moves already-created document ingestion jobs
  through pending/ingesting/ready or pending/ingesting/failed lifecycle states
  through KB/RAG repository ports.
- A deterministic worker-side text processing pipeline for supported
  text/plain and markdown-style content. It reads content through an injected
  reader, normalizes text, splits stable chunks, and persists chunks through
  KB/RAG repository ports.

The backend still does not have real upload/file adapters, embedding/vector
adapters, PDF/DOC/DOCX/OCR parsers, full worker runtime handlers, retrieval,
or external sync adapters.

## Required Future Workflow

Use this order for future Knowledge Base / RAG implementation:

1. Analyze the feature and current repo architecture.
2. Design DB schema owned by the KB/RAG module.
3. Define public API schema.
4. Define shared contracts and DTOs.
5. Define public domain events.
6. Implement backend `api/application/domain/infrastructure`.
7. Align frontend API client and UI with shared DTOs.
8. Add contract, boundary, backend, frontend, worker, and functional tests.

Do not continue UI-only implementation for new KB/RAG flows until the DB/API,
shared contract, and event foundation has been defined.

## Allowed Directories

- `apps/frontend/src/features/knowledge-base-rag`
- `apps/backend/src/modules/knowledge-base-rag`
- `apps/workers/src/jobs/document-ingestion`
- `docs/knowledge-base-rag-context.md`
- `docs/knowledge-base-rag-codex-guide.md`
- `openspec/changes/implement-knowledge-base-rag` only when the task changes
  documented scope, requirements, or task status and the user permits it.

## Forbidden Directories Unless Explicitly Requested

- `apps/frontend/src/features/agent-management`
- `apps/backend/src/modules/agent-management`
- `apps/backend/src/modules/authentication`
- `apps/backend/src/modules/workflow-management`
- `apps/backend/src/modules/task-orchestration`
- `apps/backend/src/shared`
- `apps/frontend/src/features/workflow-management`
- `apps/frontend/src/features/task-orchestration`
- Other frontend feature folders.
- Other backend module folders.
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/types/navigation.ts`
- `tests`
- `packages/shared/src/contracts`
- Package dependency files.
- Prisma schema and migrations.
- Build, Vite, Vitest, Playwright, Prisma, and backend runtime config.
- OpenSpec archive folders.
- `.local-docs`

## Architecture Reference Rules

Use Agent Management as a reference for architecture discipline:

- Respect module boundaries.
- Keep backend layering separate.
- Define repository interfaces before implementations.
- Keep Prisma access behind infrastructure adapters.
- Use shared API response envelopes.
- Use typed frontend API clients once backend contracts exist.
- Add contract and persistence tests with boundary changes.

Do not copy Agent Management entities or logic directly. KB/RAG has its own
domain: documents, uploads, validation, ingestion jobs, chunks,
embedding/indexing status, external data sources, sync scope, manual sync jobs,
processing status, and worker handoff.

Use Workflow Management and Task Orchestration as references for injected
ports and handoff boundaries. Do not import their private repositories or
services.

## Strict Rules

- Do not import internals from other modules.
- Do not let other modules import KB/RAG internals.
- Do not create or modify DB tables owned by other modules.
- Do not let other modules create or mutate KB/RAG-owned tables directly.
- Do not add API endpoints without updating shared contracts, docs/specs, and
  tests.
- Do not modify shared contracts without updating contract tests and documenting
  why the current boundary is insufficient.
- Do not let frontend mock data drift from shared DTOs once DTOs exist.
- Do not run long-running ingestion, chunking, embedding, indexing, or sync work
  inside HTTP requests.
- Do not expose raw vector DB details, embedding-provider internals, object
  storage private paths, raw credentials, tokens, or secrets.
- Keep PRs small and scoped.
- Run relevant build/test/diff checks before reporting completion.

## Domain Concepts To Preserve

Future tasks should use clear names for these concepts:

- `KnowledgeDocument`
- `KnowledgeDocumentChunk`
- `UploadCandidateFile`
- `UploadValidationResult`
- `KnowledgeIngestionJob`
- `KnowledgeDataSource`
- `KnowledgeSyncScopeNode`
- `KnowledgeSyncJob`
- `KnowledgeSyncJobEvent` or processing event
- Embedding/indexing status
- Worker ingestion handoff

## DB Ownership Boundary

The DB source of truth is `packages/database/prisma/schema.prisma` plus
additive migrations under `packages/database/prisma/migrations`.

For KB/RAG persistence work:

- Treat `Document`, `KnowledgeIndex`, and `KnowledgeAccessGrant` as existing
  KB/RAG-owned skeleton models.
- Do not create a duplicate `KnowledgeDocument` Prisma model while `Document`
  owns the document table.
- Use KB/RAG-owned models for module-specific records:
  `KnowledgeDocumentChunk`, `KnowledgeIngestionJob`, `KnowledgeDataSource`,
  `KnowledgeSyncScopeNode`, `KnowledgeSyncJob`, and
  `KnowledgeSyncJobEvent`.
- Leave the generic `Job` table untouched unless a separate reviewed platform
  job-boundary issue requires changing it.
- Keep cross-module references as scalar public IDs such as `workspaceId`,
  `agentId`, `documentId`, `sourceId`, `jobId`, and actor/user IDs.
- Store object references as server-side keys such as `storageKey`; do not
  store public/private object-storage URLs.
- Never add raw credentials, OAuth refresh tokens, provider secrets, passwords,
  raw embedding vectors, raw vector DB configuration, queue internals, or
  provider private payloads to the DB schema.

## Backend Roadmap

Backend implementation uses this structure:

```text
apps/backend/src/modules/knowledge-base-rag/
|-- api/
|-- application/
|-- domain/
`-- infrastructure/
```

Current foundation files include:

- `api/knowledge-base-rag-router.ts`
- `api/knowledge-base-rag-request-parsers.ts`
- `api/api-response.ts`
- `application/*-repository.ts`
- `application/*-use-cases.ts`
- `application/knowledge-base-rag-events.ts`
- `application/knowledge-base-rag-errors.ts`
- `application/dto-mappers.ts`
- `domain/knowledge-document.ts`
- `domain/knowledge-ingestion-job.ts`
- `domain/knowledge-data-source.ts`
- `domain/knowledge-sync.ts`
- `infrastructure/prisma-*.ts`
- `infrastructure/in-memory-knowledge-base-rag-repositories.ts`
- `worker/knowledge-ingestion-handoff.ts`
- `worker/knowledge-document-content-reader.ts`
- `worker/knowledge-document-processing-pipeline.ts`
- `worker/knowledge-document-text-normalizer.ts`
- `worker/knowledge-document-text-chunker.ts`

Likely future files:

- `application/ports.ts`
- `domain/upload-validation.ts`
- `domain/knowledge-events.ts`
- `infrastructure/*-adapter.ts`

Do not create worker handlers or adapters outside the selected task scope.

The current worker handoff plus processing pipeline may mark pending ingestion
jobs as ingesting, ready, or failed, update associated document ingestion
status, and persist deterministic text chunks. It must not read object storage,
parse PDF/DOC/DOCX, perform OCR, call embedding providers, write vectors,
execute external sync, or mark vector indexing complete until a later
adapter/runtime issue explicitly adds those boundaries.

## API Contract Boundary

The KB/RAG public API contract uses workspace-scoped routes under
`/api/workspaces/:workspaceId/knowledge/...`. Do not use the older
`/api/knowledge-base/...` candidate shape for implementation:

```text
GET    /api/workspaces/:workspaceId/knowledge/documents
POST   /api/workspaces/:workspaceId/knowledge/uploads/validate
POST   /api/workspaces/:workspaceId/knowledge/uploads/prepare
GET    /api/workspaces/:workspaceId/knowledge/ingestion-jobs
GET    /api/workspaces/:workspaceId/knowledge/data-sources
POST   /api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect
GET    /api/workspaces/:workspaceId/knowledge/sync-scope
PUT    /api/workspaces/:workspaceId/knowledge/sync-scope
POST   /api/workspaces/:workspaceId/knowledge/sync-jobs
GET    /api/workspaces/:workspaceId/knowledge/sync-jobs
```

This route contract is documented, tested, and exposed by the backend API
router. The router must remain thin: parse request context, call application
use cases, map responses/errors, and avoid file parsing, storage, embeddings,
vector databases, external providers, and worker runtime execution.

## Shared DTO Boundary

Shared DTOs are defined in
`packages/shared/src/contracts/knowledge-base-rag.ts` and exported from
`@vcp/shared`:

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

Use shared DTOs only for stable cross-boundary shapes. Keep private domain
entities, repository records, raw provider payloads, vector internals, and
worker implementation details module-local.

## Domain Event Roadmap

Shared contracts retain legacy `knowledge.document_uploaded` and
`knowledge.index_ready` event names for compatibility and add these public
granular events:

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

Payloads should include `eventId`, event name/type, `workspaceId`, actor ID
when user-triggered, relevant document/source/job IDs, status, `occurredAt`,
and safe failure fields. Payloads must not leak pgvector, queue internals,
credential data, raw chunk operations, or private adapter details.

## Worker Handoff Rules

The expected flow is:

1. Upload is validated.
2. Valid uploads are prepared.
3. Ingestion job is queued.
4. Worker processes parsing, chunking, embedding, and indexing.
5. Status is updated.
6. Domain events are emitted.
7. UI reads job/status state through API.

Manual sync and external data-source processing must follow the same async
boundary. HTTP requests should create state and enqueue work, not block on
slow or retryable processing.

## Testing Expectations

For documentation-only tasks, run `git diff --check`, `git status --short`,
and any requested grep checks. Report that full tests were not run.

For future implementation work, add focused tests in the same PR:

- Shared contract tests when DTOs/events/error codes change.
- DB schema/migration tests when Prisma changes.
- Domain tests for validation and lifecycle rules.
- Application/use-case tests.
- In-memory repository tests.
- Prisma mapper/repository tests.
- API router tests.
- Frontend API client tests.
- Component tests for API-integrated Documents and Upload behavior.
- Import-boundary tests.
- Worker handoff tests.
- Functional PA5 test cases.

Before reporting implementation completion, run relevant commands such as:

```bash
npm run build
npm test
npm run test:contracts
openspec validate "implement-knowledge-base-rag" --strict
openspec validate --all --strict
git diff --check
```

Run Prisma validation only when Prisma files are affected:

```bash
npm run prisma -- validate
```

## Current UI Guidance

Documents, Upload, Data Sources, and Synchronization Scope use the API client;
remaining placeholder views may keep local mock data until their own scoped
integration issues wire them to API contracts. New UI-only flows should pause
until the API/DTO/event foundation is designed. The KB/RAG API client follows
the Agent Management and Workflow Management client pattern: typed fetch
wrapper, shared `ApiResponse` parsing, shared `ErrorCode`, network error
handling, and malformed-response handling.

## Final Response Checklist

- State the concrete files changed.
- State validation commands and outcomes.
- Confirm no runtime code was changed for docs-only tasks.
- Confirm no other feature modules were modified.
- Confirm no dependencies were added.
- Confirm no OpenSpec artifacts were modified unless explicitly requested.
- Do not commit unless explicitly asked.
