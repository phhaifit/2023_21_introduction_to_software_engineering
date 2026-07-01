## ADDED Requirements

### Requirement: Rich OpenClaw Gateway Progress Mapping
The OpenClaw network transport SHALL map best-effort Gateway WebSocket side-channel frames into normalized runtime activity events for search, tool, document, file, browser, shell, API, agent, workflow, message, and diagnostic activity when those frames are scoped to the current session.

#### Scenario: Map Gateway activity frame
- **GIVEN** an active HTTP/SSE OpenClaw execution has a provider execution reference and conversation session key
- **WHEN** the Gateway side-channel emits a session-scoped progress frame whose event name or safe payload fields identify a supported activity kind
- **THEN** the transport SHALL emit a `chat.completion.chunk` carrying an `openclaw_extension` with the normalized activity kind, safe label, sanitized summary, provider event name, and task/provider references

#### Scenario: Ignore unknown or cross-session frame
- **GIVEN** the Gateway side-channel emits an unknown progress frame or a frame for another session key
- **WHEN** the transport processes the frame
- **THEN** it SHALL ignore the frame
- **AND** it SHALL NOT fail the HTTP/SSE execution stream

### Requirement: Gateway Progress Status Preservation
The OpenClaw network transport SHALL preserve provider progress status accurately for running, completed, failed, and canceled progress events.

#### Scenario: Map failed progress status
- **GIVEN** a Gateway progress frame has status `failed` or `error`
- **WHEN** the transport normalizes the frame
- **THEN** the projected activity SHALL retain a failed status rather than marking the activity as completed
