## Why

The OpenClaw task execution adapter within the Task & Orchestration module represents a vital boundary connecting platform task orchestration with external execution runtimes. While the implementation (including `OpenClawTaskExecutionAdapter`, `OpenClawExecutionOrchestrator`, and `MockTaskExecutionAdapter`) is fully established in code and verified through simulated transport tests, comprehensive technical documentation within the module's README and high-level API contracts is currently missing. This documentation change is needed now to provide clear architectural guidance on adapter boundaries, DTO contracts, the rigorous 10-step start flow, cancellation forwarding, transport recovery, and the distinction between simulated transport and actual network transport.

## What Changes

- Create `apps/backend/src/modules/task-orchestration/README.md` to establish comprehensive technical documentation for the Task & Orchestration module.
- Document `TaskExecutionAdapter`, DTO contracts (`StartExecutionCommand`, `ExecutionBinding`, `NormalizedRuntimeEvent`), and consumer-side execution boundaries.
- Document `OpenClawExecutionOrchestrator`, detailing the rigorous 10-step start flow, cancellation forwarding boundary, and external dependency catalogs.
- Document transport recovery mechanisms, including snapshot reconciliation, stale-event handling, and duplicate-event protections.
- Clearly delineate mock/simulated transport behavior versus production integration, noting that the current adapter functions as a production integration skeleton utilizing simulated transport rather than actual network transport.
- Update `docs/api/module-api-contracts.md` to reference the consumer-side ports and cross-link the detailed module README.
- Maintain 100% runtime stability: no new runtime behavior, no production code changes, no test changes, and no shared contract modifications.

## Capabilities

### New Capabilities

- `document-openclaw-task-execution-adapter`: Documentation-only specification defining the technical documentation requirements for the OpenClaw Task Execution Adapter without introducing new runtime behavior.

### Modified Capabilities

None. This is a documentation-only change; existing capability requirements remain unchanged.

## Impact

- **Documentation**: Creates `apps/backend/src/modules/task-orchestration/README.md` and updates `docs/api/module-api-contracts.md`.
- **Runtime Behavior**: Zero impact. No changes to production code, shared contracts, routing behavior, or lifecycle mechanics.
- **Tests**: Zero impact. All existing test suites remain untouched and fully passing.
