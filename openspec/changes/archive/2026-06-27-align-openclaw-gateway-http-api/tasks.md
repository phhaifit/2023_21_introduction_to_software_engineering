## 1. Gateway HTTP API Realignment

- [x] 1.1 Update `OpenClawHttpSSETransport.startExecution` in `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts` to set `model: "openclaw/default"` and `user` in the JSON request body, and pass `x-openclaw-model` and `x-openclaw-session-key` in the HTTP headers.

## 2. Verification

- [x] 2.1 Verify implementation stability by running `npm test`, `npm run build`, `openspec validate --all --strict`, and `git diff --check`.
