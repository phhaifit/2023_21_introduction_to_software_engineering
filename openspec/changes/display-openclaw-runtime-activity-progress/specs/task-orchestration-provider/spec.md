## ADDED Requirements

### Requirement: Live and Replay Runtime Activity Parity
The HTTP task orchestration provider SHALL apply normalized runtime events through one shared projection path for both execution-state replay and live EventSource updates.

#### Scenario: Replay and live activity render the same processing state
- **GIVEN** a task has accumulated normalized activity events while executing
- **WHEN** the user refreshes the page or switches back to the conversation
- **THEN** replayed execution state SHALL rebuild the same visible processing steps and logs as live EventSource delivery
- **AND** web search, tool call, document read, file read, browser, shell, API call, agent, workflow, and message activity SHALL use the same labels in both paths

#### Scenario: Runtime activity remains task scoped
- **GIVEN** multiple tasks are running in the same workspace
- **WHEN** a normalized runtime event is delivered or replayed
- **THEN** the provider SHALL apply it only when the task ID and compatible work ID match the subscribed task

### Requirement: Processing UI Uses Normalized Activity
Task Orchestration frontend components SHALL prefer normalized activity labels and safe summaries over keyword inference when displaying assistant processing progress.

#### Scenario: Render normalized activity label
- **GIVEN** a normalized activity event carries a safe display label such as `Searching web`, `Calling tool`, or `Reading document`
- **WHEN** the assistant progress summary or processing details modal renders
- **THEN** the UI SHALL display that label directly
- **AND** regex inference SHALL be used only for legacy or mock events without normalized metadata
