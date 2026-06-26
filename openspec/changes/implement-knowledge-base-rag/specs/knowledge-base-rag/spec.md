## ADDED Requirements

### Requirement: Document Upload
The system SHALL allow authorized users to upload workspace knowledge documents.

#### Scenario: Document uploaded
- **WHEN** an authorized user uploads a supported document file
- **THEN** the system stores document metadata, marks it pending ingestion, and enqueues a document ingestion job

#### Scenario: Unsupported document rejected
- **WHEN** a user uploads an unsupported file type
- **THEN** the system rejects the upload with a validation error response

### Requirement: Public API and DTO Boundary
The system SHALL define workspace-scoped Knowledge Base / RAG public API and DTO contracts before runtime handlers are implemented.

#### Scenario: Workspace-scoped API route boundary selected
- **WHEN** public KB/RAG routes are documented or implemented
- **THEN** they use `/api/workspaces/:workspaceId/knowledge/...`
- **AND** request bodies do not accept trusted context such as `workspaceId`, actor/user identity, generated IDs, lifecycle status, timestamps, private storage paths, raw credentials, vector database internals, embedding payloads, or queue internals

#### Scenario: Shared DTO boundary is caller-safe
- **WHEN** frontend, backend, worker, or future module code crosses the KB/RAG boundary
- **THEN** it uses shared caller-safe DTOs for documents, chunks, upload validation, prepare upload responses, ingestion jobs, data sources, sync scope nodes, sync jobs, and API errors
- **AND** those DTOs expose public IDs, names, statuses, timestamps, safe counts, and safe error summaries only

#### Scenario: Public domain events are granular and compatible
- **WHEN** KB/RAG publishes document ingestion, data source, or sync lifecycle events
- **THEN** the events use shared namespaced event contracts with `eventId`, `eventType`, `workspaceId`, relevant document/source/job IDs, `occurredAt`, public status, actor ID when user-triggered, and safe failure fields when relevant
- **AND** existing legacy event names remain available until a reviewed compatibility migration removes them

### Requirement: Persistence Ownership Boundary
The system SHALL define KB/RAG-owned persistence models before backend repositories, API handlers, or worker handlers are implemented.

#### Scenario: KB/RAG-owned tables are available
- **WHEN** the Prisma schema is inspected
- **THEN** KB/RAG owns document metadata, document chunks, ingestion jobs, knowledge indexes, knowledge access grants, external data sources, sync scope nodes, sync jobs, and sync job events
- **AND** workspace-scoped KB/RAG records include `workspaceId`
- **AND** lookup paths for workspace, status, parent document/source/job IDs, and actor IDs are indexed where applicable

#### Scenario: Existing skeleton models are extended instead of duplicated
- **WHEN** the DB schema is evolved for KB/RAG
- **THEN** the existing `Document`, `KnowledgeIndex`, and `KnowledgeAccessGrant` skeleton models remain available
- **AND** `Document` is extended as the KB/RAG document table rather than creating a duplicate `KnowledgeDocument` table
- **AND** KB/RAG-specific job details are stored in explicit KB/RAG-owned job tables rather than mutating the generic `Job` table

#### Scenario: Internal KB/RAG relationships use database integrity
- **WHEN** KB/RAG persistence records reference other KB/RAG-owned records
- **THEN** the Prisma schema defines internal relations and migration foreign keys for document chunks, ingestion jobs, knowledge indexes, access grants, sync scope nodes, sync jobs, and sync job events
- **AND** those internal foreign keys use restrictive delete behavior rather than cascading deletion
- **AND** KB/RAG tables do not add foreign keys to users, workspaces, agents, workflows, tasks, subscriptions, authentication, or session tables

#### Scenario: Sensitive infrastructure data is excluded
- **WHEN** KB/RAG persistence records are stored
- **THEN** the schema does not store raw credentials, OAuth refresh tokens, provider secrets, passwords, public or private object-storage URLs, raw embedding vectors, raw vector DB configuration, queue internals, or provider private payloads
- **AND** cross-module references remain scalar public IDs unless a later OpenSpec-backed design explicitly introduces a relation

### Requirement: Backend Repository and Application Boundary
The system SHALL define internal KB/RAG backend domain, application, and infrastructure boundaries before worker handlers, frontend API clients, or adapter runtimes are implemented.

