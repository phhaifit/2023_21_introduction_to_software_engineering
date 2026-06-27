## Why

The current OpenClaw adapter implementation within Task & Orchestration mixes two conflicting design approaches: the official OpenClaw Gateway OpenAI-compatible HTTP API (`/v1/chat/completions`) and a simulated custom execution transport (`/executions/start`, `/executions/{id}/cancel`, `/executions/{id}/snapshot`). This hybrid design forces the transport layer to maintain unnecessary fallback logic to fictitious endpoints, requires a cumbersome two-step event mapping process (from `chat.completion.chunk` to intermediary DTOs to `NormalizedRuntimeEvent`), logs sensitive user prompts and stream chunks to the terminal, and hardcodes `model: "openclaw/default"` in request bodies, breaking advanced Specific Agent and Workflow routing capabilities. Aligning the adapter strictly to the official OpenClaw Gateway HTTP API specification eliminates these risks, simplifies maintainability, enhances security, and enables advanced routing.

## What Changes

- **Pure OpenAI-Compatible HTTP Transport**: Remove all fallback logic targeting `/executions/*` endpoints from `OpenClawHttpSSETransport`.
- **Streamlined Event Mapping**: Refactor `OpenClawRawEventMapper` to directly accept and parse OpenAI `chat.completion.chunk` objects into the canonical `NormalizedRuntimeEvent` union, eliminating intermediary DTO structures.
- **Dynamic Model Target Routing**: Update the HTTP request body in `OpenClawHttpSSETransport` to dynamically set `model: request.target || "openclaw/default"` to support Specific Agent and Predefined Workflow routing.
- **Strict Cancellation via AbortController**: Align the cancellation mechanism to rely exclusively on `AbortController.abort()` to terminate active HTTP/SSE streams, removing outgoing cancellation HTTP requests.
- **Production Security & Redaction**: Remove raw prompt and delta chunk console logging from the transport layer to prevent sensitive data leakage.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-execution-adapter`: Update DTO contracts and event mapping requirements to reflect direct parsing of OpenAI-compatible SSE chunks (`chat.completion.chunk`) and remove custom execution webhook DTO definitions.
- `openclaw-task-execution`: Align network transport specifications to adhere strictly to the OpenClaw Gateway OpenAI-compatible HTTP API, requiring `model: request.target`, removing `/executions/*` endpoints, and enforcing `AbortController` stream abortion for cancellation.

## Impact

- `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts`: Major refactoring to remove fake DTO interfaces, update event mapping logic, remove fallback fetch calls, and eliminate sensitive logging.
- `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.test.ts`: Update unit tests to verify direct parsing of `chat.completion.chunk` payloads and dynamic model routing.
- `openspec/specs/task-execution-adapter/spec.md`: Specification update.
- `openspec/specs/openclaw-task-execution/spec.md`: Specification update.
