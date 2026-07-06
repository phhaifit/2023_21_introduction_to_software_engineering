# Knowledge Base / RAG Module

See
[`docs/knowledge-base-rag-local-demo.md`](../../../../../docs/knowledge-base-rag-local-demo.md)
for local setup, runnable commands, deterministic verification, and current
worker/indexing limitations.
For the final upload-to-Task-chat presentation flow, use
[`docs/demo/kb-rag/final-local-rag-demo-script.md`](../../../../../docs/demo/kb-rag/final-local-rag-demo-script.md).

Owner: Member 9

Active OpenSpec change: `implement-knowledge-base-rag`.

Foundation reference: see `docs/module-ownership.md`,
`docs/architecture.md`, `docs/team-module-implementation-guide.md`, and
`docs/knowledge-base-rag-context.md`.

## Current Status

This backend module now contains the internal backend foundation for domain
models, application repository ports, application use cases, safe DTO mappers,
Prisma repository adapters, deterministic in-memory repositories, a thin
workspace-scoped HTTP API router, a module-local file storage boundary for real
uploads, and a worker handoff skeleton for document ingestion lifecycle
updates. The worker boundary also includes document text extraction behind an
injected parser boundary, a deterministic text processing pipeline for
TXT/DOCX/text-based PDF documents, and an injected embedding/vector
indexing adapter boundary for persisted chunks. It also has a local end-to-end
flow runner that composes handoff, text processing, and indexing for
deterministic tests.

It still does not contain OCR or a separately deployed worker daemon.
`KNOWLEDGE_QUEUE_MODE=durable` enables PostgreSQL-backed runtime job claims,
expiring leases, abandoned-job reclaim, and capped retries; process-local mode
remains the default.
Live retrieval uses the existing PostgreSQL/pgvector and embedding adapters;
deterministic tests use injected adapters.

For local demos, `KNOWLEDGE_INGESTION_MODE=inline` wires real multipart uploads
to the existing local flow runner. The upload response waits for stored-file
text extraction, chunk persistence, embedding, vector upsert, and final
document/job state. This mode requires PostgreSQL plus configured embedding and
pgvector adapters; it is not enabled by default and is not a production queue.

For local pgvector verification, run the opt-in smoke test:

```bash
KNOWLEDGE_PGVECTOR_SMOKE=1 \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/virtual_company_dev" \
KNOWLEDGE_VECTOR_PROVIDER=pgvector \
KNOWLEDGE_VECTOR_DIMENSIONS=3 \
KNOWLEDGE_VECTOR_DISTANCE=cosine \
npm run smoke:kb-rag:pgvector
```

The smoke test seeds namespaced KB/RAG document/chunk records, uses
deterministic vectors, upserts through `PgvectorKnowledgeVectorIndexAdapter`,
retrieves evidence through `KnowledgeRetrievalSearchUseCase`, verifies
workspace isolation, and cleans up its records. Without
`KNOWLEDGE_PGVECTOR_SMOKE=1`, it exits successfully as skipped. This is not a
benchmark, load test, queue runtime, or production readiness gate.

The frontend prototype already contains a base layout, shared KB/RAG UI
components, local mock data/types, a Documents screen, and an Upload Documents
screen. Backend implementation must not assume those local mock types are the
final API contract.

## Boundary

This module owns:

- Document metadata and lifecycle state.
- Upload validation and prepare intent.
- Ingestion requests and ingestion job status.
- Document chunks and embedding/indexing status.
- External data source connection metadata.
- Synchronization scope configuration.
- Manual and future automated sync job state.
- Knowledge access and retrieval boundaries.

This module references but does not own:

- User identity from Authentication.
- Workspace and workspace membership from Workspace Management and Workspace
  User Management.
- Agent identity and public summaries from Agent Management.
- Task execution, task logs, and result aggregation from Task Orchestration.
- Workflow definitions and execution requests from Workflow Management.

Do not import private code from those modules. Use public APIs, shared DTOs,
domain events, or explicit adapter ports.

