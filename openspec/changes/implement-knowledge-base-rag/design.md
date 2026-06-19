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

## Risks / Trade-offs

- File parsing varies by format -> Start with a small supported parser set and report unsupported files clearly.
- Embedding services may be unavailable -> Provide mock/local adapter mode for demos and tests.
- Access control is security-sensitive -> Check agent knowledge assignment before retrieval, not only during upload.
