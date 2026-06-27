## 1. Core Adapter & Transport Alignment

- [x] 1.1 Remove legacy custom execution DTO interfaces (`OpenClawStartRequestDTO`, `OpenClawCancelRequestDTO`, `OpenClawRawProgressEvent`, etc.) from `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts`.
- [x] 1.2 Refactor `OpenClawRawEventMapper.mapRawEvent` in `openclaw-network-transport.ts` to directly accept and parse OpenAI-compatible SSE chunks (`chat.completion.chunk`) into `NormalizedRuntimeEvent` union objects.
- [x] 1.3 Update `OpenClawHttpSSETransport.startExecution` in `openclaw-network-transport.ts` to pass `model: request.target || "openclaw/default"` in the request body, remove fallback `/executions/*` API calls, and eliminate raw prompt and delta chunk console logging.
- [x] 1.4 Align `OpenClawHttpSSETransport.cancelExecution` in `openclaw-network-transport.ts` to invoke `AbortController.abort()` exclusively without making outgoing HTTP cancellation calls.

## 2. Verification & Testing

- [x] 2.1 Update unit tests in `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.test.ts` to verify direct parsing of `chat.completion.chunk` payloads, dynamic model targeting, and absence of sensitive terminal logging.
- [x] 2.2 Run full verification suite (`npm test`, `npm run build`, `openspec validate "align-openclaw-adapter-to-gateway-http-api" --strict`, `openspec validate --all --strict`, `git diff --check`).
