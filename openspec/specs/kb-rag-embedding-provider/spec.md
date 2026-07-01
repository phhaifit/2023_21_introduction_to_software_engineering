## Purpose

Define embedding generation through an approved provider boundary, including provider configuration, batching expectations, failure handling, and secret safety.

## Requirements

### Requirement: Embedding Generation
The system SHALL generate embeddings for document chunks through an approved embedding provider boundary.

#### Scenario: Embedding generated
- **WHEN** a valid workspace document chunk is ready for embedding
- **THEN** the system generates an embedding through the approved provider boundary

#### Scenario: Embedding associated with chunk
- **WHEN** embedding generation succeeds
- **THEN** the system associates embedding readiness with the workspace, document, and chunk metadata

### Requirement: Embedding Provider Configuration
The system SHALL validate embedding provider configuration before generating embeddings.

#### Scenario: Provider config validated
- **WHEN** embedding generation is configured
- **THEN** the system validates required provider configuration before processing chunks

#### Scenario: Embedding dimension validated
- **WHEN** an embedding is returned by the provider boundary
- **THEN** the system validates that the embedding shape is compatible with the indexing boundary

### Requirement: Embedding Failure Handling
The system SHALL convert embedding provider failures into safe processing errors.

#### Scenario: Provider failure handled safely
- **WHEN** the embedding provider boundary fails
- **THEN** the system records a safe failure without exposing provider internals

### Requirement: Provider Secret Safety
The system SHALL keep embedding provider secrets and payloads out of public contracts.

#### Scenario: Provider secrets not exposed
- **WHEN** embedding generation returns, fails, logs, or maps public DTOs
- **THEN** API keys, tokens, credentials, secrets, and raw provider payloads are not exposed
