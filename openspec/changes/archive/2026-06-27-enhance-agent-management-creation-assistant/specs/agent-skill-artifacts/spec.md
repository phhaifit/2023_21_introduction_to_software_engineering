## ADDED Requirements

### Requirement: Skill Markdown Preview
The system SHALL generate a previewable `skill.md` Markdown artifact from an agent draft before the agent is created.

#### Scenario: Draft preview generated
- **WHEN** a manager edits a draft with valid name, role, model, and instructions
- **THEN** the system renders a `skill.md` preview using the current draft values without creating or updating an agent

#### Scenario: Preview reflects draft edits
- **WHEN** a manager changes draft fields in the guided creation modal
- **THEN** the preview updates to reflect the latest session draft values

### Requirement: Existing Agent Skill Download
The system SHALL allow authorized workspace members to download an existing agent's generated `skill.md` as a Markdown file.

#### Scenario: Skill file downloaded
- **WHEN** a workspace member requests the `skill.md` artifact for an active or disabled agent in the same workspace
- **THEN** the system returns a Markdown file generated from that agent's current configuration

#### Scenario: Deleted agent download rejected
- **WHEN** a workspace member requests the `skill.md` artifact for a deleted or cross-workspace agent
- **THEN** the system rejects the request without exposing private configuration data

### Requirement: Free Form Skill Markdown Import
The system SHALL accept a user-provided Markdown `skill.md` file as input for creating an editable agent draft.

#### Scenario: Markdown import accepted for analysis
- **WHEN** a manager uploads or pastes a Markdown `skill.md` file
- **THEN** the system sends the Markdown for draft extraction and does not create an agent until the manager reviews and submits a valid draft

#### Scenario: Unsupported import rejected
- **WHEN** a manager provides an empty file or a non-Markdown import payload
- **THEN** the system rejects the import with a validation error and no draft is created

### Requirement: No Skill Version History
The system SHALL not store or display version history for downloaded or imported `skill.md` artifacts in this change.

#### Scenario: Skill artifact has no version list
- **WHEN** a user views or downloads a `skill.md` artifact
- **THEN** the system exposes only the current generated content and no historical versions
