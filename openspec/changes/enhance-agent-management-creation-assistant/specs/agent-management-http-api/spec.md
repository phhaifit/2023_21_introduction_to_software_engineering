## ADDED Requirements

### Requirement: Agent Model Catalog Endpoint
The system SHALL expose a workspace-scoped endpoint for reading selectable agent execution models.

#### Scenario: Model catalog endpoint
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents/models`
- **THEN** the response returns selectable model catalog entries in the shared API response envelope

#### Scenario: Model catalog unauthorized
- **WHEN** an unauthenticated client requests the model catalog
- **THEN** the response is rejected with a shared unauthorized error

### Requirement: Skill Preview Endpoint
The system SHALL expose a workspace-scoped endpoint for previewing generated `skill.md` content from a draft payload.

#### Scenario: Skill preview endpoint
- **WHEN** a client sends a valid draft payload to `POST /api/workspaces/:workspaceId/agents/skill-preview`
- **THEN** the response returns generated Markdown content without creating or updating an agent

#### Scenario: Invalid preview rejected
- **WHEN** a client sends missing or invalid draft fields to the preview endpoint
- **THEN** the response uses `validation.invalid_input` and does not persist data

### Requirement: Skill Download Endpoint
The system SHALL expose a workspace-scoped endpoint for downloading an existing agent's `skill.md`.

#### Scenario: Skill download endpoint
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents/:agentId/skill.md` for an active or disabled agent in the workspace
- **THEN** the response returns a Markdown file generated from the current agent configuration

#### Scenario: Skill download not found
- **WHEN** a client requests a deleted, missing, or cross-workspace agent skill artifact
- **THEN** the response uses an Agent Management not-available error and exposes no private configuration

### Requirement: Assistant Draft Endpoint
The system SHALL expose a workspace-scoped endpoint for generating an editable agent draft from a natural-language description.

#### Scenario: Prompt assistant endpoint
- **WHEN** a manager sends a valid prompt to `POST /api/workspaces/:workspaceId/agents/assistant/draft`
- **THEN** the response returns an editable draft, clarifying questions when needed, validation warnings, and provider metadata

#### Scenario: Assistant provider failure
- **WHEN** all configured LLM providers fail for the draft endpoint
- **THEN** the response returns a retryable Agent Management error and does not create an agent

### Requirement: Skill Import Analysis Endpoint
The system SHALL expose a workspace-scoped endpoint for analyzing free-form Markdown `skill.md` imports.

#### Scenario: Skill import analysis endpoint
- **WHEN** a manager sends Markdown content to `POST /api/workspaces/:workspaceId/agents/assistant/import-skill`
- **THEN** the response returns an editable draft extracted from the Markdown, warning metadata, and provider metadata without creating an agent

#### Scenario: Empty skill import rejected
- **WHEN** a manager sends empty Markdown content to the import endpoint
- **THEN** the response uses `validation.invalid_input`

### Requirement: Assistant Endpoint Authorization
The system SHALL require `agents:manage` permission for assistant draft generation, skill import analysis, and skill preview mutation-like actions.

#### Scenario: Viewer cannot generate assistant draft
- **WHEN** a viewer requests assistant draft generation or skill import analysis
- **THEN** the response is rejected with a shared forbidden error