## Agent Management Reference

Agent Management is a useful reference for:

- `api/application/domain/infrastructure` layering.
- Repository interfaces with in-memory and Prisma implementations.
- Shared `ApiResponse` envelope helpers.
- Public summary DTOs that exclude private implementation details.
- Frontend API client style.
- Contract and persistence tests.

Do not copy Agent Management entities or lifecycle logic. KB/RAG has different
domain concepts: documents, uploads, validation, ingestion jobs, chunks,
embedding/indexing status, external data sources, sync scope, sync jobs,
processing events, and worker handoff.

## Domain Concepts

The backend boundary defines these module-owned concepts:

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

The domain models intentionally keep object storage references and vector
references as opaque server-side strings (`storageKey`, `vectorRef`). Public DTO
mappers do not expose those fields.

## DB Ownership

The DB boundary is defined in `packages/database/prisma/schema.prisma`. Backend
repositories use `@vcp/database` and only access KB/RAG-owned Prisma models.

Rules:

- KB/RAG owns its document, chunk, ingestion, source, sync, index, and
  knowledge-access tables.
- Other modules must not create or mutate KB/RAG tables directly.
- KB/RAG must not create or mutate tables owned by other modules.
- Backend and worker code must use `@vcp/database` exports instead of relative
  Prisma imports.
- Workspace-scoped records must include `workspaceId`.
- Actor identity, timestamps, statuses, and API response shape should follow
  shared platform conventions.

## HTTP API Contract

### Agent knowledge assignment

The KB/RAG-owned document grant API uses one workspace-scoped route family:

```text
GET    /api/workspaces/:workspaceId/knowledge/agents/:agentId/documents
POST   /api/workspaces/:workspaceId/knowledge/agents/:agentId/documents/:documentId
DELETE /api/workspaces/:workspaceId/knowledge/agents/:agentId/documents/:documentId
```

List requires `workspace:read`; assign and revoke require `knowledge:manage`.
The application use case verifies both agent and document through
workspace-scoped ports and returns the same safe denial for cross-workspace or
missing resources. Assign is idempotent and reactivates a revoked composite
grant. Revoke is idempotent, and list returns active document grants only.

Responses contain safe document DTOs and never expose grant IDs, storage
details, content, chunks, embeddings, vectors, provider payloads, credentials,
or runtime internals. This API remains document-level. Source/collection grants
and production Agent Orchestration/OpenClaw tool registration are deferred.

### Internal agent retrieval tool

`AgentKnowledgeRetrievalTool` exposes the internal tool name
`knowledge.retrieve`. It accepts a workspace ID, agent ID, query, optional
`topK`, and optional document/source filters. It delegates to the existing
`KnowledgeRetrievalSearchUseCase` with agent context; it does not call
embedding or vector adapters directly.

The tool returns `found`, `empty`, `unauthorized`, `invalid_request`, or
`error` plus bounded citation-style evidence. Only active document grants are
eligible. Requested filters are intersected with those grants, revoked grants
are ignored, and skill/config references do not grant access. An agent with no
eligible documents receives an empty response before embedding or vector
search.

Agent identity is checked through an injected workspace-scoped lookup port.
The output contains safe document metadata and bounded snippets only; it does
not expose chunks, storage/vector references, provider payloads, credentials,
or raw errors.

### Agent orchestration demo integration

`POST /api/workspaces/:workspaceId/knowledge/agents/:agentId/ask` provides the
smallest local-demo orchestration path. It requires the existing `rag:answer`
workspace permission, accepts `message`, optional `topK`, and optional
document/source filters, then invokes `AgentKnowledgeRetrievalTool`.

When assigned evidence is found, `AgentKnowledgeOrchestrationUseCase` creates a
deterministic evidence-only answer and returns safe citations. When no active
grant/evidence remains, it returns `insufficient_evidence` without calling a
response composer. Missing/cross-workspace agents are denied safely. This path
does not call a real LLM, change Task & Orchestration, register an OpenClaw
tool, or provide a chatbot UI.

