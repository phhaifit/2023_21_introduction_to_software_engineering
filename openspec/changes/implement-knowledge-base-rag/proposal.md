## Why

Agents need workspace-specific company knowledge to answer and act with the right business context. This change defines document management, ingestion, vector storage, and access control for RAG.

## What Changes

- Add document upload for PDF, Word, TXT, CSV, and similar internal files.
- Add a real Google Drive OAuth and scoped synchronization slice as the only
  external data source currently supported.
- Add document ingestion and vectorization through a worker job.
- Store searchable chunks in a vector database through an adapter boundary.
- Add knowledge access assignment to specific agents.
- Add PDF and DOCX text extraction while explicitly deferring OCR, legacy DOC,
  Google Picker, Drive push notifications, and a durable distributed queue.
- Add opt-in hourly/daily Google Drive scheduled polling that reuses the
  existing sync and ingestion pipeline.

## Capabilities

### New Capabilities
- `knowledge-base-rag`: Workspace document management, external data source sync, ingestion, vectorization, vector search boundary, and agent knowledge access control.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `apps/backend/src/modules/knowledge-base-rag`
- Frontend feature: `apps/frontend/src/features/knowledge-base-rag`
- Worker job: `apps/workers/src/jobs/document-ingestion`
- Persistence boundary: PostgreSQL pgvector adapter and embedding adapter
- Related modules: agents and task orchestration retrieve knowledge through public RAG contracts
