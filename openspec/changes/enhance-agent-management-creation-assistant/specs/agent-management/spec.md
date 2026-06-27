## ADDED Requirements

### Requirement: Assistant Draft Agent Creation
The system SHALL allow authorized managers to create agents from validated assistant drafts.

#### Scenario: Assistant draft creates agent
- **WHEN** an authorized user with `agents:manage` permission submits a valid assistant draft
- **THEN** the system creates the agent, stores its configuration, writes the corresponding `skill.md` content, refreshes the paginated list, and returns the public summary

#### Scenario: Assistant draft defaults enabled
- **WHEN** an agent is created from a valid assistant draft
- **THEN** the new agent has status `enabled`

### Requirement: Catalog Validated Agent Model
The system SHALL treat the agent model as a catalog-selected value instead of arbitrary free text.

#### Scenario: Agent model from catalog
- **WHEN** an authorized user creates or updates an agent
- **THEN** the model value must match a selectable model from the workspace model catalog

#### Scenario: Agent model validation failure
- **WHEN** an authorized user submits a model not available in the workspace model catalog
- **THEN** the system rejects the create or update request with a validation error

### Requirement: Skill Intent Is Not Permission
The system SHALL treat `skill.md` tool and knowledge sections as agent intent rather than workspace permission.

#### Scenario: Skill references do not grant permission
- **WHEN** an imported or generated `skill.md` references a tool or knowledge document
- **THEN** the system does not grant tool access or knowledge access based on that reference alone