The existing Task chat consumes this use case through Task Orchestration's
injected `AgentKnowledgeAskPort`. This adapter preserves the KB/RAG-owned grant
and retrieval boundary; Task Orchestration does not access repositories,
embeddings, or vector storage directly.

Cross-feature local-demo evidence is covered by:

```bash
node tests/contract/upload-to-task-chat-rag-integration.test.mjs
```

The test uploads TXT content through the local upload-to-index flow, verifies
persisted chunks and vector-boundary upserts, assigns the indexed document to an
agent, asks through the Task chat bridge route, verifies answer citations,
revokes the assignment, and confirms the same prompt falls back to
`insufficient_evidence`. It also checks an unassigned agent, workspace
isolation, and safe public response fields. The test uses deterministic
embedding/vector/composer adapters; real local retrieval through pgvector is
covered separately by the opt-in smoke script.

The public contract uses workspace-scoped routes under
`/api/workspaces/:workspaceId/knowledge/...`:

```text
GET    /api/workspaces/:workspaceId/knowledge/documents
POST   /api/workspaces/:workspaceId/knowledge/uploads/validate
POST   /api/workspaces/:workspaceId/knowledge/uploads
POST   /api/workspaces/:workspaceId/knowledge/uploads/prepare
GET    /api/workspaces/:workspaceId/knowledge/ingestion-jobs
GET    /api/workspaces/:workspaceId/knowledge/data-sources
POST   /api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect
GET    /api/workspaces/:workspaceId/knowledge/sync-scope
PUT    /api/workspaces/:workspaceId/knowledge/sync-scope
POST   /api/workspaces/:workspaceId/knowledge/sync-jobs
GET    /api/workspaces/:workspaceId/knowledge/sync-jobs
```

The API router in `api/knowledge-base-rag-router.ts` maps these routes to
application use cases. It parses request bodies, reads `workspaceId` from the
route path, takes actor identity from `request.context`, returns shared DTOs
through `ApiResponse` envelopes, and does not call Prisma, embedding, vector,
worker, or provider adapters directly. Real file uploads use multipart form
data on `/uploads`; the router only parses the incoming file payload and hands
it to the application use case, which stores content through the module-local
storage port.

Request bodies must not accept trusted fields such as
`workspaceId`, actor/user ID, generated IDs, lifecycle status, timestamps, raw
credentials, private object-storage paths, or vector DB internals.

## Shared DTOs

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

Shared DTOs must be caller-safe. Do not expose credentials, tokens, secrets,
passwords, raw provider config, private vector database fields, raw embedding
payloads, or server-owned mutation fields.

## Domain Event Contracts

The shared contracts currently include legacy `knowledge.document_uploaded` and
`knowledge.index_ready` names plus granular KB/RAG lifecycle events:

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
when user-triggered, document/source/job IDs when relevant, status,
`occurredAt`, and safe failure fields. Do not leak pgvector internals,
embedding-provider private payloads, queue internals, raw chunk operations, or
credentials.

## Intended Backend Structure

