## Why

Agent Management currently supports basic lifecycle management, but users must manually write role, model, and instruction fields and cannot safely import or reuse `skill.md` artifacts. The platform needs a guided creation flow that can turn natural-language descriptions or free-form `skill.md` files into validated agent drafts while preserving workspace permission boundaries for Tools Integration, Knowledge Base / RAG, and OpenClaw execution.

This change keeps the work as one OpenSpec change for traceability, but splits implementation into small phases with focused tests so each Codex implementation pass can stay bounded.

## What Changes

- Add `skill.md` artifact support:
  - Users can preview the generated `skill.md` before creating an agent.
  - Users can download an existing agent's `skill.md` as a Markdown file.
  - Users can import a free-form Markdown `skill.md` file to create an editable draft.
  - No `skill.md` version history is included in this change.
- Add a session-only Agent creation draft flow:
  - Draft state lives in the frontend modal/session only and is not persisted as a database draft.
  - A valid assistant-created agent is created with status `enabled`.
  - Drafts with blocking warnings cannot be submitted.
- Add template-based creation:
  - Users can build a draft from structured template sections and preview the resulting `skill.md`.
- Add a real LLM assistant for the first demo:
  - Gemini is the primary provider, defaulting to `gemini-2.5-flash`.
  - OpenRouter is the fallback provider, defaulting to `openrouter/owl-alpha`, when Gemini fails, times out, returns an invalid response, or is not configured.
  - If Gemini and OpenRouter both fail, the UI asks the user to retry and does not create or mutate a draft.
  - Mock LLM adapters are allowed only for automated tests and explicitly configured local test paths.
- Add free-form `skill.md` import analysis:
  - The LLM extracts name, role, model, instructions, requested tools, and requested knowledge references from arbitrary Markdown.
  - The user must review and edit the extracted draft before creating an agent.
- Add server-side model catalog behavior:
  - Agent creation uses a model selected from a backend-provided catalog rather than trusting arbitrary free-text model values.
  - The first implementation may use a static server-side catalog with `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `openrouter/owl-alpha`.
  - The assistant drafting model is separate from the agent execution model selected from this catalog.
  - Provider credentials, quota enforcement, and production model billing are out of scope.
- Add workspace capability validation:
  - Tool recommendations are valid only when the tool is connected in the current workspace.
  - Knowledge recommendations are valid only when the document or collection exists in the current workspace and is ready for retrieval.
  - Because Tools Integration runtime APIs are not implemented yet, the first capability-validation phase uses a mock public Tools catalog adapter.
  - KB/RAG now has public document APIs; the future knowledge-validation adapter should prefer those public APIs and only use a mock public catalog if the available API shape is insufficient.
  - The final implementation records a committed handoff requirement for teammate modules at `docs/api/agent-management-tools-kb-handoff.md`.
- Preserve module boundaries:
  - `skill.md` describes intent and behavior; it is not the permission authority.
  - Tool assignment remains owned by Tools Integration.
  - Knowledge grants remain owned by Knowledge Base / RAG.
  - A later Agent Management integration may call public Tools/KB assignment or grant APIs only after those modules expose suitable APIs and the follow-up OpenSpec change is approved.
  - OpenClaw runtime manifest construction, task cancellation on permission revoke, and task execution remain owned by Task Orchestration / OpenClaw runtime integration.

## Capabilities

### New Capabilities

- `agent-skill-artifacts`: Preview, download, and import agent `skill.md` Markdown artifacts without version history.
- `agent-creation-assistant`: Template-based and LLM-assisted draft generation, clarification, retry/fallback behavior, and draft submission rules.
- `agent-model-catalog`: Workspace-scoped model catalog behavior for selecting valid agent execution models.
- `agent-capability-validation`: Validation of requested tools and knowledge references against connected tools and ready KB/RAG documents through public or mock catalog boundaries.

### Modified Capabilities

- `agent-management`: Agent creation can consume validated assistant drafts, assistant-created valid agents default to `enabled`, and free-text model acceptance is replaced by catalog validation.
- `agent-management-http-api`: Add workspace-scoped routes for model catalog, skill artifact download/import analysis, skill preview, and assistant draft generation.
- `agent-management-ui-api-integration`: Add frontend API client behavior for model catalog, draft generation, skill import/download, validation warnings, and retryable LLM failures.
- `agent-management-app-shell`: Add a guided creation modal experience while preserving existing list, lifecycle, rename, duplicate, toast, and viewer-mode behavior.

## Impact

- Backend:
  - `apps/backend/src/modules/agent-management`
  - Agent Management application ports for model catalog, LLM draft generation, tool catalog lookup, and knowledge catalog lookup.
  - Agent Management API routes under `/api/workspaces/:workspaceId/agents/...`.
- Frontend:
  - `apps/frontend/src/features/agent-management`
  - Create-agent modal, import flow, preview panel, warning display, retry handling, model selector, and API client updates.
- Shared contracts:
  - May require new caller-safe DTOs for Agent Management assistant requests/responses, model catalog entries, skill artifact metadata, and validation warnings.
  - Shared DTOs must not expose credentials, raw provider errors, private runtime fields, generated trusted context, or server-owned status fields.
- Tests:
  - Contract tests for new DTOs and API response shapes when shared contracts change.
  - Backend unit/service tests for renderer, import analysis orchestration, provider fallback, model validation, and blocking warnings.
  - Frontend component tests for the guided modal, draft state, warnings, retry error, model dropdown, preview, and disabled submit behavior.
  - E2E coverage for the happy-path assistant flow after the API-backed UI is implemented.
- Dependencies and external systems:
  - Gemini and OpenRouter provider adapters require API keys through server-side environment variables.
  - Demo defaults are `GEMINI_MODEL_ID=gemini-2.5-flash` and `OPENROUTER_MODEL_ID=openrouter/owl-alpha`.
  - No local/Ollama provider is included because local resources are insufficient for the demo.
  - No production dependency should be added without explicit approval during implementation.
- Out of scope:
  - Persisted draft history.
  - `skill.md` version history.
  - Real Tools Integration assignment mutation.
  - Real KB/RAG grant mutation.
  - OpenClaw task manifest execution.
  - Task cancellation when tool or knowledge permission is revoked.
  - Production model billing/quota management.
