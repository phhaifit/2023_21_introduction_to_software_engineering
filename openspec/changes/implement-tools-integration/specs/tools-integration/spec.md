## ADDED Requirements

### Requirement: Tool Catalog
The system SHALL show available tools and integrations for a workspace.

#### Scenario: Catalog viewed
- **WHEN** an authorized user opens the tools catalog
- **THEN** the system returns available tools with name, type, integration status, and required configuration fields

### Requirement: Quick Integration
The system SHALL support a quick integration flow for the first supported communication channel.

#### Scenario: Telegram integration connected
- **WHEN** an authorized user completes the Telegram quick integration flow
- **THEN** the system stores the integration configuration and marks Telegram as connected for the workspace

#### Scenario: Integration setup rejected
- **WHEN** required provider configuration is missing or invalid
- **THEN** the system rejects the setup with a validation error response

### Requirement: Credential Configuration
The system SHALL allow authorized users to configure sensitive credentials for tools.

#### Scenario: Credential saved
- **WHEN** an authorized user submits a token, API key, or environment value for a tool
- **THEN** the system stores the secret through the credential boundary and never returns the raw value in later API responses

### Requirement: Tool Assignment
The system SHALL allow authorized users to assign tools or channels to specific agents.

#### Scenario: Tool assigned to agent
- **WHEN** an authorized user assigns a connected tool to an agent in the same workspace
- **THEN** the system records that the agent is allowed to use that tool

#### Scenario: Tool assignment revoked
- **WHEN** an authorized user removes a tool assignment from an agent
- **THEN** the system prevents that agent from using the tool for future tasks

### Requirement: Secret Redaction
The system SHALL redact sensitive integration values from logs and API responses.

#### Scenario: Integration data returned
- **WHEN** the system returns tool configuration data
- **THEN** raw credentials are omitted or masked
