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
- [x] 2.2 Complete supported document parsing beyond text/markdown for PDF and DOCX; legacy DOC and OCR are explicitly deferred
- [x] 2.3 Implement local worker entrypoint, process-local async queue, and opt-in scheduled polling for ingestion/indexing/sync
- [x] 2.4 Implement real external provider sync for Google Drive only
- [x] 2.5 Implement real OAuth/credential handling for Google Drive only
- [x] 2.6 Implement real embedding provider adapter integration
- [x] 2.7 Implement real vector database adapter integration
- [x] 2.8 Implement semantic retrieval/vector search public boundary
- [x] 2.9 Implement RAG answer generation or task/agent retrieval integration
- [x] 2.10 Implement agent knowledge assignment and access checks
- [x] 2.11 Wire Processing Status UI to live API/runtime state in its own scoped frontend issue
- [x] 2.12 Add opt-in local pgvector retrieval smoke test and docs
- [x] 2.13 Add upload-to-Task-chat local-demo RAG integration evidence
- [x] 2.14 Polish Knowledge Base navigation, agent/workflow labels, citation presentation, assigned-document UX, and workflow completion fallback without changing retrieval or runtime behavior
- [x] 2.15 Add safe Processing Status details/retry presentation and compact Workflow Run History identifiers without adding runtime APIs
- [x] 2.16 Add opt-in Google Drive automatic scoped polling, hourly/daily settings, URL/ID normalization, and focused UI/runtime tests
- [x] 2.17 Consolidate Google Drive configuration into Data Sync, hide normal-user technical IDs, add actionable provider errors, and support explicit local-demo read-only OAuth
- [x] 2.18 Simplify Upload status, make Google Drive OAuth feedback transient, and move external sync counters into user-facing details
- [x] 2.19 Separate new and saved Drive scope input, hide external IDs, and align Upload/Drive processing details
- [x] 2.20 Materialize a bounded Google Drive scope tree, persist hierarchical selection, and make sync consume only selected nodes
- [x] 2.21 Implement durable multi-instance production queue/lease for ingestion/indexing/sync jobs
- [x] 2.22 Add non-persistent Google Drive draft preview and separate it from saved sync scope

## 3. Remaining Verification and Handoff

- [x] 3.1 Add production-runtime tests for real storage/parser/provider/vector adapters when those integrations are implemented
- [x] 3.2 Add retrieval/search and agent-access tests when those features are implemented
- [x] 3.3 Add final local RAG demo script and readiness checklist
- [ ] 3.4 Run OpenSpec validation once the `openspec` CLI is available in the environment
