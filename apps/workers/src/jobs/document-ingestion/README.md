# Document Ingestion Jobs

Use these jobs for document parsing, chunking, embedding, and vector index updates.

The Knowledge Base / RAG module owns document metadata and permissions.

Current status:

- Queue entrypoint/context only in this app folder.
- KB/RAG now has a module-local handoff and deterministic text processing
  pipeline under `apps/backend/src/modules/knowledge-base-rag/worker`.
- Full worker app registration, object storage readers, PDF/DOC/DOCX parsing,
  OCR, embedding, and vector indexing remain future scope.

Future async responsibilities:

- Connect the app worker queue to the KB/RAG module-local handoff.
- Add object storage readers for uploaded or synchronized files.
- Add real PDF/DOC/DOCX/OCR extraction adapters.
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
- Keep parser/storage/embedding/vector adapters behind explicit boundaries.
