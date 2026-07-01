## ADDED Requirements

### Requirement: Provider-Supplied Runtime Activity Projection
Task & Orchestration SHALL project detailed OpenClaw runtime activity only when the provider supplies progress events through the execution adapter boundary. Projected activity SHALL use normalized provider-neutral activity kinds and safe display metadata instead of fixed local processing steps or raw provider logs.

#### Scenario: Project detailed provider activity
- **GIVEN** an OpenClaw Gateway progress frame describes web search, tool calling, document reading, file reading, browser activity, shell execution, API calling, agent activity, workflow activity, message composition, or provider diagnostics
- **WHEN** the adapter receives the frame for the active task session
- **THEN** Task & Orchestration SHALL project a normalized activity event with a matching activity kind and safe display label
- **AND** it SHALL NOT create a fixed local step that was not supplied by the provider

#### Scenario: Ignore unavailable detailed activity
- **GIVEN** an OpenClaw execution emits lifecycle or output events but no detailed progress frames
- **WHEN** Task & Orchestration renders processing details
- **THEN** the canonical task lifecycle and final answer SHALL continue normally
- **AND** the UI SHALL avoid displaying invented runtime activity

### Requirement: Production-Safe Activity Detail Redaction
Projected runtime activity SHALL exclude raw provider payload dumps, credentials, absolute system paths, and unredacted prompt or response internals. Safe activity labels and summaries SHALL be derived from sanitized provider fields.

#### Scenario: Redact provider activity metadata
- **GIVEN** a Gateway progress payload includes a token, API key, password, secret, or absolute system path
- **WHEN** the adapter normalizes the progress event
- **THEN** the resulting event SHALL redact the sensitive value before it reaches frontend state
- **AND** advanced processing details SHALL show only safe identifiers, labels, summaries, and provider event names
