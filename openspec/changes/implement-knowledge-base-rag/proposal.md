## Why

Agents need workspace-specific company knowledge to answer and act with the right business context. This change defines document management, ingestion, vector storage, and access control for RAG.

## What Changes

- Add document upload for PDF, Word, TXT, CSV, and similar internal files.
- Add data source sync placeholders for Google Drive, Notion, and Confluence.
- Add document ingestion and vectorization through a worker job.
- Store searchable chunks in a vector database through an adapter boundary.
- Add knowledge access assignment to specific agents.

## Capabilities

### New Capabilities
- `knowledge-base-rag`: Workspace document management, external data source sync, ingestion, vectorization, vector search boundary, and agent knowledge access control.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `backend/src/modules/knowledge-base-rag`
- Frontend feature: `frontend/src/features/knowledge-base-rag`
- Worker job: `workers/src/jobs/document-ingestion`
- External boundary: Qdrant/vector database adapter and embedding adapter
- Related modules: agents and task orchestration retrieve knowledge through public RAG contracts
