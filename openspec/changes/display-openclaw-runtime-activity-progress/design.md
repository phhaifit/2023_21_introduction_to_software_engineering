## Context

Task & Orchestration already starts real OpenClaw executions through `POST /v1/chat/completions`, streams result chunks through the OpenAI-compatible SSE response, and optionally subscribes to Gateway WebSocket progress via `sessions.subscribe` and `sessions.messages.subscribe`. The current side-channel mapper only recognizes broad `tool`, `operation`, `message`, and `agent` event names. The shared `SubActivityEvent.activityType` union does not include first-class search, reading, browser, shell, or API activity, so the frontend currently relies on labels and keyword heuristics to display "Searching web", "Reading workspace", or "Calling tool".

The correct boundary is projection-only. Task & Orchestration must not invent fixed processing steps, administer tools, or infer OpenClaw internals. It can only normalize and display provider-supplied activity frames, and it must degrade gracefully when the Gateway does not provide detailed progress.

## Goals / Non-Goals

**Goals:**

- Represent provider progress using explicit normalized activity kinds for web search, tool call, document read, file read, browser activity, shell command, API call, agent activity, workflow activity, message composition, and diagnostics.
- Keep the existing HTTP/SSE result stream as canonical for partial output and completion.
- Map OpenClaw Gateway WebSocket progress frames into safe `sub-activity` events without exposing raw provider payloads.
- Make frontend live SSE and execution-state replay use the same runtime-event projector.
- Render processing details from normalized activity labels and logs, not six fixed steps or raw dumps.
- Preserve task scoping, stale-event checks, and redaction.

**Non-Goals:**

- No OpenClaw container provisioning or Gateway administration.
- No new Gateway API endpoint or dependency.
- No browser-side direct WebSocket connection to OpenClaw.
- No raw prompt, credential, absolute path, or provider payload display.
- No guarantee of detailed activity when the Gateway does not emit progress frames.

## Decisions

1. **Extend the shared normalized event contract.**

   `SubActivityEvent.activityType` will be expanded to stable provider-neutral kinds, and optional safe metadata fields will be added: `displayLabel`, `summary`, `toolName`, `queryPreview`, `resourceLabel`, `inputPreview`, `outputPreview`, `providerEventName`, and `status`.

   Rationale: backend, frontend, and execution-state replay all consume `NormalizedRuntimeEvent`. Keeping the shape in shared contracts avoids divergent local DTOs.

   Alternative considered: keep `details` as a free-form string and improve frontend regex. Rejected because it remains lossy and cannot be verified accurately.

2. **Map Gateway frames by event name and known safe payload keys.**

   The backend side-channel mapper will classify event names and payload fields into normalized activity kinds:

   - search/web/search.query/search.result -> `web-search`
   - tool/function/tool.call/tool.result -> `tool-call`
   - document/knowledge/retrieval/rag -> `document-read`
   - file/workspace/artifact/read -> `file-read`
   - browser/browse/navigation/page -> `browser`
   - shell/terminal/command/process -> `shell`
   - api/http/request -> `api-call`
   - agent -> `sub-agent`
   - operation/workflow -> `workflow`
   - message -> partial output or `message`

   Rationale: this uses provider-supplied event names and payload fields, not UI label guessing.

   Alternative considered: create custom fake task stages for search/read/tool. Rejected because it violates projection-only observability.

3. **Use one frontend projector for replay and live events.**

   `HttpTaskOrchestrationProvider` will route both `/state` replay events and EventSource live events through one method that validates task/work scoping, applies state transitions, appends safe processing logs, and emits `TaskRuntimeEvent`.

   Rationale: refresh and live execution must show the same progress, otherwise the UI can appear stuck until refresh or lose detail after refresh.

   Alternative considered: patch the live handler only. Rejected because it leaves replay drift in place.

4. **Render normalized labels with conservative fallback.**

   The progress summary and processing detail modal will prefer normalized `stepName`/log labels produced by the backend. Regex-based label resolution remains only for legacy or mock events.

   Rationale: the UI should be production-clean and deterministic while still supporting older mock/provider events.

## Risks / Trade-offs

- **Gateway frame schema uncertainty** -> The mapper will support common frame shapes (`payload`, `params.payload`, `data`, `result`) and keep unknown frames ignored instead of corrupting state.
- **Detailed progress unavailable** -> The lifecycle and partial output continue normally; the UI shows no detailed activity rather than fake steps.
- **Shared contract change requires broader review** -> The proposal, design, spec, and tests explicitly document why the existing union is insufficient and request shared-boundary review in the PR.
- **Large PR risk** -> Implementation stays focused on one normalized activity path and avoids unrelated UI redesign.

## Migration Plan

1. Add OpenSpec delta specs and tasks.
2. Extend shared `SubActivityEvent` type additively; existing activity values remain valid.
3. Update backend mapper and transport tests for representative Gateway frames.
4. Refactor frontend provider projection and component rendering tests.
5. Run focused tests, build, OpenSpec validation, and diff checks.

Rollback is code-only: revert this change to restore the previous broad activity mapping. No database migration is involved.

## Open Questions

- Official Gateway progress frame names are not publicly available in the repo. The mapper will support the documented local side-channel methods and common observed event naming patterns, while unknown frames remain safely ignored.
