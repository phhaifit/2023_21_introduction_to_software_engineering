## Context

Knowledge Base / RAG gives agents access to workspace-specific documents and internal data. The foundation selected a vector database behind an adapter, with Qdrant as the expected V1 target and an embedding adapter that can be mocked locally.

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
   - Rationale: The team can demo with mocks or local services while preserving the Qdrant-oriented architecture.
   - Alternative considered: Direct Qdrant calls throughout the module. Rejected because it would make tests and future replacement harder.

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

## Risks / Trade-offs

- File parsing varies by format -> Start with a small supported parser set and report unsupported files clearly.
- Embedding services may be unavailable -> Provide mock/local adapter mode for demos and tests.
- Access control is security-sensitive -> Check agent knowledge assignment before retrieval, not only during upload.
- Public contracts can drift from prototype UI mocks -> Map or adapt frontend mock data to `@vcp/shared` DTOs before adding API-client work.
- KB/RAG persistence can outgrow the initial additive schema -> Add later migrations only through focused OpenSpec-backed issues and keep vector/embedding provider internals behind adapters.
