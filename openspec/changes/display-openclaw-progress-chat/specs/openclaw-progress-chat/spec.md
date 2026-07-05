## ADDED Requirements

### Requirement: Chat Visible OpenClaw Progress Projection
The system SHALL project safe OpenClaw provider progress into chat-visible runtime activity while preserving the canonical Task lifecycle.

#### Scenario: Project tool and search activity into chat progress
- **GIVEN** an OpenClaw execution emits provider activity for a web search, tool call, document read, file read, shell command, browser action, API call, routing action, workflow action, sub-agent action, message composition, reasoning activity, or provider diagnostic
- **WHEN** Task & Orchestration receives that activity through the OpenClaw transport boundary
- **THEN** the backend SHALL map it to a normalized runtime activity event with a safe display label
- **AND** the frontend SHALL display only the latest safe activity as transient assistant message text without exposing raw credentials, absolute system paths, or raw provider payloads
- **AND** each newer displayable activity SHALL replace the previous transient activity text rather than accumulating visible chat logs

#### Scenario: Preserve execution when optional progress is unavailable
- **GIVEN** an OpenClaw execution emits assistant text chunks but no optional progress activity
- **WHEN** the HTTP/SSE stream is consumed
- **THEN** the chat SHALL still display partial assistant output and final output
- **AND** the Task SHALL NOT fail only because detailed progress events were absent

#### Scenario: Replace transient progress with assistant output
- **GIVEN** the active assistant response is displaying transient provider activity
- **WHEN** the first assistant output text chunk is received
- **THEN** the chat SHALL replace the transient activity text with the streaming assistant output
- **AND** the chat SHALL NOT keep the previous activity as a visible log row, chip, tag, box, or step counter

#### Scenario: Ignore unrelated session progress
- **GIVEN** an OpenClaw side-channel emits activity for a different session key
- **WHEN** Task & Orchestration receives the frame
- **THEN** the frame SHALL NOT be projected into the subscribed Task
