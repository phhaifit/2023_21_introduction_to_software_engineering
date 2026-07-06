# Document Ingestion Jobs

Use these jobs for document parsing, chunking, embedding, and vector index updates.

The Knowledge Base / RAG module owns document metadata and permissions.

Current status:

- Queue entrypoints exist for document ingestion and Google Drive sync.
- KB/RAG now has a module-local handoff and deterministic text processing
  pipeline under `apps/backend/src/modules/knowledge-base-rag/worker`.
- The local server composes real object storage reads, TXT/Markdown/CSV,
  text-bearing PDF and DOCX extraction, embedding, and pgvector adapters through
  a process-local asynchronous queue.
- OCR, legacy DOC parsing, a durable worker daemon, and multi-instance queue
  leasing remain future scope.

Future async responsibilities:

- Connect the app worker queue to the KB/RAG module-local handoff.
- Add durable queue delivery, leasing, capped retries, and restart-safe claims.
- Add OCR only through a separately reviewed parser/runtime change.
- Update ingestion status to pending, ingesting, ready, or failed.
- Process external source sync ingestion after a sync job creates source file
  references.

Implementation rules:

- Long-running work such as parsing, chunking, embedding, indexing, and sync
  ingestion belongs in workers, not synchronous HTTP handlers.
- Keep worker code under `apps/workers/src/jobs/document-ingestion` unless a
  later worker infrastructure issue explicitly changes the runtime boundary.
- Keep parser/storage/embedding/vector adapters behind explicit boundaries.
