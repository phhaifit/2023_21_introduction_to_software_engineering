# Knowledge Base / RAG Module

Owner: Member 9

Active OpenSpec change: `implement-knowledge-base-rag`.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own document metadata, ingestion requests, sync configuration, vector index status, and knowledge permissions.
- Enforce workspace scope and agent-document permissions for retrieval.
- Keep slow ingestion and embedding work in workers.

Current status:

- Documentation/context only.
- No backend implementation is required for issue #36.
- Do not add backend routes, repositories, persistence, queues, adapters, or
  API DTOs until a backend-specific issue is active.

Future backend responsibilities:

- Document metadata and lifecycle state.
- Uploaded/synchronized object references.
- Ingestion job records and status updates.
- External data source connection metadata.
- Synchronization scope configuration.
- Manual and automated sync job creation.
- Knowledge access assignment for agents.
- Retrieval boundary that uses a vector adapter instead of direct vector store
  calls from other modules.

Implementation rules:

- Keep module code inside `apps/backend/src/modules/knowledge-base-rag`.
- Use shared infrastructure only through approved boundaries such as
  `apps/backend/src/shared/*` and `@vcp/shared`.
- Do not import private code from Agent Management, Task Orchestration, or other
  modules.
- Do not change shared contracts without a reviewed OpenSpec-backed reason.
