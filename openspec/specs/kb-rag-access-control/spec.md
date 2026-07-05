## Purpose

Define user, agent, workspace, and knowledge-source access boundaries for Knowledge Base / RAG.

## Requirements

### Requirement: Permission and Access Control
The system SHALL enforce user and agent access rules for all Knowledge Base / RAG actions.

#### Scenario: Unauthorized upload rejected
- **WHEN** a caller without upload permission attempts to upload a document
- **THEN** the system rejects the upload

#### Scenario: Unauthorized retrieval rejected
- **WHEN** a caller without retrieval permission attempts to retrieve knowledge
- **THEN** the system rejects the retrieval request

#### Scenario: Unauthorized RAG answer rejected
- **WHEN** a caller without RAG answer permission requests answer generation
- **THEN** the system rejects the answer-generation request

#### Scenario: Agent cannot access ungranted knowledge source
- **WHEN** an agent requests a document, chunk, source, retrieval result, or answer without an explicit grant
- **THEN** the system denies access to that knowledge source

#### Scenario: Knowledge grant mutation requires management permission
- **WHEN** a caller assigns or revokes an agent document grant
- **THEN** the system requires `knowledge:manage`

#### Scenario: Active agent grants can be listed by workspace readers
- **WHEN** an authenticated workspace member lists an agent's document grants
- **THEN** the system requires `workspace:read` and returns active safe document metadata only

#### Scenario: Revoked agent grant no longer authorizes retrieval
- **WHEN** an active document grant is revoked
- **THEN** later agent-scoped retrieval excludes that document

### Requirement: Workspace Isolation
The system SHALL strictly isolate all Knowledge Base / RAG data by workspace.

#### Scenario: Cross-workspace document access rejected
- **WHEN** a caller requests a document from another workspace
- **THEN** the system rejects access

#### Scenario: Cross-workspace chunk access rejected
- **WHEN** a caller requests a chunk from another workspace
- **THEN** the system rejects access

#### Scenario: Cross-workspace vector retrieval rejected
- **WHEN** a caller attempts vector retrieval across workspace boundaries
- **THEN** the system rejects access or scopes retrieval to the authorized workspace only

#### Scenario: Cross-workspace RAG answer rejected
- **WHEN** a caller requests answer generation using knowledge from another workspace
- **THEN** the system rejects the request

### Requirement: Skill Reference Is Not Permission
The system SHALL treat skill or knowledge references as intent/configuration only, not as access grants.

#### Scenario: Skill reference does not grant access
- **WHEN** a skill or configuration references a document or knowledge source
- **THEN** the system does not grant document, retrieval, or answer access based on that reference alone

#### Scenario: Explicit permission is required
- **WHEN** a user or agent requests Knowledge Base / RAG access
- **THEN** the system requires explicit permission or grant validation through the approved authorization boundary

### Requirement: Safe Public DTO Access Boundary
The system SHALL expose only authorized safe fields through Knowledge Base / RAG public contracts.

#### Scenario: Unauthorized safe fields withheld
- **WHEN** a caller lacks access to a document, chunk, source, retrieval result, or answer
- **THEN** the system withholds public DTO data for that resource
