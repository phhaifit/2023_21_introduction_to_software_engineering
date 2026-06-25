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
- Feature-prefixed CSS split by shell, shared components, Documents, and Upload
  screens.

There is no KB/RAG frontend API client yet. Current local types are prototype
view types, not public DTOs.

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

When backend contracts exist, add a frontend API client that follows the Agent
Management and Workflow Management pattern:

- Typed fetch wrapper.
- Shared `ApiResponse` envelope parsing.
- Shared `ErrorCode` usage.
- Network error handling.
- Malformed response handling.
- Route methods that match the approved KB/RAG API matrix.
- Tests in `tests/component`.

## DTO Alignment

Future UI should align with shared DTOs such as:

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

Until those DTOs exist, keep mock types module-local and avoid exporting them as
cross-module contracts.

## Implementation Rules

- Keep code inside this feature folder unless explicitly requested.
- Do not modify Agent Management or other feature folders.
- Do not import backend, worker, database, Prisma, or private module files.
- Do not add API calls until the backend route and shared DTO contract are
  defined or explicitly mocked for a scoped task.
- Do not add React Router for this feature unless a later app-shell issue
  explicitly requires route-based navigation.
- Follow existing frontend style: React components, feature-prefixed CSS
  classes, small files, and deterministic mock data for isolated prototype
  flows.
- Add component/API-client tests with future behavior changes.

## Out Of Scope For Architecture-Only Issues

- New UI screens.
- Frontend API client.
- Runtime upload handling.
- Backend integration.
- Worker integration.
- Shared contract changes.
- Prisma schema or migration changes.
