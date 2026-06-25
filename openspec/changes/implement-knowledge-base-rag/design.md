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

## Risks / Trade-offs

- File parsing varies by format -> Start with a small supported parser set and report unsupported files clearly.
- Embedding services may be unavailable -> Provide mock/local adapter mode for demos and tests.
- Access control is security-sensitive -> Check agent knowledge assignment before retrieval, not only during upload.
- Public contracts can drift from prototype UI mocks -> Map or adapt frontend mock data to `@vcp/shared` DTOs before adding API-client work.
