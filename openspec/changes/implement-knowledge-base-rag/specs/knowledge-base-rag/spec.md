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

#### Scenario: Worker handoff updates ingestion lifecycle safely
- **WHEN** a worker handoff receives an already-created pending ingestion job for a workspace document
- **THEN** it marks the ingestion job as ingesting and updates the associated document ingestion/indexing state through KB/RAG repository ports
- **AND** after the skeleton processor succeeds it marks the job and document ready and records safe ingestion completed event payloads
- **AND** after the skeleton processor fails it marks the job and document failed and stores only safe error code/message fields
- **AND** the handoff does not parse files, read object storage, create chunks, call embedding providers, write vectors, execute external sync, import Prisma directly, import frontend code, or import another module's private internals

#### Scenario: Text processing pipeline persists deterministic chunks
- **WHEN** a pending ingestion job for a supported text or markdown-style document is processed
- **THEN** the worker pipeline reads text through an injected content reader, normalizes whitespace deterministically, splits text into stable chunks, and persists `KnowledgeDocumentChunk` records through KB/RAG repository ports
- **AND** persisted chunks have stable chunk IDs from the injected generator, stable chunk indexes, stable text content, pending embedding status, and no vector references
- **AND** the associated document records the chunk count while leaving vector indexing pending until a later embedding/vector issue
- **AND** empty content, unsupported content, and content-reader failures mark the job and document failed with safe error code/message fields
- **AND** the pipeline does not read object storage directly, parse PDF/DOC/DOCX, perform OCR, call embedding providers, write vectors, implement retrieval, modify HTTP routes, import frontend code, or import another module's private internals

#### Scenario: Embedding and vector indexing use injected adapters
- **WHEN** a worker indexes a workspace document that already has persisted chunks
- **THEN** the indexing pipeline loads chunks through KB/RAG repository ports, marks document indexing as ingesting, generates embeddings through an injected embedding adapter, and upserts chunk embeddings through an injected vector index adapter
- **AND** successful indexing marks chunk embedding status ready, stores only opaque internal vector references on chunks, updates the document indexed chunk count, and marks document indexing ready
- **AND** missing chunks, embedding adapter failures, vector index adapter failures, unsupported chunk state, or unknown failures mark document indexing failed with safe error code/message fields
- **AND** this boundary does not call real embedding providers, real vector database clients, semantic search, retrieval APIs, RAG answer generation, frontend code, HTTP routes, Prisma schema changes, migrations, generated Prisma client changes, or new SDK dependencies
- **AND** public DTOs, events, logs, and thrown safe errors do not expose raw embeddings, raw chunk text beyond existing repository-internal chunk storage, storage keys, vector DB internals, provider payloads, credentials, tokens, or secrets

#### Scenario: Local end-to-end flow composes existing worker boundaries
- **WHEN** a prepared workspace document and pending ingestion job exist in local repositories
- **THEN** the local flow runner starts the ingestion handoff, runs the injected text processing pipeline, persists deterministic chunks, runs the injected indexing pipeline, calls injected embedding and vector index adapters, and returns final document/job/chunk state
- **AND** successful local flow marks ingestion status ready, chunk embedding status ready, document indexing status ready, and indexed chunk count equal to persisted chunk count
- **AND** content reader failures, empty or unsupported content, embedding failures, vector index failures, and unknown indexing failures produce safe failure code/message fields without leaking raw document content, raw embeddings, storage keys, vector DB config, provider payloads, credentials, secrets, tokens, or queue payloads
- **AND** the local flow runner does not add production scheduling, real file storage, real embedding provider calls, real vector DB calls, retrieval, RAG answer generation, frontend UI/API client changes, backend HTTP routes, Prisma schema/migration/generated client changes, shared status changes, SDK dependencies, or external sync

#### Scenario: Opt-in local upload processes through indexing
- **WHEN** the local server enables inline ingestion and an authorized user uploads a supported document
- **THEN** the upload use case persists the file, document, and job, invokes the existing local flow runner, persists chunks, calls the configured embedding/vector adapters, and returns ready document/job state only after indexing succeeds

#### Scenario: Inline indexing failure remains consistent
- **WHEN** parsing, embedding, or vector indexing fails during inline local processing
- **THEN** the system persists safe failed document/job state, does not present the document as ready for retrieval, and does not expose storage, provider, vector, or stack internals

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

#### Scenario: Local pgvector smoke verifies real vector retrieval
- **WHEN** a developer explicitly enables the local pgvector smoke test with `KNOWLEDGE_PGVECTOR_SMOKE=1` and provides PostgreSQL/pgvector configuration
- **THEN** the smoke test seeds namespaced KB/RAG document and chunk records, upserts deterministic vectors through the pgvector adapter, retrieves evidence through the existing retrieval boundary, verifies workspace isolation, and cleans up inserted records
- **AND** without the explicit smoke flag the smoke test exits successfully as skipped
- **AND** the smoke path does not call real embedding or RAG providers, require pgvector in CI, expose raw vectors or vector references in public evidence, run benchmarks, tune indexes, or add production queue/runtime behavior

### Requirement: Agent Knowledge Access
The system SHALL allow authorized users to assign documents to specific agents
through a workspace-scoped public API.

#### Scenario: Knowledge assigned to agent
- **WHEN** an authorized user grants an agent access to a document
- **THEN** the system allows that agent to retrieve the assigned knowledge during future tasks

#### Scenario: Active assignments listed safely
- **WHEN** an authorized workspace member lists an agent's assigned documents
- **THEN** the system returns only active grants with safe document metadata

#### Scenario: Assignment is idempotent
- **WHEN** an authorized user assigns an already active or previously revoked document grant
- **THEN** the system preserves one composite grant and leaves it active

#### Scenario: Assignment revoked
- **WHEN** an authorized user revokes a document grant
- **THEN** the system marks the grant revoked and excludes the document from later assignment lists and agent retrieval

#### Scenario: Assignment workspace isolation enforced
- **WHEN** a caller targets an agent or document outside the route workspace
- **THEN** the system safely denies the operation without disclosing cross-workspace resource existence

#### Scenario: Unassigned knowledge blocked
- **WHEN** an agent requests knowledge that has not been assigned to it
- **THEN** the system denies access to that knowledge

#### Scenario: Internal agent tool retrieves assigned evidence
- **WHEN** an existing workspace agent invokes the internal knowledge retrieval tool with a valid query
- **THEN** the tool delegates to the existing retrieval use case with agent context and returns only bounded citation-style evidence from active document grants

#### Scenario: Agent tool short-circuits without eligible grants
- **WHEN** an agent has no active grants after workspace and optional-filter intersection
- **THEN** the tool returns an empty safe result before calling embedding or vector adapters

#### Scenario: Non-grant references do not authorize retrieval
- **WHEN** an agent skill or configuration references a knowledge document without an active document grant
- **THEN** the internal retrieval tool returns no evidence from that document

#### Scenario: Local agent ask returns grounded citations
- **WHEN** an authorized workspace member asks an existing agent a question and active assigned evidence is found
- **THEN** the system invokes the internal agent retrieval tool and returns a deterministic evidence-grounded answer with bounded safe citations

#### Scenario: Local agent ask falls back without evidence
- **WHEN** no active assigned evidence remains because the agent is ungranted, a grant is revoked, or safe filters remove all granted documents
- **THEN** the system returns an insufficient-evidence fallback without calling the answer composer

#### Scenario: Agent ask preserves module boundaries
- **WHEN** the local-demo agent ask integration runs
- **THEN** it does not import private Task & Orchestration code, register an OpenClaw tool, require an external LLM, or expose private retrieval/runtime fields
