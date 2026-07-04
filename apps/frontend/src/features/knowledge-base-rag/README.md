# Knowledge Base / RAG Feature

See
[`docs/knowledge-base-rag-local-demo.md`](../../../../../docs/knowledge-base-rag-local-demo.md)
for the local browser flow, Processing Status verification, sample document,
and current end-to-end limitations.

Owner: Member 9

This folder owns the React frontend implementation for Knowledge Base / RAG
Management. The feature manages workspace knowledge sources before they are
used by RAG-enabled agents. It is not the final chatbot or answer-generation
UI.

## Current Status

The feature currently has API-backed Documents, Upload, Data Sources,
Synchronization Scope, and Processing Status views, plus local mock fixtures
for isolated tests:

- `knowledge-base-rag-page.tsx`: base shell and local navigation.
- `knowledge-base-rag-data-sources.tsx`: Data Sources screen wired to
  `listDataSources` and safe connection intent `connectDataSource` calls.
- `knowledge-base-rag-sync-scope.tsx`: Synchronization Scope screen wired to
  `getSyncScope`, `updateSyncScope`, `requestManualSync`, and `listSyncJobs`.
- `knowledge-base-rag-components.tsx`: shared presentational components such as
  status badges, metric cards, section cards, metadata lists, progress bars,
  empty states, and tabs.
- `knowledge-base-rag-view.ts`: local mock/view types.
- `knowledge-base-rag-mock-data.ts`: deterministic mock documents, upload
  candidates, ingestion jobs, external data sources, sync scope, and sync jobs.
- `knowledge-base-rag-documents.tsx`: Documents screen wired to
  `listDocuments` through the typed KB/RAG API client.
- `knowledge-base-rag-upload.tsx`: Upload Documents screen wired to
  metadata validation and real file upload through the typed KB/RAG API client.
- `knowledge-base-rag-processing-status.tsx`: Processing Status screen backed
  by workspace-scoped ingestion jobs and document metadata from the typed API
  client.
- `knowledge-base-rag-api-client.ts`: typed frontend API client for the
  workspace-scoped KB/RAG backend route family, including
  `listAgentKnowledgeDocuments`, `assignAgentKnowledgeDocument`, and
  `revokeAgentKnowledgeDocument` for Agent Management.
- Feature-prefixed CSS split by shell, shared components, Documents, and Upload
  screens.

Documents, Upload, Data Sources, Synchronization Scope, and Processing Status
use the API client as their runtime source of truth. Processing Status fetches
on mount and workspace change, supports manual refresh, and renders safe
loading, empty, and unavailable states. Current local view types are
presentation types used to render shared DTOs and isolated test fixtures, not
public contracts.

## Frontend Scope

- Document list viewing.
- Upload candidate review.
- Upload validation display.
- Processing and indexing status display.
- API-backed data source connections.
- API-backed synchronization scope selections.
- API-backed manual sync status in Synchronization Scope.
- Agent document-grant API client methods consumed by Agent Management.

## Architecture Alignment

Do not add new UI-only KB/RAG flows without a scoped API/DTO/runtime boundary.
Existing mock views may stay local for isolated test use.

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

Runtime UI integration aligns with shared DTOs such as:

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
contracts. Runtime screens map shared DTOs through
`knowledge-base-rag-api-client.ts`.

## Implementation Rules

- Keep code inside this feature folder unless explicitly requested.
- Do not modify Agent Management or other feature folders.
- Do not import backend, worker, database, Prisma, or private module files.
- Do not wire UI screens to API calls outside a scoped integration task.
- Do not add React Router for this feature unless a future app-shell change
  explicitly requires route-based navigation.
- Follow existing frontend style: React components, feature-prefixed CSS
  classes, small files, and deterministic mock data for isolated UI flows.
- Add component/API-client tests with future behavior changes.

## Out Of Scope For Cleanup/Boundary Issues

- New UI screens.
- Runtime upload handling.
- New backend routes.
- Production worker/runtime integration.
- Shared contract changes.
- Prisma schema or migration changes.

## Functional Test Cases

