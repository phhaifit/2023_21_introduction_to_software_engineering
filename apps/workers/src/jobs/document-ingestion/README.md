# Document Ingestion Jobs

Use these jobs for document parsing, chunking, embedding, and vector index updates.

The Knowledge Base / RAG module owns document metadata and permissions.

Current status:

- Queue entrypoints exist for document ingestion and Google Drive sync.
- KB/RAG now has a module-local handoff and deterministic text processing
  pipeline under `apps/backend/src/modules/knowledge-base-rag/worker`.
- The local server composes real object storage reads, TXT/Markdown/CSV,
  text-bearing PDF and DOCX extraction, embedding, and pgvector adapters through
  a process-local queue by default or a PostgreSQL durable queue when enabled.
- Durable mode uses atomic claims, expiring leases, abandoned-job reclaim, and
  capped retries across multiple backend instances.
- OCR, legacy DOC parsing, and a separately deployed autoscaled worker service
  remain future scope.

Future async responsibilities:

- Connect the app worker queue to the KB/RAG module-local handoff.
- Move the in-process durable poller into a separately deployed worker service
  if deployment scale requires independent worker autoscaling.
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
