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
