## 1. Shared Runtime Contract

- [x] 1.1 Extend `SubActivityEvent` with provider-neutral runtime activity kinds and optional safe display metadata.
- [x] 1.2 Add or update focused contract expectations for the additive shared runtime activity contract.

## 2. OpenClaw Gateway Activity Mapping

- [x] 2.1 Update `OpenClawHttpSSETransport` Gateway side-channel mapping for search, tool, document, file, browser, shell, API, agent, workflow, message, and diagnostic activity.
- [x] 2.2 Preserve failed/canceled/completed provider progress status accurately and keep unknown or cross-session frames ignored.
- [x] 2.3 Add backend transport tests for representative Gateway progress frames and redaction.

## 3. Frontend Runtime Projection

- [x] 3.1 Refactor `HttpTaskOrchestrationProvider` so execution-state replay and live EventSource updates use one normalized event projection path.
- [x] 3.2 Render normalized activity labels and safe summaries in assistant progress and processing details without fixed fake steps or raw log dumps.
- [x] 3.3 Add or update frontend tests for live/replay parity and normalized activity labels.

## 4. Verification

- [x] 4.1 Run focused task-orchestration/backend contract tests.
- [x] 4.2 Run required repository verification commands and document exact results.