#### Scenario: Backend module layers exist
- **WHEN** the KB/RAG backend module is inspected
- **THEN** it contains separate `api`, `application`, `domain`, and `infrastructure` boundaries
- **AND** domain and application code do not depend on HTTP routers, Prisma records, frontend code, worker runtime, or another module's private internals

#### Scenario: Repository ports are workspace-scoped
- **WHEN** future API handlers or workers need documents, chunks, ingestion jobs, data sources, sync scope nodes, sync jobs, or sync job events
- **THEN** they use KB/RAG application repository ports with explicit `workspaceId` scoping
- **AND** they do not import Prisma records or another module's private repositories directly

#### Scenario: Infrastructure adapters preserve module boundaries
- **WHEN** Prisma or in-memory persistence adapters are used
- **THEN** Prisma records are mapped to internal domain models before leaving infrastructure
- **AND** public DTO mappers exclude storage keys, content hashes, vector references, safe metadata, credentials, secrets, tokens, passwords, raw embeddings, vector configuration, private URLs, and queue payloads
- **AND** Prisma repositories query only KB/RAG-owned persistence models

### Requirement: Backend HTTP API Router
The system SHALL expose KB/RAG application use cases through workspace-scoped backend HTTP routes using shared DTO and API response contracts.

#### Scenario: Workspace-scoped route family is exposed
- **WHEN** a backend client calls KB/RAG HTTP routes
- **THEN** the router exposes only `/api/workspaces/:workspaceId/knowledge/...` routes for documents, upload validation, upload preparation, ingestion jobs, data sources, sync scope, and sync jobs
- **AND** it does not expose the older `/api/knowledge-base/...` candidate route family

#### Scenario: Router remains a thin application adapter
- **WHEN** a KB/RAG HTTP route handles a request
- **THEN** it parses route/query/body input, derives `workspaceId` from the path, derives actor identity from request context, calls application use cases, and returns shared `ApiResponse` or `ApiPaginatedSuccess` envelopes
- **AND** it does not import Prisma, call repositories directly, parse files, upload to object storage, call embedding providers, write vectors, run worker handlers, or call external source providers

#### Scenario: Request bodies reject trusted or private fields
- **WHEN** callers submit KB/RAG request bodies
- **THEN** the router rejects server-owned or private fields such as `workspaceId`, actor/user IDs, generated IDs, lifecycle statuses, timestamps, storage keys, vector references, queue payloads, credentials, provider secrets, tokens, passwords, raw embeddings, or vector configuration
- **AND** data-source connection placeholders do not accept raw credentials, OAuth refresh tokens, provider tokens, or secrets

### Requirement: Frontend API Client Boundary
The system SHALL provide a typed frontend KB/RAG API client before existing UI screens are wired to live backend data.

#### Scenario: Client calls finalized workspace-scoped routes
- **WHEN** frontend code calls the KB/RAG API client
- **THEN** the client builds only `/api/workspaces/:workspaceId/knowledge/...` URLs for documents, upload validation, upload preparation, ingestion jobs, data sources, sync scope, and sync jobs
- **AND** it encodes `workspaceId`, `sourceId`, and query values safely
- **AND** it does not call the older `/api/knowledge-base/...` candidate route family

#### Scenario: Client parses shared API envelopes
- **WHEN** the backend returns a KB/RAG API response
- **THEN** the client parses shared success and paginated success envelopes into shared DTOs
- **AND** API, network, and malformed-response failures are exposed through a typed frontend client error

#### Scenario: Client rejects unsafe frontend request payloads
- **WHEN** the frontend API client boundary is added
- **THEN** the client rejects unsafe request-body fields such as `workspaceId`, actor/user IDs, generated IDs, lifecycle statuses, timestamps, storage keys, vector references, queue payloads, credentials, tokens, passwords, raw embeddings, or vector configuration before fetch
- **AND** frontend code does not import backend modules, worker runtime, Prisma/database code, or another module's private internals

#### Scenario: Documents and Upload screens use the API client
- **WHEN** the Documents screen is opened
- **THEN** it loads workspace documents through `listDocuments(workspaceId)` and renders shared document DTO data with loading, error, and empty states
- **WHEN** files are selected in the Upload Documents screen
- **THEN** the screen sends metadata-only upload candidates through `validateUploadCandidates(workspaceId, request)`
- **AND** it calls `prepareUpload(workspaceId, request)` only for validation-accepted candidates
- **AND** it does not send raw file bytes, `workspaceId` in the request body, actor/user IDs, generated IDs, lifecycle status, timestamps, storage keys, vector refs, queue payloads, credentials, secrets, tokens, passwords, raw embeddings, or vector configuration
- **AND** this integration does not wire Data Sources, Synchronization Scope, Processing Status, worker runtime, object storage, file parsing, embedding providers, or vector databases

