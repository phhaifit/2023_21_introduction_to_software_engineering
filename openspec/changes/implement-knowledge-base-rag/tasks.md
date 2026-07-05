## 1. Completed Boundary and Local/Test Slices

- [x] 1.1 Define KB/RAG document, chunk, ingestion job, data source, sync scope, sync job, sync event, index, and access-grant persistence/domain boundaries
- [x] 1.2 Implement KB/RAG document, chunk, ingestion job, data source, sync scope, sync job, and sync event repository ports with in-memory and Prisma adapters
- [x] 1.3 Implement backend application use cases for document reads, metadata-only upload validation, safe upload preparation, ingestion-job reads, data-source placeholders, sync-scope updates, and queued manual sync requests
- [x] 1.4 Implement the workspace-scoped backend HTTP API router for the approved KB/RAG route family
- [x] 1.5 Implement the typed frontend KB/RAG API client boundary for shared DTOs and workspace-scoped routes
- [x] 1.6 Wire Documents and Upload screens to the frontend API client for metadata-only runtime flows
- [x] 1.7 Wire Data Sources and Synchronization Scope screens to the frontend API client for safe placeholder/source/sync flows
- [x] 1.8 Implement lifecycle-only worker ingestion handoff through repository ports and safe ingestion lifecycle events
- [x] 1.9 Implement deterministic text/markdown document processing pipeline with injected content reader and chunk persistence
- [x] 1.10 Implement embedding/indexing adapter boundary with injected fake-test adapters and no real provider/vector DB calls
- [x] 1.11 Implement local end-to-end contract-test flow that composes handoff, text processing, chunk persistence, fake embeddings, fake vector upserts, and final indexing status updates
- [x] 1.12 Add focused contract/component tests for the implemented KB/RAG backend, API, frontend client/integration, worker, adapter-boundary, and local-flow slices
- [x] 1.13 Update KB/RAG docs/OpenSpec artifacts to describe implemented boundaries and explicit production gaps

## 2. Remaining Production Runtime Work

- [x] 2.1 Implement real file/object storage upload and content-read runtime
- [ ] 2.2 Implement real PDF/DOC/DOCX/OCR parsing beyond the current text/markdown processing boundary
- [ ] 2.3 Implement production queue/scheduler runtime entrypoints for ingestion, indexing, and sync
- [ ] 2.4 Implement real external provider sync for Google Drive, Notion, Confluence, or similar sources
- [ ] 2.5 Implement real OAuth/credential handling for external providers
- [x] 2.6 Implement real embedding provider adapter integration
- [x] 2.7 Implement real vector database adapter integration
- [x] 2.8 Implement semantic retrieval/vector search public boundary
- [x] 2.9 Implement RAG answer generation or task/agent retrieval integration
- [x] 2.10 Implement agent knowledge assignment and access checks
- [x] 2.11 Wire Processing Status UI to live API/runtime state in its own scoped frontend issue
- [x] 2.12 Add opt-in local pgvector retrieval smoke test and docs
- [x] 2.13 Add upload-to-Task-chat local-demo RAG integration evidence

## 3. Remaining Verification and Handoff

- [x] 3.1 Add production-runtime tests for real storage/parser/provider/vector adapters when those integrations are implemented
- [x] 3.2 Add retrieval/search and agent-access tests when those features are implemented
- [x] 3.3 Add final local RAG demo script and readiness checklist
- [ ] 3.4 Run OpenSpec validation once the `openspec` CLI is available in the environment