```text
apps/backend/src/modules/knowledge-base-rag/
|-- api/
|-- application/
|-- domain/
`-- infrastructure/
```

Current backend foundation:

- `api/knowledge-base-rag-router.ts`
- `api/knowledge-base-rag-request-parsers.ts`
- `api/api-response.ts`
- `application/*-repository.ts`
- `application/dto-mappers.ts`
- `application/knowledge-document-use-cases.ts`
- `application/knowledge-upload-use-cases.ts`
- `application/knowledge-ingestion-use-cases.ts`
- `application/knowledge-data-source-use-cases.ts`
- `application/knowledge-sync-use-cases.ts`
- `application/knowledge-base-rag-events.ts`
- `application/knowledge-base-rag-errors.ts`
- `domain/knowledge-document.ts`
- `domain/knowledge-ingestion-job.ts`
- `domain/knowledge-data-source.ts`
- `domain/knowledge-sync.ts`
- `infrastructure/prisma-*.ts`
- `infrastructure/in-memory-knowledge-base-rag-repositories.ts`
- `worker/knowledge-ingestion-handoff.ts`
- `worker/knowledge-base-rag-local-flow-runner.ts`
- `worker/knowledge-document-content-reader.ts`
- `worker/knowledge-document-processing-pipeline.ts`
- `worker/knowledge-embedding-adapter.ts`
- `worker/knowledge-vector-index-adapter.ts`
- `worker/knowledge-document-indexing-pipeline.ts`
- `worker/knowledge-indexing-errors.ts`
- `worker/knowledge-document-text-normalizer.ts`
- `worker/knowledge-document-text-chunker.ts`

Likely future production-runtime files:

- `application/ports.ts`
- `domain/upload-validation.ts`
- `domain/knowledge-events.ts`
- `infrastructure/*-adapter.ts`

API code should translate HTTP and request context into application commands.
Application code should depend on ports. Domain code should hold lifecycle and
validation rules. Infrastructure should implement persistence, vector,
embedding, object-storage, and queue adapters.

Current repository ports cover documents and chunks, ingestion jobs, external
data sources, sync scope nodes, sync jobs, and sync job events. Prisma adapters
are workspace-scoped and do not query private models owned by Agent Management,
Workflow Management, Task Orchestration, Authentication, or other modules.
In-memory adapters are deterministic and workspace-scoped for future
application/use-case tests.

Current application use cases cover metadata-only upload validation, safe
upload preparation into pending document/ingestion-job records, real file upload
storage through `KnowledgeFileStorage`, document and chunk reads, ingestion-job
reads, data-source placeholder connection, sync-scope updates, and queued manual
sync-job creation. Stored document parsing is isolated behind a backend parser
boundary; application use cases do not call parser dependencies directly.

## Local Upload Storage

`LocalKnowledgeFileStorage` stores accepted upload bytes below
`KNOWLEDGE_FILE_STORAGE_DIR` when set, otherwise
`.data/knowledge-base-rag/uploads`. The value is optional for local development.
The storage key and local path remain backend-private; public DTOs expose only
safe document metadata. If repository persistence fails after a file write, the
upload use case attempts best-effort cleanup through the storage boundary before
returning a safe API failure.

## Document Text Extraction

`KnowledgeDocumentTextExtractor` keeps parser implementation details behind a
backend-only boundary. `RuntimeKnowledgeDocumentTextExtractor` uses strict
UTF-8 `TextDecoder` behavior for TXT, CSV, and Markdown, `mammoth` for DOCX,
and `pdf-parse` for text-based PDF content. Manual upload accepts `.pdf`,
`.docx`, `.txt`, `.csv`, `.md`, and `.markdown`; browser-provided plain-text
or octet-stream MIME aliases are accepted only when paired with one of those
extensions. Extracted text is normalized before downstream processing, and
internal attribution retains only workspace ID, document ID, original
filename, and media type.

Corrupt, unreadable, and empty documents produce controlled parser errors.
Storage keys, local paths, parser stack traces, raw XML/PDF data, and dependency
errors are not included in public DTOs or persisted failure messages. PDF files
without extractable text require future OCR and fail safely in this slice.

The worker handoff skeleton processes an already-created pending ingestion job
at the lifecycle level only:

```text
pending -> ingesting -> ready
pending -> ingesting -> failed
```

It updates KB/RAG-owned document and ingestion-job status through repository
ports, creates safe ingestion started/completed/failed events through existing
event contracts, and returns/publishes only public lifecycle payloads. It does
not call storage or parser implementations directly, generate embeddings, write
vectors, or run external sync.

## Production Ingestion Worker Runtime

`KnowledgeIngestionWorkerRunner` provides a module-local callable runtime
without starting a background loop. `processNextQueuedJob(workspaceId)` selects
the oldest pending job for that workspace and returns `null` when no work is
available. `processJob(workspaceId, jobId)` processes an explicitly received
job identifier through the same guarded handoff.

`createKnowledgeIngestionWorkerRuntime` composes the storage reader, document
text extractor, deterministic processing/chunking pipeline, lifecycle handoff,
repositories, and optional event publisher. It intentionally does not compose
the embedding or vector indexing pipeline.

The persisted domain lifecycle maps product terms as follows:

```text
queued      -> pending
processing  -> ingesting
completed   -> ready
failed      -> failed
```

Public user-triggered retry remains deferred because there is no reviewed reset
endpoint. Durable runtime retries are internal and capped. PostgreSQL durable
mode atomically claims queued work with `FOR UPDATE SKIP LOCKED`, prevents a
second worker from taking an active lease, and reclaims expired leases.

The document processing pipeline is the first real ingestion processor boundary.
It reads extracted text through an injected content reader, supports TXT, DOCX,
and text-based PDF content, normalizes whitespace deterministically, splits text
into stable chunks, and persists `KnowledgeDocumentChunk` records through the
document repository. It marks ingestion as complete while leaving
embedding/vector indexing pending.

The document indexing pipeline is a separate worker boundary for already
persisted chunks. It loads chunks through the document repository, marks
document indexing as `ingesting`, generates embeddings through an injected
`KnowledgeEmbeddingAdapter`, upserts vectors through an injected
`KnowledgeVectorIndexAdapter`, marks chunks ready with opaque internal
`vectorRef` values, and marks the document indexing state `ready` or `failed`.
It does not expose embeddings or vector internals through public DTOs or
events. It is intentionally not wired into the ingestion handoff automatically
so the existing text-processing lifecycle remains narrow and predictable.

## Real Embedding Provider

`OpenAICompatibleKnowledgeEmbeddingAdapter` implements the existing backend
embedding port using built-in `fetch`. It accepts persisted chunk text from the
indexing pipeline, batches requests deterministically, restores provider results
to input order, and validates result count, numeric values, and configured
dimensions before handing vectors to `KnowledgeVectorIndexAdapter`.

OpenRouter embedding configuration for the local web demo:

```text
KNOWLEDGE_EMBEDDING_PROVIDER=openrouter
KNOWLEDGE_EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
KNOWLEDGE_EMBEDDING_MODEL=openai/text-embedding-3-small
KNOWLEDGE_EMBEDDING_DIMENSIONS=1536
OPENROUTER_API_KEY=
```

For provider `openrouter`, `KNOWLEDGE_EMBEDDING_BASE_URL` defaults to
`https://openrouter.ai/api/v1`, `KNOWLEDGE_EMBEDDING_MODEL` defaults to
`openai/text-embedding-3-small`, and the adapter reads `OPENROUTER_API_KEY`
with `KNOWLEDGE_EMBEDDING_API_KEY` as a compatibility fallback. Keep
`KNOWLEDGE_VECTOR_DIMENSIONS=1536` for this model; `3` is only for the opt-in
pgvector smoke test.

The existing `openai-compatible` provider remains supported with
`KNOWLEDGE_EMBEDDING_API_KEY`, explicit base URL, model, and dimensions.
`KNOWLEDGE_EMBEDDING_BATCH_SIZE` defaults to `32`, and
`KNOWLEDGE_EMBEDDING_TIMEOUT_MS` defaults to `30000`. Configuration and provider
failures use fixed safe errors; API keys, authorization headers, raw
requests/responses, and raw embeddings are not persisted or mapped publicly.
Tests retain deterministic inline adapters and use injected mock fetch
implementations, never real provider calls.

## PostgreSQL pgvector Index

`PgvectorKnowledgeVectorIndexAdapter` implements the backend vector index port
through the existing Prisma/PostgreSQL connection. Embeddings are stored on
the existing workspace-scoped chunk rows using the pgvector `vector` type. No
separate vector database service or connection is used.

Required runtime configuration:

```text
DATABASE_URL=<primary PostgreSQL connection>
KNOWLEDGE_VECTOR_PROVIDER=pgvector
KNOWLEDGE_VECTOR_DIMENSIONS=<embedding dimension>
KNOWLEDGE_VECTOR_DISTANCE=cosine
```

`KNOWLEDGE_VECTOR_BATCH_SIZE` defaults to `64`. Supported distance modes are
`cosine`, `euclidean`, and `inner-product`. The configured dimension is checked
before every write and query and persisted beside each vector.

The pgvector schema is installed through the repository migration, not at
runtime. `ensureIndex()` performs a non-destructive readiness check for the
extension and vector column. Upserts update the existing chunk row using its
workspace/document/chunk identity, so reindexing replaces the prior vector.

Internal vector queries require `workspaceId` and add that condition directly
to parameterized SQL. Optional exact document and source-locator filters are
supported. Query rows select safe attribution and distance only; raw vectors,
SQL details, database configuration, and internal vector references are not
returned.

The indexing pipeline uses batch embedding/vector methods when both adapters
support them and retains the single-item path for deterministic fakes. Tests
inject a mocked Prisma-compatible raw-query boundary and do not require a
running PostgreSQL service.

The vector column is dimension-flexible, so this slice uses exact pgvector
distance ordering rather than creating an ANN index tied to one dimension.
Adding a production ANN index requires selecting and fixing a model dimension
in a later migration.

Legacy DOC parsing and OCR remain outside the supported parser scope. Google
Drive synchronization imports supported scoped content through this same
ingestion and indexing pipeline.

## Retrieval/Search API

`POST /api/workspaces/:workspaceId/knowledge/retrieval/search` accepts:

```json
{
  "query": "escalation policy",
  "topK": 5,
  "filters": {
    "documentIds": ["document-id"],
    "sourceTypes": ["upload"],
    "sourceLocators": ["text:0"],
    "statuses": ["ready"]
  }
}
```

`KnowledgeRetrievalSearchUseCase` validates and normalizes the request,
generates a query embedding through the configured embedding adapter, queries
the pgvector adapter with mandatory workspace scope, and hydrates matches from
the document repository. Only ready documents and ready indexed chunks are
eligible.

The response contains ranked evidence with safe document/chunk IDs, document
title, bounded snippet, source type/locator, score, and chunk index. It does not
contain embeddings, vectors, vector references, storage paths, SQL, provider
payloads, credentials, secrets, or tokens. Empty searches return
`{ "results": [], "total": 0 }`.

Application validation and DTOs are independent of Express. The request,
response, error codes, and use-case method can be mirrored directly with
FastAPI/Pydantic if the backend stack is migrated later. This endpoint returns
evidence only and does not generate a RAG answer.

### Grounded RAG answer runtime

`POST /api/workspaces/:workspaceId/knowledge/rag/answer` accepts the retrieval
query, bounded `topK`, the existing safe retrieval filters, and optional
`maxAnswerLength` / `includeCitations` answer options. The application use case
reuses retrieval/search and passes only ranked, bounded evidence snippets to an
injected answer provider.

The runtime calls an OpenAI-compatible `chat/completions` endpoint only when at
least one evidence item has usable text and meets the conservative score gate.
No or weak evidence returns `insufficient_evidence` without a provider call.
Provider failures return a safe `provider_error` fallback. Answers cite only
evidence included in the same response; unknown provider citation IDs are
discarded.

Real provider mode uses:

- `KNOWLEDGE_RAG_PROVIDER=openai-compatible`
- `KNOWLEDGE_RAG_BASE_URL`
- `KNOWLEDGE_RAG_API_KEY`
- `KNOWLEDGE_RAG_MODEL`
- optional `KNOWLEDGE_RAG_TIMEOUT_MS` (default `30000`)
- optional `KNOWLEDGE_RAG_MAX_OUTPUT_TOKENS` (default `800`)

Raw prompts, provider payloads, credentials, embeddings, vectors, storage
details, and chain-of-thought are backend-internal and are never public DTO
fields. Tests use injected deterministic providers or mocked `fetch`; they do
not call external services. This framework-neutral request/use-case/response
boundary can be mirrored with FastAPI/Pydantic later. It is an optional
downstream capability over the indexing-focused KB/RAG core, not a chatbot UI.

## Permission and Access Control

`KnowledgeBaseRagAccessPolicy` is the framework-neutral authorization boundary.
Authenticated workspace members use the existing role permissions:

- `workspace:read` permits document/source/status reads, retrieval, and RAG
  answers.
- `knowledge:manage` permits upload/delete policy checks, source changes,
  synchronization-scope changes, and manual synchronization requests.

The HTTP router derives user, role, and workspace from trusted request context.
Route/body filters cannot replace workspace scope. Repositories, pgvector
queries, evidence hydration, and stored-content reads all re-check workspace
ownership.

Agent access is narrower than user workspace access. Internal agent retrieval
requires an active `KnowledgeAccessGrant` for each document. Granted document
IDs are applied before embedding/vector calls and re-checked during evidence
hydration. RAG answer generation forwards the same internal agent context to
retrieval, so only authorized evidence can reach the answer provider.
Changing the unique workspace/document/agent grant to `revoked` immediately
removes that document from agent retrieval and RAG evidence.

Agent instructions, requested-knowledge configuration, and `skill.md`
references are intent only. They are not policy inputs and never create grants.
The repository/policy boundary supports active and revoked grants, but this
slice does not add a public grant-management API; an explicit administration
workflow remains a follow-up. Grants are document-level only. Source-level
grants are deferred; source filters are still intersected with the agent's
granted document IDs. No frontend or grant-administration UI is added here.
The action, subject, and repository boundaries are independent of Express and
can be mirrored by a future FastAPI dependency/policy layer.

The local flow runner is test-only orchestration for prepared documents and
ingestion jobs. It wires the existing ingestion handoff to the text processing
pipeline, then runs the indexing pipeline over persisted chunks. Tests inject a
fake content reader, deterministic embedding adapter, fake in-memory vector
index adapter, clocks, and ID generators. It does not schedule background jobs,
read real storage, call real providers, or implement RAG answer generation.

## Worker Handoff

Long-running ingestion and synchronization must run through workers, not inside
HTTP request handlers.

Expected flow:

1. Validate upload candidates.
2. Prepare valid uploads into document metadata.
3. Queue a document ingestion job.
4. Worker handoff marks the job/document as processing.
5. The text processing pipeline normalizes supported text and persists chunks.
6. The separate indexing pipeline can embed and index persisted chunks through
   injected fake or future real adapters.
7. The local flow runner can compose steps 4-6 in contract tests only.
8. Emit public domain events.
9. UI reads document, ingestion, and sync status through API routes.

## Testing Roadmap

Future implementation should add focused tests for:

- Shared contracts and DTO exposure rules.
- DB schema and migration boundaries.
- Domain validation and lifecycle rules.
- Application/use-case behavior.
- In-memory repositories.
- Prisma mappers and repositories.
- API router auth, RBAC, workspace scoping, validation, and envelopes.
- Frontend API client behavior once added.
- Component behavior for Documents and Upload screens once connected.
- Import-boundary checks.
- Worker queue handoff and handler behavior.
- Functional PA5 scenarios for upload validation, preparation, ingestion,
  indexing status, data-source connection placeholders, sync scope, manual sync,
  and failure reporting.

## Implementation Rules

- Keep module code inside `apps/backend/src/modules/knowledge-base-rag` unless
  a reviewed shared-boundary change explicitly requires otherwise.
- Use shared infrastructure through `apps/backend/src/shared/*`.
- Use shared contracts through `@vcp/shared`.
- Use database exports through `@vcp/database` in backend/worker code only.
- Do not import private code from Agent Management, Workflow Management, Task
  Orchestration, or other modules.
- Do not add shared contracts without tests and an OpenSpec-backed reason.
- Do not add runtime code in documentation-only architecture issues.