#### Scenario: Data Sources and Sync Scope screens use the API client
- **WHEN** the Data Sources screen is opened
- **THEN** it loads external source placeholders through `listDataSources(workspaceId)` and renders shared data-source DTO data with loading, error, and empty states
- **AND** connection actions call `connectDataSource(workspaceId, sourceId)` as a safe placeholder without raw credentials, OAuth tokens, refresh tokens, provider secrets, passwords, or private provider payloads
- **WHEN** the Synchronization Scope screen is opened
- **THEN** it loads scope nodes through `getSyncScope(workspaceId)` and sync job status through `listSyncJobs(workspaceId)`
- **AND** saving selected scope nodes calls `updateSyncScope(workspaceId, request)` with only selected public scope node IDs
- **AND** requesting manual sync calls `requestManualSync(workspaceId, request)` as queued sync intent only
- **AND** request bodies do not include `workspaceId`, actor/user IDs, generated IDs, lifecycle status controlled by the server, timestamps, storage keys, vector refs, queue payloads, credentials, secrets, tokens, refresh tokens, passwords, raw provider payloads, raw embeddings, or vector configuration
- **AND** this integration does not wire Processing Status, worker runtime, external provider/OAuth runtime, object storage, file parsing, embedding providers, or vector databases

### Requirement: Application Use Cases
The system SHALL provide KB/RAG application use cases that future API routers and workers can call without importing repositories or infrastructure directly.

#### Scenario: Metadata-only upload validation
- **WHEN** upload candidates are validated
- **THEN** the use case validates only caller-provided metadata such as file name, media type, and size
- **AND** it does not parse files, upload files, create document rows, create ingestion jobs, call workers, call embedding providers, or write vectors

#### Scenario: Safe upload preparation
- **WHEN** valid upload candidates are prepared
- **THEN** the use case creates pending document metadata and pending ingestion-job records through repository ports
- **AND** it returns `PrepareUploadResponse` DTOs without storage keys, private URLs, queue payloads, raw embeddings, vector references, credentials, tokens, or secrets

#### Scenario: Placeholder source and sync use cases
- **WHEN** data-source connection, sync-scope update, or manual sync request use cases are called
- **THEN** they operate on workspace-scoped repository ports
- **AND** manual sync creates only a queued sync-job record without calling external providers or worker runtime handlers
- **AND** data-source placeholder connection does not accept or store raw credentials, provider secrets, OAuth tokens, or refresh tokens

### Requirement: Data Source Sync Placeholder
The system SHALL provide a configurable boundary for external knowledge sources.

#### Scenario: Data source configured
- **WHEN** an authorized user configures a supported or placeholder data source
- **THEN** the system stores the source configuration without exposing raw credentials

### Requirement: Document Ingestion and Vectorization
The system SHALL process documents into searchable vector chunks asynchronously.

#### Scenario: Ingestion succeeds
- **WHEN** the document ingestion worker parses, chunks, embeds, and stores a document
- **THEN** the system marks the document indexed and records vector metadata

#### Scenario: Ingestion fails
- **WHEN** ingestion cannot parse or vectorize a document
- **THEN** the system marks the document failed and stores a safe error summary

### Requirement: Knowledge Retrieval Boundary
The system SHALL retrieve relevant knowledge through a vector database adapter.

#### Scenario: Knowledge searched
- **WHEN** an authorized runtime request searches workspace knowledge
- **THEN** the system queries the vector adapter and returns relevant document chunks through a public contract

### Requirement: Agent Knowledge Access
The system SHALL allow authorized users to assign knowledge collections or documents to specific agents.

#### Scenario: Knowledge assigned to agent
- **WHEN** an authorized user grants an agent access to a document or collection
- **THEN** the system allows that agent to retrieve the assigned knowledge during future tasks

#### Scenario: Unassigned knowledge blocked
- **WHEN** an agent requests knowledge that has not been assigned to it
- **THEN** the system denies access to that knowledge
