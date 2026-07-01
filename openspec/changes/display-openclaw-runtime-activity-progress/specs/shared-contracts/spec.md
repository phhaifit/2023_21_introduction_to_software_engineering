## ADDED Requirements

### Requirement: Normalized Runtime Activity Contract
The shared runtime execution contract SHALL expose additive provider-neutral activity metadata for `sub-activity` events so backend adapters, frontend providers, and tests can represent detailed runtime progress without private provider DTOs.

#### Scenario: Shared sub-activity carries safe activity metadata
- **WHEN** a provider runtime emits detailed progress through the adapter boundary
- **THEN** the shared `SubActivityEvent` contract SHALL support activity kinds for routing, workflow, tool call, web search, document read, file read, browser, shell, API call, sub-agent, handoff, review, aggregation, completion, message, and provider diagnostics
- **AND** it SHALL support optional safe display metadata such as display label, sanitized summary, tool name, query preview, resource label, input preview, output preview, provider event name, and activity status

#### Scenario: Existing sub-activity events remain compatible
- **GIVEN** an existing backend or frontend consumer emits or reads a legacy sub-activity event with `activityType: "tool"` or `activityType: "provider-diagnostic"`
- **WHEN** TypeScript contracts are compiled
- **THEN** the existing event SHALL remain valid
- **AND** consumers SHALL NOT require raw provider payload fields to render activity progress
