## Context

Knowledge Base / RAG gives agents access to workspace-specific documents and internal data. The foundation stores chunk vectors in the primary PostgreSQL database through pgvector behind an adapter, with an embedding adapter that can be mocked locally.

## Goals / Non-Goals

**Goals:**
- Upload and manage workspace documents.
- Add placeholders for external data sync sources.
- Process ingestion and vectorization asynchronously.
- Store and query vector chunks through an adapter boundary.
- Assign knowledge collections to specific agents.

**Non-Goals:**
- Build full Google Drive, Notion, or Confluence production integrations in V1.
- Implement advanced document permission inheritance.
- Expose raw vector database implementation details to agents or task orchestration.

## Decisions

1. Process ingestion through a worker.
   - Rationale: Parsing, chunking, embedding, and vector writes are slow and retryable.
   - Alternative considered: Do all processing inside upload requests. Rejected due to timeout and retry risk.

2. Use vector and embedding adapters.
   - Rationale: The team can test with mocks while production vector persistence remains in the primary PostgreSQL database through pgvector.
   - Alternative considered: A separate external vector database. Rejected because the SAD architecture selects PostgreSQL pgvector and separate infrastructure would add operational and tenant-boundary complexity.

3. Keep knowledge access assignment agent-specific.
   - Rationale: Requirements need precise control over which agent can access which documents.
   - Alternative considered: Every agent can read all workspace documents. Rejected because it weakens internal data control.

4. Store document lifecycle status.
   - Rationale: Users need to know whether uploaded data is pending, indexed, failed, or disabled.

5. Use workspace-scoped public API and shared DTO contracts.
   - Rationale: Knowledge documents, ingestion jobs, data sources, and sync scope are workspace-owned resources, so the public boundary uses `/api/workspaces/:workspaceId/knowledge/...` and derives trusted tenant/user context from route and auth middleware.
   - Alternative considered: Short `/api/knowledge-base/...` routes. Rejected because they would bypass the current API matrix convention for workspace-owned resources.

6. Keep KB/RAG public DTOs caller-safe.
   - Rationale: Frontend, backend, workers, and future module integrations need stable DTOs without credentials, provider secrets, object-storage private paths, raw vector records, embedding payloads, queue internals, generated lifecycle fields, or trusted actor/workspace inputs in request bodies.
   - Alternative considered: Reusing frontend mock view types as API contracts. Rejected because local view state can drift and may encode presentation-only fields.

7. Add granular public domain events without removing legacy event names.
   - Rationale: Future ingestion and sync flows need public state-transition events while existing `knowledge.document_uploaded` and `knowledge.index_ready` names may still be referenced by older docs/tests.
   - Alternative considered: Replacing legacy event names immediately. Rejected until usage is audited and a compatibility migration is approved.

8. Define KB/RAG-owned Prisma persistence with additive schema changes.
   - Rationale: The existing Prisma skeleton already includes KB/RAG-owned `Document`, `KnowledgeIndex`, and `KnowledgeAccessGrant` models. The persistence boundary should extend those models safely and add the missing module-owned records for chunks, ingestion jobs, data sources, sync scope, sync jobs, and sync job events.
   - Alternative considered: Creating a duplicate `KnowledgeDocument` model/table. Rejected because `Document` is already the KB/RAG-owned document table in the platform skeleton.
   - Alternative considered: Reusing the generic `Job` table for all ingestion and sync details. Rejected because KB/RAG needs module-specific progress, source, and safe error fields while the generic `Job` table remains a platform-level work record.
   - Boundary: Cross-module references remain scalar public IDs; no raw credentials, OAuth refresh tokens, provider secrets, object-storage URLs, raw embedding vectors, raw vector DB configuration, queue internals, or provider private payloads are stored.

9. Add internal KB/RAG-owned relations while preserving cross-module scalar references.
   - Rationale: Internal document, chunk, ingestion, data-source, sync-scope, sync-job, sync-event, index, and access-grant records should have database integrity within the KB/RAG ownership boundary.
   - Boundary: KB/RAG uses `onDelete: Restrict` and `onUpdate: NoAction` for internal FKs and does not add FKs from KB/RAG tables to users, workspaces, agents, workflows, tasks, subscriptions, authentication, or session tables.
   - Alternative considered: Keeping all KB/RAG references scalar-only. Rejected because repository convention already uses Prisma relations/FKs for module-owned internal relationships.

10. Define backend domain/application/infrastructure boundaries before API and worker runtime.
   - Rationale: API routers and workers should depend on stable domain models, repository ports, safe DTO mappers, and persistence adapters rather than reaching directly into Prisma records or frontend mock data.
   - Boundary: This slice adds internal backend models, repository interfaces, Prisma repositories, and in-memory repositories only. It does not implement HTTP routers, request validation, file/object storage, embedding/vector adapters, worker handlers, frontend API clients, or new Prisma schema changes.
   - Constraint: Prisma repositories use only KB/RAG-owned models and keep cross-module references as scalar public IDs.

