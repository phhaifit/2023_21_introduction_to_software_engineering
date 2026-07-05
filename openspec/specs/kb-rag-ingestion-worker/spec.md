## Purpose

Define ingestion job lifecycle, document chunking, retry behavior, and safe worker failure handling for Knowledge Base / RAG.

## Requirements

### Requirement: Processing Job Lifecycle
The system SHALL track ingestion jobs through a persisted production lifecycle.

#### Scenario: Job queued
- **WHEN** a document is accepted for asynchronous ingestion
- **THEN** the system records the job with lifecycle value `queued`

#### Scenario: Job processing
- **WHEN** ingestion begins for a queued job
- **THEN** the system records the job with lifecycle value `processing`

#### Scenario: Job completed
- **WHEN** ingestion and chunking complete successfully
- **THEN** the system records the job with lifecycle value `completed`

#### Scenario: Job failed
- **WHEN** ingestion cannot complete
- **THEN** the system records the job with lifecycle value `failed` and a safe error summary

#### Scenario: Retry requested if supported
- **WHEN** retry is supported and an authorized user requests retry for a failed job
- **THEN** the system creates or updates processing state through the approved lifecycle

### Requirement: Document Chunking
The system SHALL split extracted document text into persisted chunks suitable for embedding and retrieval.

#### Scenario: Chunks created from extracted text
- **WHEN** normalized extracted text is available for a document
- **THEN** the worker creates persisted workspace-scoped chunks for embedding, retrieval, and source attribution

#### Scenario: Empty text rejected or marked failed safely
- **WHEN** extracted text cannot produce valid chunks
- **THEN** the system rejects processing or marks the job failed with a safe error

#### Scenario: Chunk metadata remains workspace-scoped
- **WHEN** chunks are persisted
- **THEN** each chunk remains associated with its workspace, document, and safe attribution metadata

### Requirement: Worker Failure Handling
The system SHALL convert worker and queue failures into safe processing errors.

#### Scenario: Worker failure safe response
- **WHEN** ingestion worker execution fails
- **THEN** the system records a safe failure summary

#### Scenario: Queue internals not exposed
- **WHEN** worker status or failure data is returned
- **THEN** queue payloads and runtime internals are not exposed through public DTOs