| Test Case ID | Screen / Feature | Objective | Preconditions | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| KB-RAG-FT-001 | Base layout and navigation | Confirm the module opens inside the existing platform shell. | App is running and user can navigate to Knowledge Base / RAG Management. | Open the module from the platform navigation. | The page header shows Workspace Knowledge and Knowledge Base / RAG Management. | Pending manual verification | Verify with browser before final demo submission. |
| KB-RAG-FT-002 | Base layout and navigation | Confirm the global platform sidebar is the only vertical sidebar. | Module page is open. | Inspect the page layout. | No nested Knowledge Base vertical sidebar or K / Knowledge Base / Manager block is shown. | Pending manual verification | The module uses horizontal internal tabs. |
| KB-RAG-FT-003 | Base layout and navigation | Confirm internal navigation is clear and complete. | Module page is open. | Review the horizontal tabs and switch through Documents, Upload Documents, Data Sources, Synchronization Scope, and Processing Status. | Each tab renders its screen and the active tab state is visually clear. | Pending manual verification | State remains local to the page. |
| KB-RAG-FT-004 | Base layout and navigation | Confirm internal engineering wording is absent from visible UI. | Module page is open. | Review visible text across all tabs. | Visible UI does not show internal planning wording such as internal tracking labels or incomplete-work labels. | Pending manual verification | Also checked by source text search during this documentation pass. |
| KB-RAG-FT-005 | Documents | Confirm the Documents tab renders useful document state. | Backend API may be available or unavailable. | Open Documents. | Summary metrics and workspace document section render, with loading, error, or empty state as appropriate. | Pending manual verification | Automated coverage exists for Documents API integration. |
| KB-RAG-FT-006 | Documents | Confirm API unavailable state is user-facing. | Backend API is unavailable or mocked to fail. | Open Documents and observe error state. | User sees Unable to load documents and a Retry action where applicable. | Pending manual verification | No private API details should be shown. |
| KB-RAG-FT-007 | Documents | Confirm unsafe/internal fields are not visible. | Documents list is loaded or error state is shown. | Inspect visible document cards and metadata. | Storage keys, private URLs, raw embeddings, vector refs, queue payloads, credentials, secrets, and tokens are not displayed. | Pending manual verification | Public DTO mapping only exposes safe document fields. |
| KB-RAG-FT-008 | Upload Documents | Confirm Upload Documents tab renders. | Module page is open. | Open Upload Documents. | File selection area, upload validation metrics, selected files section, and preparation action render. | Pending manual verification | Automated coverage exists for Upload API integration. |
| KB-RAG-FT-009 | Upload Documents | Confirm selected file cards remain neutral and readable. | A local file selection or mocked candidate file exists. | Select files or use a test harness that provides candidate files. | Selected file cards use white background, neutral border, no colored left accent stripe, and retain file type/status badges. | Pending manual verification | This is a visual QA check. |
| KB-RAG-FT-010 | Upload Documents | Confirm validation messaging stays safe. | File candidates are selected. | Review each selected file card. | File type badge, validation status badge, review status, size, and safe validation message are visible. | Pending manual verification | Actions should not imply production storage when API is unavailable. |
| KB-RAG-FT-011 | Data Sources | Confirm Data Sources tab renders source state. | Backend API may be available or unavailable. | Open Data Sources. | Metrics, external data sources section, loading/error/empty state, and Retry action where applicable render clearly. | Pending manual verification | Automated coverage exists for Data Sources API integration. |
| KB-RAG-FT-012 | Data Sources | Confirm source actions avoid private provider data. | Data Sources tab is loaded. | Inspect source cards and connect action. | OAuth credentials, tokens, secrets, refresh tokens, and raw provider payloads are not visible. | Pending manual verification | Connect action records safe connection intent only. |
| KB-RAG-FT-013 | Data Sources | Confirm the screen does not overclaim provider runtime. | Data Sources tab is loaded. | Review copy around source connection and sync state. | Copy describes safe source connection and sync status without claiming real provider sync execution when runtime is unavailable. | Pending manual verification | Runtime availability is environment-dependent. |
| KB-RAG-FT-014 | Synchronization Scope | Confirm Synchronization Scope tab renders. | Backend API may be available or unavailable. | Open Synchronization Scope. | Metrics, scope tree or loading/error/empty state, Save selection, and Request manual sync actions render when applicable. | Pending manual verification | Automated coverage exists for Sync Scope API integration. |
| KB-RAG-FT-015 | Synchronization Scope | Confirm sync job list is safe. | Sync jobs are available. | Inspect sync job list. | Job rows show safe status and counts without queue/runtime internals. | Pending manual verification | Duplicate key warning is expected to remain fixed by the jobId-requestedAt-index key. |
| KB-RAG-FT-016 | Processing Status | Confirm Processing Status tab renders job summary. | Module page is open and the backend is available. | Open Processing Status. | Total, queued, processing, completed, and failed metrics reflect workspace ingestion jobs. | Pending manual verification | Screen reads ingestion jobs and document metadata through the typed API client. |
| KB-RAG-FT-017 | Processing Status | Confirm all job states are represented. | Processing Status tab is open. | Inspect processing job cards. | Pending, ingesting, ready, and failed backend states render as Queued, Processing, Completed, and Failed. | Pending manual verification | Backend lifecycle mapping is covered by component tests. |
| KB-RAG-FT-018 | Processing Status | Confirm progress bars are readable and status-aware. | Processing Status tab is open. | Inspect each job progress bar. | Bars use a standard track/fill layout; queued is neutral gray, processing is primary purple/blue, completed is green, and failed is red/orange. | Pending manual verification | Visual QA check. |
| KB-RAG-FT-019 | Processing Status | Confirm safe failure, detail, and refresh behavior. | Processing Status tab is open. | Select View details, inspect failed job text, and select Refresh status. | Detail panel updates locally, failed jobs show bounded safe messages, and refresh reloads workspace job state. | Pending manual verification | Retry failed job remains disabled/presentational because retry runtime is out of scope. |

