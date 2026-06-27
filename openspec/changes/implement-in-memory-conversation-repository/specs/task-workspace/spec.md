## ADDED Requirements

### Requirement: Bridge Active Conversation with Catalogs

The task workspace SHALL ensure active conversation sessions bridge cleanly with live agent and workflow catalogs within the workspace context to verify execution targets.

#### Scenario: Verify routing targets within an active conversation workspace

* **GIVEN** an active conversation session in the workspace
* **WHEN** a user selects an agent or workflow routing mode
* **THEN** the system SHALL validate the selection against the `ExternalAgentCatalog` or `ExternalWorkflowCatalog`
* **AND** the verified runtime target SHALL be associated with the active `Conversation` entity
