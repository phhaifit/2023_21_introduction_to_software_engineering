## ADDED Requirements

### Requirement: Frontend Model Catalog Integration
The frontend SHALL load selectable agent models from the Agent Management model catalog API.

#### Scenario: Model dropdown populated
- **WHEN** the guided create modal opens
- **THEN** the frontend loads model catalog entries and displays them as selectable model options

#### Scenario: Model catalog failure
- **WHEN** the model catalog request fails
- **THEN** the frontend displays a recoverable error and does not submit an agent draft with an unknown model

### Requirement: Frontend Skill Artifact Integration
The frontend SHALL support `skill.md` preview, download, and import through Agent Management APIs.

#### Scenario: Preview shown
- **WHEN** a manager edits a valid draft
- **THEN** the frontend shows the latest generated `skill.md` preview without creating an agent

#### Scenario: Download action
- **WHEN** a manager activates Download skill.md for an existing agent
- **THEN** the frontend downloads the current Markdown artifact for that agent

#### Scenario: Import action
- **WHEN** a manager imports a Markdown `skill.md`
- **THEN** the frontend sends the content to the import analysis endpoint and displays the extracted draft for review

### Requirement: Frontend LLM Provider Failure Handling
The frontend SHALL handle LLM provider failures as retryable errors.

#### Scenario: All providers fail
- **WHEN** the assistant draft or skill import request returns an all-providers-failed error
- **THEN** the frontend displays a retry message and does not replace the current draft with partial data

#### Scenario: Fallback provider used
- **WHEN** Gemini fails and OpenRouter succeeds
- **THEN** the frontend displays the generated draft and may show provider metadata indicating fallback usage

### Requirement: Frontend Blocking Warning Safety
The frontend SHALL prevent agent creation while the draft contains blocking warnings.

#### Scenario: Blocking warning disables submit
- **WHEN** a draft has unavailable tools, missing knowledge, unready knowledge, invalid model, or missing required fields
- **THEN** the create action is disabled and the warning is visible to the manager

#### Scenario: Warning resolved
- **WHEN** the manager edits the draft so all blocking warnings are resolved
- **THEN** the frontend allows the draft to be submitted if all required fields are valid

### Requirement: Frontend Session Draft Safety
The frontend SHALL avoid unintended API mutations while a session-only draft is being edited.

#### Scenario: Draft close is non-mutating
- **WHEN** a manager closes the guided creation modal before submitting
- **THEN** the frontend does not call create, update, enable, disable, delete, rename, duplicate, or assignment APIs

#### Scenario: Valid draft submit uses create API
- **WHEN** a manager submits a valid assistant draft
- **THEN** the frontend calls the Agent Management create endpoint and refreshes the agent list on success