11. Add application use cases before HTTP routes.
   - Rationale: Future API routers and workers should call stable application services instead of reaching directly into repositories or infrastructure adapters.
   - Boundary: Application use cases validate upload candidate metadata, prepare safe pending document and ingestion-job records, read document/chunk/job/source/sync state, connect data-source placeholders, update sync scope, and create queued manual sync-job records. They do not parse files, upload to object storage, enqueue runtime worker handlers, call embedding providers, call external data-source providers, or write to a vector database.
   - Constraint: Use cases receive trusted `workspaceId` and actor identity from caller context, use injected repository ports, clock, and ID generators, and return caller-safe shared DTOs.

12. Expose a thin workspace-scoped HTTP API router after application use cases exist.
   - Rationale: Backend clients need the finalized `/api/workspaces/:workspaceId/knowledge/...` route family to call KB/RAG use cases through shared API envelopes without reaching into repositories or infrastructure.
   - Boundary: The router parses request/query payloads, derives `workspaceId` from the route, derives actor identity from request context, enforces `knowledge:manage` for mutations, maps application errors to shared API errors, and returns shared DTOs. It does not parse files, upload to object storage, call worker runtimes, call embedding/vector providers, call external source providers, or import Prisma directly.
   - Constraint: Request bodies must not accept trusted workspace IDs, actor/user IDs, generated IDs, lifecycle statuses, timestamps, storage keys, vector references, queue payloads, credentials, tokens, or secrets.

13. Add a frontend API client boundary before wiring UI screens.
   - Rationale: Documents and Upload screens should connect to live data through a typed client that uses the finalized shared DTOs and route family, rather than embedding fetch logic in components or continuing to evolve mock view types as contracts.
   - Boundary: The client builds `/api/workspaces/:workspaceId/knowledge/...` URLs, parses shared API envelopes, maps API/network/malformed response errors consistently, and rejects unsafe request-body fields before fetch. It does not parse files, upload to storage, call worker runtimes, call embedding/vector providers, or introduce new dependencies.
   - Constraint: Frontend code must not import backend, worker, Prisma, database, or another module's private internals.

14. Wire Documents and Upload screens through the frontend API client in a scoped slice.
   - Rationale: Runtime screens should stop treating local mock data as the source of truth once backend routes and the typed frontend API client exist.
   - Boundary: Documents loads `KnowledgeDocumentDto` values through `listDocuments`; Upload converts selected `File` objects to metadata-only `UploadCandidateFileDto` values, validates candidates through the API client, and prepares only accepted candidates. This slice does not integrate Data Sources, Synchronization Scope, Processing Status, worker runtime, object storage, file parsing, embedding providers, vector databases, or new dependencies.
   - Constraint: Frontend code must not import backend, worker, Prisma, database, or another module's private internals.

15. Wire Data Sources and Synchronization Scope screens through the frontend API client in a scoped slice.
   - Rationale: Runtime source/scope screens should use the same shared DTO and route boundary as backend routes instead of remaining static placeholders once the API client exists.
   - Boundary: Data Sources loads `KnowledgeDataSourceDto` values through `listDataSources` and records safe connection intent through `connectDataSource` without credentials. Synchronization Scope loads `SyncScopeNodeDto` values through `getSyncScope`, persists selected scope IDs through `updateSyncScope`, requests queued manual sync intent through `requestManualSync`, and displays `SyncJobDto` values through `listSyncJobs`. This slice does not integrate Processing Status, worker runtime, external provider/OAuth flows, credentials, object storage, file parsing, embedding providers, vector databases, or new dependencies.
   - Constraint: Frontend request bodies must not include workspace IDs, actor/user IDs, generated IDs, lifecycle status controlled by the server, timestamps, storage keys, vector references, queue payloads, credentials, secrets, tokens, refresh tokens, passwords, raw provider payloads, raw embeddings, or vector config.

16. Add a lifecycle-only worker handoff before real ingestion adapters.
   - Rationale: Future worker entrypoints need a stable module-owned handoff that updates already-created ingestion jobs and documents without reaching directly into Prisma or running slow work inside HTTP handlers.
   - Boundary: The handoff accepts a workspace-scoped pending ingestion job, marks the job/document as ingesting, runs an injected no-op processor by default, then marks the job/document ready or failed and creates safe ingestion lifecycle events. This slice does not parse files, read object storage, create chunks, call embedding providers, write vectors, execute external sync, or add queue runtime adapters.
   - Constraint: Worker handoff code uses KB/RAG repository ports and safe event contracts only; it must not import frontend code, Prisma directly, another module's private internals, parser/storage/embedding/vector runtimes, or expose storage keys, vector refs, queue payloads, credentials, secrets, tokens, raw file contents, or raw embeddings in events.

