## ADDED Requirements

### Requirement: Connected Tool Recommendation Validation
The system SHALL treat tool recommendations as valid only when the tool is connected in the same workspace.

#### Scenario: Connected tool recommended
- **WHEN** a draft requests a tool that appears as connected in the workspace tool catalog
- **THEN** the system marks the requested tool as valid for the draft

#### Scenario: Unconnected tool warning
- **WHEN** a draft requests a tool that is missing, disconnected, or unavailable in the workspace tool catalog
- **THEN** the system adds a blocking warning and prevents agent creation until the tool request is removed or made valid

### Requirement: Ready Knowledge Recommendation Validation
The system SHALL treat knowledge recommendations as valid only when the document or collection exists in the same workspace and is ready for retrieval.

#### Scenario: Ready document recommended
- **WHEN** a draft requests a KB/RAG document that exists in the workspace and has ready indexing status
- **THEN** the system marks the requested knowledge reference as valid for the draft

#### Scenario: Missing document warning
- **WHEN** a draft requests a KB/RAG document that does not exist in the workspace
- **THEN** the system adds a blocking warning and prevents agent creation until the reference is removed or corrected

#### Scenario: Unready document warning
- **WHEN** a draft requests a KB/RAG document that exists but is pending, ingesting, failed, or otherwise not ready
- **THEN** the system adds a blocking warning and prevents agent creation until the document becomes ready or the reference is removed

### Requirement: Replaceable Public Catalog Adapters
The system SHALL support replaceable public catalog adapters for Tools and KB/RAG recommendations.

#### Scenario: Mock Tools catalog validates draft
- **WHEN** Tools Integration runtime APIs are not implemented
- **THEN** Agent Management uses a mock public Tools catalog adapter to validate draft recommendations without importing private module internals

#### Scenario: Public KB catalog validates draft
- **WHEN** KB/RAG public document APIs provide the needed ready-document metadata
- **THEN** Agent Management validates draft knowledge recommendations through those public APIs instead of importing private KB/RAG internals

#### Scenario: Real catalog adapter remains replaceable
- **WHEN** teammate modules later expose suitable public APIs
- **THEN** Agent Management can replace mock catalog adapters with real public API adapters without changing assistant draft behavior

### Requirement: No Permission Mutation
The system SHALL NOT create, update, or revoke real tool assignments or knowledge grants in this change.

#### Scenario: Draft validation does not assign tools
- **WHEN** a manager submits a valid draft with valid requested tools
- **THEN** Agent Management may create the agent but does not create a real tool assignment record

#### Scenario: Draft validation does not grant knowledge
- **WHEN** a manager submits a valid draft with valid requested knowledge references
- **THEN** Agent Management may create the agent but does not create a real knowledge grant record
