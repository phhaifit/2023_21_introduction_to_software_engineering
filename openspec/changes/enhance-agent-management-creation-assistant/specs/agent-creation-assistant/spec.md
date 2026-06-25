## ADDED Requirements

### Requirement: Session Draft Lifecycle
The system SHALL keep assistant-created agent drafts in the frontend modal session only.

#### Scenario: Draft exists only in modal session
- **WHEN** a manager creates a draft through template input, prompt input, or `skill.md` import
- **THEN** the draft remains in the active modal session and is not persisted as a database draft record

#### Scenario: Closing modal discards draft
- **WHEN** a manager closes the guided creation modal before submitting
- **THEN** the draft is discarded and no create-agent API request is sent

### Requirement: Template Based Draft Creation
The system SHALL allow managers to create an agent draft by filling structured template sections.

#### Scenario: Template draft created
- **WHEN** a manager fills template sections for role, responsibilities, instructions, constraints, and examples
- **THEN** the system creates an editable draft and renders a `skill.md` preview from those sections

#### Scenario: Template draft validation
- **WHEN** required template fields such as name, role, model, or instructions are missing
- **THEN** the system marks the draft invalid and prevents agent creation

### Requirement: Prompt Based LLM Draft Creation
The system SHALL use a real LLM assistant to turn a manager's natural-language description into an editable agent draft.

#### Scenario: Prompt draft generated
- **WHEN** a manager submits a natural-language description for a new agent
- **THEN** the system returns an editable draft containing proposed name, role, model, instructions, requested tools, requested knowledge, and warning metadata

#### Scenario: Clarification required
- **WHEN** the LLM determines that the description is missing required information
- **THEN** the system returns clarifying questions and does not allow agent creation until the required answers are incorporated into a valid draft

### Requirement: LLM Provider Fallback
The system SHALL call Gemini as the primary LLM provider and OpenRouter as fallback for assistant draft generation and `skill.md` import analysis.

#### Scenario: Demo provider model defaults configured
- **WHEN** the demo environment omits explicit provider model override variables
- **THEN** the system uses `gemini-2.5-flash` for Gemini and `openrouter/owl-alpha` for OpenRouter

#### Scenario: Gemini succeeds
- **WHEN** Gemini returns a valid structured draft response
- **THEN** the system uses that response and does not call OpenRouter

#### Scenario: Gemini fails and OpenRouter succeeds
- **WHEN** Gemini fails, times out, is not configured, or returns invalid structured output
- **THEN** the system retries through OpenRouter and uses the OpenRouter response if it is valid

#### Scenario: All LLM providers fail
- **WHEN** Gemini and OpenRouter both fail or both return invalid structured output
- **THEN** the system does not create or mutate a draft and tells the user to try again

### Requirement: Mock Provider Limited to Tests
The system SHALL use mock LLM behavior only for automated tests or explicitly configured local test paths.

#### Scenario: User-facing demo does not silently mock
- **WHEN** Gemini and OpenRouter are unavailable in a user-facing flow
- **THEN** the system shows a retryable LLM failure message instead of silently returning a mock draft

#### Scenario: Automated tests use mock provider
- **WHEN** automated tests exercise assistant behavior
- **THEN** the tests can inject a deterministic mock provider without requiring real provider API keys

### Requirement: Valid Draft Submission
The system SHALL allow an assistant-created agent to be created only after the manager reviews and submits a valid draft.

#### Scenario: Valid draft creates enabled agent
- **WHEN** a manager submits an assistant-created draft with valid fields and no blocking warnings
- **THEN** the system creates the agent in the workspace with status `enabled`

#### Scenario: Blocking warnings prevent creation
- **WHEN** a draft has blocking warnings for invalid model, unavailable tool, missing document, or unready knowledge
- **THEN** the system disables creation until the blocking warnings are resolved
