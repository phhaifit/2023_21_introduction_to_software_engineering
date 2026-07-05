## ADDED Requirements

### Requirement: Gateway Session Event Observability Source
Gateway Control session events SHALL be treated as provider-supplied observability events when they are scoped to the active task conversation. The adapter SHALL sanitize and project those events without inferring activity that the Gateway did not emit.

#### Scenario: Display Gateway session progress
- **WHEN** a subscribed Gateway Control session emits progress, tool, message, chat, or side-result events for the active conversation
- **THEN** Task & Orchestration SHALL project those events through the existing provider-neutral activity feed
- **AND** it SHALL preserve canonical task lifecycle behavior even if optional session diagnostics are absent

#### Scenario: Redact Control protocol diagnostics
- **WHEN** a Gateway Control event contains tokens, paths, tool arguments, or private reasoning fields
- **THEN** the adapter SHALL redact sensitive values before the event reaches frontend projection
- **AND** it SHALL NOT expose backend device identity material
