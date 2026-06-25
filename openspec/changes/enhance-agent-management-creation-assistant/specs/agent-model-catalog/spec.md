## ADDED Requirements

### Requirement: Workspace Model Catalog
The system SHALL provide a workspace-scoped model catalog for selecting valid agent execution models.

#### Scenario: Model catalog returned
- **WHEN** an authorized workspace member requests available agent models
- **THEN** the system returns enabled model entries with provider id, model id, display name, capabilities, and tier metadata

#### Scenario: Catalog excludes disabled models
- **WHEN** a model is disabled or unavailable for the workspace
- **THEN** the system does not include that model as selectable in the catalog response

### Requirement: Catalog Model Validation
The system SHALL validate agent create and update requests against the model catalog.

#### Scenario: Valid model accepted
- **WHEN** a manager creates or updates an agent using a model id returned by the catalog
- **THEN** the system accepts the model field if all other agent configuration fields are valid

#### Scenario: Invalid model rejected
- **WHEN** a manager creates or updates an agent using an unknown, disabled, or unavailable model id
- **THEN** the system rejects the request with a validation error and does not persist the agent mutation

### Requirement: Static Catalog First Implementation
The system SHALL support a static server-side model catalog for the first implementation.

#### Scenario: Static catalog used
- **WHEN** no production model registry is available
- **THEN** the system serves a static server-side model catalog without exposing provider credentials or billing metadata

#### Scenario: Demo catalog models included
- **WHEN** the first demo model catalog is requested
- **THEN** the catalog includes `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `openrouter/owl-alpha` as selectable model ids when their providers are enabled

### Requirement: Separate Assistant and Execution Models
The system SHALL distinguish the LLM model used by the creation assistant from the execution model selected for the agent.

#### Scenario: Assistant provider separate from agent model
- **WHEN** the assistant uses Gemini or OpenRouter to generate a draft
- **THEN** the generated draft still contains an agent execution model selected from the Agent Management model catalog
