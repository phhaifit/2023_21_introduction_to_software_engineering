## 1. OpenSpec and transport contract

- [x] 1.1 Define the real OpenClaw network transport scope and protocol assumptions.
- [x] 1.2 Add delta specs for task-execution-adapter and openclaw-task-execution.
- [x] 1.3 Define OpenClawNetworkTransport boundary.
- [x] 1.4 Define raw OpenClaw provider DTOs or schema placeholders based on confirmed assumptions.

## 2. Raw event mapping

- [x] 2.1 Implement OpenClawRawEventMapper.
- [x] 2.2 Map raw progress, partial output, completion, failure and cancellation events.
- [x] 2.3 Apply sanitize/redaction logic before creating NormalizedRuntimeEvent.
- [x] 2.4 Add mapper tests for valid, invalid and sensitive payloads.

## 3. Network transport

- [x] 3.1 Implement concrete transport using the selected protocol.
- [x] 3.2 Implement start execution request.
- [x] 3.3 Implement cancel execution request.
- [x] 3.4 Implement event stream subscription.
- [x] 3.5 Implement unavailable runtime and auth failure handling.
- [x] 3.6 Add transport tests with mocked network behavior.

## 4. Adapter integration

- [x] 4.1 Inject OpenClawNetworkTransport into OpenClawTaskExecutionAdapter.
- [x] 4.2 Replace simulated event path for production transport while preserving test-only simulation where appropriate.
- [x] 4.3 Preserve duplicate and stale event protections.
- [x] 4.4 Preserve snapshot reconciliation behavior.
- [x] 4.5 Add adapter integration tests with mock transport.

## 5. Verification and docs

- [x] 5.1 Update module docs for real transport behavior.
- [x] 5.2 Run targeted task execution tests.
- [x] 5.3 Run type-check and build if required.
- [x] 5.4 Run OpenSpec strict validation.
- [x] 5.5 Run git diff --check.
