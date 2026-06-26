# Task History Production UI Enhancement Specification

## ADDED Requirements

### Requirement: Conversation-based Task workspace
The workspace SHALL organize related Task records into conversation sessions without duplicating the canonical Task records. The state structure SHALL enforce:
```text
TaskCreationState
├── tasks
├── conversations
├── activeConversationId
├── activeTaskId
└── presentation state
```
Frontend-owned state includes composer draft, selector state, modal state, search query, filter state, submitting, loading, and reconnecting. Canonical Task state includes status, timeline, partial output, final result, error, cancellation, and timestamps.

#### Scenario: Render multiple Tasks in one conversation
* **GIVEN** a conversation contains multiple ordered Task IDs
* **WHEN** the user selects that conversation
* **THEN** the execution feed renders the corresponding Task turns in order
* **AND** every turn reads data from the canonical Task record.

---

### Requirement: Conversation selection is presentation-only
Selecting a conversation SHALL affect presentation only and SHALL NOT modify Task execution. Background Task execution is preserved by immutable Task ID.

#### Scenario: Switch away from a running Task
* **GIVEN** Task A is In-Progress in Conversation A
* **WHEN** the user selects Conversation B
* **THEN** Task A remains eligible to receive runtime updates
* **AND** Task A is not stopped, restarted, canceled, reset, or duplicated.

---

### Requirement: New Chat preserves existing execution
Creating a new conversation SHALL preserve existing conversations, Tasks, and background execution.

#### Scenario: Create an empty conversation while another Task runs
* **GIVEN** Task A is In-Progress in an existing conversation
* **WHEN** the user creates a new chat
* **THEN** a new empty conversation becomes active
* **AND** Task A continues processing under its immutable Task ID
* **AND** the new conversation does not display Task A as its own content.

---

### Requirement: Conversation-oriented search and filtering
The history sidebar SHALL search and filter conversation sessions without changing Task execution.

#### Scenario: Filter by latest Task status
* **GIVEN** a conversation has one or more Tasks
* **WHEN** a status filter is applied
* **THEN** the conversation matches only when its latest Task has the selected canonical status.

#### Scenario: Search by Task identity
* **GIVEN** a conversation contains a Task with a matching Task ID or Work ID
* **WHEN** the user searches for that identity
* **THEN** the conversation appears in the matching results
* **AND** no Task lifecycle state is changed.