17. Add a deterministic text processing pipeline before embedding/vector indexing.
   - Rationale: The worker needs a concrete processor boundary that can turn supported text content into repository-owned chunks while preserving adapter boundaries for file storage, embeddings, and vectors.
   - Boundary: The pipeline reads text through an injected content reader, supports text/plain and markdown-style content, normalizes whitespace deterministically, chunks text deterministically, persists `KnowledgeDocumentChunk` records through the KB/RAG document repository, and returns updated document/job state to the handoff. This slice does not read object storage directly, parse PDF/DOC/DOCX, perform OCR, call embedding providers, write vectors, implement retrieval, or add queue runtime entrypoints.
   - Constraint: Chunk records use stable generated IDs in tests, stable chunk indexes, pending embedding status, no vector references, and safe error conversion for empty, unsupported, or failed content reads.

18. Add an embedding/vector indexing adapter boundary after persisted chunks exist.
   - Rationale: The worker needs a safe boundary that can index persisted chunks with deterministic fakes now and real providers later without exposing provider or vector database internals to public contracts.
   - Boundary: The indexing pipeline loads workspace-scoped persisted chunks through the KB/RAG document repository, marks document indexing as `ingesting`, generates embeddings through an injected `KnowledgeEmbeddingAdapter`, upserts chunk embeddings through an injected `KnowledgeVectorIndexAdapter`, updates chunk embedding status/vector references internally, and marks document indexing `ready` or `failed`.
   - Constraint: This slice does not call real embedding or external vector database provider/client SDKs; does not add dependencies; does not expose raw embeddings, vector DB config, provider payloads, storage keys, or opaque vector refs in public DTOs/events; does not implement retrieval; and does not automatically wire indexing into the ingestion handoff.

19. Add a local end-to-end flow runner for deterministic integration tests.
   - Rationale: The team needs one local proof that prepared document state can move through handoff, text processing, chunk persistence, embedding, vector upsert, and final indexing status without creating production scheduling/runtime coupling.
   - Boundary: The local runner composes existing `KnowledgeIngestionHandoff`, `KnowledgeDocumentProcessingPipeline`, and `KnowledgeDocumentIndexingPipeline` with injected repositories, content reader, embedding adapter, vector index adapter, clock, ID generators, and optional event publisher.
   - Constraint: The runner is local/test orchestration only. It does not add HTTP routes, queue scheduling, real file storage, real embedding providers, real vector database clients, retrieval, RAG answer generation, Prisma changes, shared status changes, or new dependencies.

20. Expose document-level agent knowledge grants through the KB/RAG API namespace.
   - Rationale: Demo and later integration work need a minimal public boundary to assign, list, and revoke the document grants already enforced by retrieval.
   - Boundary: `GET`, `POST`, and `DELETE` routes under `/api/workspaces/:workspaceId/knowledge/agents/:agentId/documents` call a KB/RAG application use case, reuse the existing grant repository and access policy, and validate agent existence through an injected workspace-scoped lookup port.
   - Constraint: Listing requires `workspace:read`; mutations require `knowledge:manage`. Responses expose safe document metadata only. This slice does not add source/collection grants, UI, orchestration/tool integration, schema changes, worker behavior, connectors, OAuth, or new dependencies.

21. Expose assigned knowledge retrieval through an internal agent tool boundary.
   - Rationale: Agent consumers need a stable, JSON-friendly boundary that reuses KB/RAG retrieval and its document-grant enforcement without duplicating vector search logic.
   - Boundary: `AgentKnowledgeRetrievalTool` validates workspace-scoped agent identity through an injected lookup, delegates to `KnowledgeRetrievalSearchUseCase` with agent context, and maps safe results to bounded citation-style evidence under the internal name `knowledge.retrieve`.
   - Constraint: Active document grants remain the only access source. Optional filters only narrow grants; revoked grants and skill/config references do not grant access. No eligible documents returns empty before embedding/vector calls. This slice does not add a public route, tool-registry wiring, answer generation, UI, source/collection grants, task-orchestration changes, or new dependencies.

## Risks / Trade-offs

- File parsing varies by format -> Start with a small supported parser set and report unsupported files clearly.
- Embedding services may be unavailable -> Provide mock/local adapter mode for demos and tests.
- Access control is security-sensitive -> Check agent knowledge assignment before retrieval, not only during upload.
- Public contracts can drift from prototype UI mocks -> Keep runtime Documents, Upload, Data Sources, and Synchronization Scope flows mapped to shared DTOs through the API client, and keep any remaining mock data isolated to placeholder/test use.
- KB/RAG persistence can outgrow the initial additive schema -> Add later migrations only through focused OpenSpec-backed issues and keep vector/embedding provider internals behind adapters.
- A lifecycle-only worker handoff can look complete to callers -> Keep docs/tests explicit that parsing, chunking, embedding, vector writes, and external sync remain future adapter/runtime scope.
- Text-only chunking is intentionally limited -> Keep PDF/DOC/DOCX/OCR, object storage readers, embedding, and vector indexing in later adapter-focused issues.
- A standalone indexing pipeline can be mistaken for a scheduled runtime -> Keep it explicitly injected/tested and leave queue/runtime wiring for a later scoped issue.
- A local end-to-end runner can be mistaken for production runtime -> Keep it documented and tested as local/test-only composition until a separate worker runtime issue adds scheduling.
