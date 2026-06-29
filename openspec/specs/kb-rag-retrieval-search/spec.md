## Purpose

Define retrieval/search behavior over indexed workspace knowledge, including query validation, empty results, safe evidence fields, and private retrieval internal safety.

## Requirements

### Requirement: Retrieval/Search
The system SHALL retrieve relevant workspace knowledge evidence for a validated query.

#### Scenario: Successful retrieval
- **WHEN** an authorized caller submits a valid retrieval query
- **THEN** the system returns relevant workspace knowledge evidence through a safe public contract

#### Scenario: Empty retrieval result
- **WHEN** a valid retrieval query has no matching workspace evidence
- **THEN** the system returns an empty safe result

### Requirement: Retrieval Query Validation
The system SHALL validate retrieval queries before searching workspace knowledge.

#### Scenario: Invalid query rejected
- **WHEN** a retrieval query is missing, malformed, or outside allowed constraints
- **THEN** the system rejects the query with a safe validation error

### Requirement: Retrieval Workspace Isolation
The system SHALL enforce workspace isolation for retrieval/search.

#### Scenario: Workspace isolation enforced
- **WHEN** retrieval is requested for a workspace
- **THEN** the system searches only evidence authorized for that workspace

### Requirement: Safe Retrieval DTO
The system SHALL return only safe evidence fields from retrieval/search.

#### Scenario: Safe evidence fields returned
- **WHEN** retrieval results are returned
- **THEN** the response includes safe document, chunk, score, and citation metadata needed by callers

#### Scenario: Private retrieval internals not returned
- **WHEN** retrieval results are returned
- **THEN** raw embeddings, raw vectors, storage keys, private URLs, provider internals, credentials, secrets, and tokens are not returned
