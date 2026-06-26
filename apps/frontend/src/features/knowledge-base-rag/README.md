# Knowledge Base / RAG Feature

Owner: Member 9

This folder owns the React frontend implementation for Knowledge Base / RAG
Management. The feature manages workspace knowledge sources before they are
used by RAG-enabled agents. It is not the final chatbot or answer-generation
UI.

## Current Status

The feature currently has a local PA5 prototype:

- `knowledge-base-rag-page.tsx`: base shell, local navigation, and placeholder
  views for Data Sources, Synchronization Scope, and Processing Status.
- `knowledge-base-rag-components.tsx`: shared presentational components such as
  status badges, metric cards, section cards, metadata lists, progress bars,
  empty states, and tabs.
- `knowledge-base-rag-view.ts`: local mock/view types.
- `knowledge-base-rag-mock-data.ts`: deterministic mock documents, upload
  candidates, ingestion jobs, external data sources, sync scope, and sync jobs.
- `knowledge-base-rag-documents.tsx`: Documents screen with mock document
  metrics and list rendering.
- `knowledge-base-rag-upload.tsx`: Upload Documents screen with mock candidate
  file validation display.
- `knowledge-base-rag-api-client.ts`: typed frontend API client for the
  workspace-scoped KB/RAG backend route family.
- Feature-prefixed CSS split by shell, shared components, Documents, and Upload
  screens.

Documents and Upload screens still use local mock data. Current local view
types are prototype presentation types, not public DTOs.

## Frontend Scope

- Document list viewing.
- Upload candidate review.
- Upload validation display.
- Processing and indexing status display.
- Data source placeholders.
- Synchronization scope placeholders.
- Manual sync status placeholders.
- Future agent knowledge permission controls after contracts exist.

## Architecture Alignment

Do not continue UI-only implementation for new KB/RAG flows until DB/API,
shared contract, and event foundation is defined. Existing mock views may stay
local until shared DTOs exist.

The frontend API client follows the Agent Management and Workflow Management
pattern:

- Typed fetch wrapper.
- Shared `ApiResponse` envelope parsing.
- Shared `ErrorCode` usage.
- Network error handling.
- Malformed response handling.
- Route methods that match the approved KB/RAG API matrix under
  `/api/workspaces/:workspaceId/knowledge/...`.
- Tests in `tests/component`.

## DTO Alignment

Future UI integration should align with shared DTOs such as:

- `KnowledgeDocumentDto`
- `UploadCandidateFileDto`
- `UploadValidationRequest`
- `UploadValidationResponse`
- `PrepareUploadRequest`
- `PrepareUploadResponse`
- `IngestionJobDto`
- `KnowledgeDataSourceDto`
- `SyncScopeNodeDto`
- `SyncJobDto`

Keep mock/view types module-local and avoid exporting them as cross-module
contracts. The next integration issue should map the existing Documents and
Upload screens to the shared DTOs through `knowledge-base-rag-api-client.ts`.

## Implementation Rules

- Keep code inside this feature folder unless explicitly requested.
- Do not modify Agent Management or other feature folders.
- Do not import backend, worker, database, Prisma, or private module files.
- Do not wire UI screens to API calls outside a scoped integration task.
- Do not add React Router for this feature unless a later app-shell issue
  explicitly requires route-based navigation.
- Follow existing frontend style: React components, feature-prefixed CSS
  classes, small files, and deterministic mock data for isolated prototype
  flows.
- Add component/API-client tests with future behavior changes.

## Out Of Scope For Architecture-Only Issues

- New UI screens.
- Runtime upload handling.
- Backend integration.
- Worker integration.
- Shared contract changes.
- Prisma schema or migration changes.
