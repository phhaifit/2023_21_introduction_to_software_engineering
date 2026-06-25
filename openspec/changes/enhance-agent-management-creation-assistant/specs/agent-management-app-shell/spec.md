## ADDED Requirements

### Requirement: Guided Create Agent Modal
The system SHALL provide a guided creation modal for manual template, prompt assistant, and `skill.md` import flows.

#### Scenario: Guided modal opened
- **WHEN** a manager activates New Agent
- **THEN** the page opens a guided create modal with options for template creation, prompt assistant creation, and `skill.md` import

#### Scenario: Existing configure modal preserved
- **WHEN** a manager configures an existing agent
- **THEN** the existing configure flow remains available and does not require the assistant flow

### Requirement: Assistant Prompt View
The guided modal SHALL provide a prompt-based assistant view.

#### Scenario: Prompt submitted
- **WHEN** a manager enters a natural-language description and submits it
- **THEN** the modal shows loading state until the assistant returns a draft, clarification, warning, or retryable error

#### Scenario: Clarifying questions displayed
- **WHEN** the assistant returns clarifying questions
- **THEN** the modal displays those questions and lets the manager provide additional answers before creating an agent

### Requirement: Skill Import View
The guided modal SHALL provide a free-form Markdown `skill.md` import view.

#### Scenario: Markdown import pasted or selected
- **WHEN** a manager pastes Markdown or selects a Markdown file
- **THEN** the modal sends the content for import analysis and displays the extracted draft for review

#### Scenario: Invalid import visible
- **WHEN** the imported Markdown is empty or cannot be analyzed
- **THEN** the modal displays an error and preserves the user's ability to retry

### Requirement: Draft Review and Preview View
The guided modal SHALL provide a review view with editable fields, model selection, warnings, and `skill.md` preview.

#### Scenario: Review view displayed
- **WHEN** a draft exists
- **THEN** the modal displays editable name, role, model, instructions, requested tools, requested knowledge, warnings, and the generated Markdown preview

#### Scenario: Create blocked by warnings
- **WHEN** the draft has blocking warnings
- **THEN** the modal keeps the Create Agent action disabled and explains what must be fixed

### Requirement: Assistant UI Accessibility
The guided modal SHALL remain accessible through semantic dialogs, labels, roles, and keyboard-reachable controls.

#### Scenario: Accessible guided modal
- **WHEN** assistive technologies inspect the guided creation modal
- **THEN** the modal exposes a dialog name, labeled fields, button names, status messages, and warning messages through accessible semantics