## Defect Report

Severity definitions:

- Critical: App crash, data loss, or feature completely unusable.
- High: Main user flow blocked.
- Medium: Important UI/functional issue with a workaround.
- Low: Minor copy, spacing, polish, or cosmetic issue.

Priority definitions:

- P0: Must fix immediately.
- P1: Should fix before demo/release.
- P2: Can fix after demo if time allows.
- P3: Nice-to-have polish.

| Defect ID | Title | Screen / Feature | Severity | Priority | Status | Notes / Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| KB-RAG-DEF-001 | No verified open defects recorded | All KB/RAG screens | N/A | N/A | Informational | No verified open defects are recorded for this documentation pass. Manual QA should still be executed before final demo submission. |

Environment/runtime limitations recorded as non-defect notes:

- Documents, Upload validation, Data Sources, and Synchronization Scope may show API loading/error states when the backend API is not running. This is an environment/runtime availability condition, not necessarily a UI defect.
- OCR and live external-provider synchronization execution remain outside this
  frontend status integration. Synchronization status continues through the
  separate Synchronization Scope API flow and is not merged into Processing
  Status.

Resolved / previously addressed:

- Nested Knowledge Base sidebar replaced with horizontal tabs.
- Upload selected-file colored left stripe removed.
- Processing Status progress bar redesigned.
- Sync Scope duplicate key warning fixed.

## Test Summary

Scope:

- Knowledge Base / RAG Management frontend UI, local navigation, and API-backed runtime screens including Processing Status.

Screens covered:

- Documents
- Upload Documents
- Data Sources
- Synchronization Scope
- Processing Status

Automated validation evidence:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed in this documentation pass. |
| `npm run build` | Passed in this documentation pass. |
| `npx vitest run --config vitest.config.ts tests/component/knowledge-base-rag-data-sources-api-integration.test.tsx tests/component/knowledge-base-rag-sync-scope-api-integration.test.tsx tests/component/knowledge-base-rag-documents-api-integration.test.tsx tests/component/knowledge-base-rag-upload-api-integration.test.tsx tests/component/knowledge-base-rag-api-client.test.ts` | Passed in this documentation pass: 5 files, 21 tests. |
| `npm test` | Passed in this documentation pass. |

Manual verification status:

- Pending manual verification. The functional test cases above should be executed in a browser before final demo submission.

Manual verification checklist:

- Open the app locally.
- Navigate to Knowledge Base / RAG Management.
- Confirm horizontal tabs are visible.
- Confirm no nested Knowledge Base sidebar appears.
- Check Documents.
- Check Upload Documents.
- Check Data Sources.
- Check Synchronization Scope.
- Check Processing Status.
- Confirm Upload selected-file cards have no colored left stripe.
- Confirm Processing Status progress bars look standard.
- Confirm no internal planning or incomplete-work wording appears in visible UI.
- Confirm no unsafe fields are visible.

Known limitations:

- Processing Status uses workspace-scoped ingestion jobs and document metadata;
  deterministic mock jobs remain test fixtures only.
- Processing Status refresh is manual. Polling, WebSocket, and event-stream
  updates are deferred.
- Data-source connection and manual sync screens display safe API-backed intent/status; production provider/runtime execution is outside this frontend UI scope.
- API-backed screens may display loading or error states when the backend API is unavailable.
- Upload Documents sends selected supported files to the KB/RAG upload runtime,
  which stores bytes server-side and returns only safe document/job DTOs. Local
  servers configured with `KNOWLEDGE_INGESTION_MODE=inline` return final
  ready/failed state after the existing ingestion/indexing flow completes.
- Processing Status remains refresh-based and displays the persisted final job
  state; no polling or worker daemon is added.

Recommendation:

- Accept the frontend UI evidence for demo readiness after completing browser manual verification and confirming the runtime environment expected for the demo.
