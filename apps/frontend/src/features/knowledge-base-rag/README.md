# Knowledge Base / RAG Feature

See
[`docs/knowledge-base-rag-local-demo.md`](../../../../../docs/knowledge-base-rag-local-demo.md)
for the local browser flow, Processing Status verification, sample document,
and current end-to-end limitations.
Use
[`docs/demo/kb-rag/final-local-rag-demo-script.md`](../../../../../docs/demo/kb-rag/final-local-rag-demo-script.md)
for the final upload-to-Task-chat demo checklist.

Owner: Member 9

This folder owns the React frontend implementation for Knowledge Base / RAG
Management. The feature manages workspace knowledge sources before they are
used by RAG-enabled agents. It is not the final chatbot or answer-generation
UI.

## Current Status

The feature currently has API-backed Documents, Upload Documents, Data Sync, and
Processing Status views, plus local mock fixtures
for isolated tests:

Document upload, Google Drive scoped automatic sync, chunking, embedding,
vector indexing, semantic retrieval, and agent citation-based answers are
implemented. Data Sync checks only selected Drive files and folders through
opt-in scheduled polling; it does not provide real-time, webhook, or whole-Drive
synchronization.

- `knowledge-base-rag-page.tsx`: base shell and local navigation.
- `knowledge-base-rag-data-sources.tsx`: Google Drive connection section wired
  to safe OAuth connect/disconnect calls.
- `knowledge-base-rag-sync-scope.tsx`: Drive content, schedule settings, and
  sync actions used by the combined Data Sync view. Draft Drive previews are
  debounced and non-persistent until Save scope is confirmed.
- `knowledge-base-rag-components.tsx`: shared presentational components such as
  status badges, summary cards, section cards, metadata lists, progress bars,
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

Documents, Upload Documents, Data Sync, and Processing Status
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
- API-backed Google Drive connection and scoped synchronization in Data Sync.
- Bounded Google Drive file/folder tree preview with persisted hierarchical
  selection; raw Drive IDs remain hidden from normal UI.
- Detailed manual and automatic sync status in Processing Status only.
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
| KB-RAG-FT-001 | Base layout and navigation | Confirm the module opens inside the existing platform shell. | App is running and user can navigate to Knowledge Base. | Open the module from the platform navigation. | The page header shows Knowledge Base with a user-facing description of documents and agent knowledge. | Pending manual verification | Verify with browser before final demo submission. |
| KB-RAG-FT-002 | Base layout and navigation | Confirm the global platform sidebar is the only vertical sidebar. | Module page is open. | Inspect the page layout. | No nested Knowledge Base vertical sidebar or K / Knowledge Base / Manager block is shown. | Pending manual verification | The module uses horizontal internal tabs. |
| KB-RAG-FT-003 | Base layout and navigation | Confirm internal navigation is clear and complete. | Module page is open. | Review the horizontal tabs and switch through Documents, Upload Documents, Data Sync, and Processing Status. | Each tab renders its screen and the active tab state is visually clear. | Pending manual verification | Data Sync combines connection and selected-content configuration. |
| KB-RAG-FT-004 | Base layout and navigation | Confirm internal engineering wording is absent from visible UI. | Module page is open. | Review visible text across all tabs. | Visible UI does not show internal planning wording such as internal tracking labels or incomplete-work labels. | Pending manual verification | Also checked by source text search during this documentation pass. |
| KB-RAG-FT-005 | Documents | Confirm the Documents tab renders useful document state. | Backend API may be available or unavailable. | Open Documents. | Summary metrics and workspace document section render, with loading, error, or empty state as appropriate. | Pending manual verification | Automated coverage exists for Documents API integration. |
| KB-RAG-FT-006 | Documents | Confirm API unavailable state is user-facing. | Backend API is unavailable or mocked to fail. | Open Documents and observe error state. | User sees Unable to load documents and a Retry action where applicable. | Pending manual verification | No private API details should be shown. |
| KB-RAG-FT-007 | Documents | Confirm unsafe/internal fields are not visible. | Documents list is loaded or error state is shown. | Inspect visible document cards and metadata. | Storage keys, private URLs, raw embeddings, vector refs, queue payloads, credentials, secrets, and tokens are not displayed. | Pending manual verification | Public DTO mapping only exposes safe document fields. |
| KB-RAG-FT-008 | Upload Documents | Confirm supported manual upload formats render. | Module page is open. | Open Upload Documents. | File selection area lists PDF, DOCX, TXT, CSV, and Markdown; selected files, validation, and upload actions render without redundant empty counters. | Pending manual verification | Automated coverage exists for Upload API integration. |
| KB-RAG-FT-009 | Upload Documents | Confirm selected file cards remain neutral and readable. | A local file selection or mocked candidate file exists. | Select files or use a test harness that provides candidate files. | Selected file cards use white background, neutral border, no colored left accent stripe, and retain file type/status badges. | Pending manual verification | This is a visual QA check. |
| KB-RAG-FT-010 | Upload Documents | Confirm validation messaging stays safe. | File candidates are selected. | Review each selected file card. | File type badge, validation status badge, review status, size, and safe validation message are visible. | Pending manual verification | Actions should not imply production storage when API is unavailable. |
| KB-RAG-FT-011 | Data Sync | Confirm Data Sync renders Google Drive connection state. | Backend API may be available or unavailable. | Open Data Sync. | The single Google Drive connection card and loading/error/empty state render without multi-source counters. | Pending manual verification | Automated coverage exists for Google Drive connection API integration. |
| KB-RAG-FT-012 | Data Sync | Confirm source actions avoid private provider data. | Data Sync is loaded. | Inspect connection and scope sections. | OAuth credentials, tokens, secrets, refresh tokens, raw provider payloads, and technical IDs are not visible. | Pending manual verification | Connect action records safe connection intent only. |
| KB-RAG-FT-013 | Data Sync | Confirm the screen does not overclaim provider runtime. | Data Sync is loaded. | Review copy around connection and sync state. | Copy describes scoped manual/hourly/daily sync without claiming real-time, whole-Drive, or another provider. | Pending manual verification | Runtime availability is environment-dependent. |
| KB-RAG-FT-014 | Data Sync | Confirm scoped sync configuration renders. | Backend API may be available or unavailable. | Paste a Drive URL/ID, review the draft tree, save selected items, then clear the input. | Draft preview appears only for current input; Save scope persists the confirmed selection; the input clears; Sync now and Auto Sync use persisted scope; the selected count appears on the Google Drive card only. | Pending manual verification | Automated coverage exists for Google Drive scope API integration. |
| KB-RAG-FT-015 | Processing Status | Confirm sync jobs have one status home. | Sync jobs are available. | Open Processing Status and select View details. | Main external sync cards remain concise; detailed counters and safe failure reasons appear in View details without raw job IDs. | Pending manual verification | Data Sync does not duplicate sync history. |
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

