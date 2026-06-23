# Document Ingestion Jobs

Use these jobs for document parsing, chunking, embedding, and vector index updates.

The Knowledge Base / RAG module owns document metadata and permissions.

Current status:

- Documentation/context only.
- Worker implementation is future scope.
- No worker code should be added for issue #36.

Future async responsibilities:

- Extract text from supported uploaded or synchronized files.
- Split extracted text into chunks.
- Generate embeddings through an embedding adapter.
- Write chunk/vector metadata through a vector database adapter.
- Update ingestion status to pending, ingesting, ready, or failed.
- Process external source sync ingestion after a sync job creates source file
  references.

Implementation rules:

- Long-running work such as parsing, chunking, embedding, indexing, and sync
  ingestion belongs in workers, not synchronous HTTP handlers.
- Keep worker code under `apps/workers/src/jobs/document-ingestion` unless a
  later worker infrastructure issue explicitly changes the runtime boundary.
- Do not add worker logic for frontend-only tickets such as issue #36.