- Documents, Upload validation, and Data Sync may show API loading/error states
  when the backend API is not running.
- OCR remains outside this frontend integration. Processing Status is the
  single user-facing home for document and Google Drive sync jobs.

Resolved / previously addressed:

- Nested Knowledge Base sidebar replaced with horizontal tabs.
- Upload selected-file colored left stripe removed.
- Processing Status progress bar redesigned.
- Data Sync tree duplicate key warning fixed.

## Test Summary

Scope:

- Knowledge Base / RAG Management frontend UI, local navigation, and API-backed runtime screens including Processing Status.

Screens covered:

- Documents
- Upload Documents
- Data Sync
- Processing Status

Automated validation evidence:

| Command | Result |
| --- | --- |
| `git diff --check` | Required for every documentation change. |
| `npm run build` | Required when frontend runtime code changes; not required for wording-only changes. |
| Focused KB/RAG component tests | Required when component behavior changes; documentation-only changes do not alter their result. |
| `npm test` | Repository-wide gate; do not report it as passed unless it was executed successfully for the current revision. |

Manual verification status:

- Pending manual verification. The functional test cases above should be executed in a browser before final demo submission.

Manual verification checklist:

- Open the app locally.
- Navigate to Knowledge Base / RAG Management.
- Confirm horizontal tabs are visible.
- Confirm no nested Knowledge Base sidebar appears.
- Check Documents.
- Check Upload Documents.
- Check Data Sync connection, URL/ID input, draft preview, selected count, and
  schedule settings.
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
- Data Sync supports Google Drive only. Manual and opt-in scheduled sync use
  the persisted selected scope; Notion and Confluence are future extensions.
- API-backed screens may display loading or error states when the backend API is unavailable.
- Upload Documents sends selected supported files to the KB/RAG upload runtime,
  which stores bytes server-side and returns only safe document/job DTOs. Local
  servers configured with `KNOWLEDGE_INGESTION_MODE=inline` return final
  ready/failed state after the existing ingestion/indexing flow completes.
- Processing Status remains refresh-based and displays the persisted final job
  state; no polling or worker daemon is added.
- Google Picker, Drive Changes API/push notifications, OCR for scanned PDFs,
  legacy `.doc`, and a separately deployed autoscaled worker remain deferred.

Recommendation:

- Accept the frontend UI evidence for demo readiness after completing browser manual verification and confirming the runtime environment expected for the demo.
