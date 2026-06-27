## 1. Phase 0 - Preflight and Contract Shape

- [x] 1.1 Recheck `git status --short --branch`, fast-forward `master` if safe, and confirm no protected `.local-docs/` files are read or touched before implementation.
- [x] 1.2 Read the current Agent Management, API boundary, shared contract, Tools Integration, and KB/RAG source-of-truth files before editing code.
- [x] 1.3 Define the minimal caller-safe Agent Management DTOs for model catalog entries, draft requests/responses, skill previews, provider metadata, and validation warnings.
- [x] 1.4 Update shared contract inventory only if the DTOs become public `@vcp/shared` contracts.
- [x] 1.5 Update `docs/api/module-api-contracts.md` with the new Agent Management planned or implemented route rows.
- [x] 1.6 Add or update contract tests for DTO exposure rules, route matrix coverage, and secret/provider-error redaction expectations.
- [x] 1.7 Run `npm run test:contracts` or the focused contract-test command after shared contract/API matrix changes.

## 2. Phase 1 - Skill Markdown Artifact Backend

- [x] 2.1 Refactor the existing skill configuration generator into a richer `skill.md` renderer with stable sections for role, responsibilities, operating context, instructions, requested tools, requested knowledge, constraints, escalation rules, and example tasks.
- [x] 2.2 Preserve compatibility with existing agents that only have name, role, model, and instructions by rendering empty optional sections safely.
- [x] 2.3 Add a backend use case for previewing `skill.md` from a draft payload without persisting an agent.
- [x] 2.4 Add a workspace-scoped skill preview API route using the shared API response envelope.
- [x] 2.5 Add a workspace-scoped `skill.md` download use case for active and disabled agents.
- [x] 2.6 Add a workspace-scoped `GET /api/workspaces/:workspaceId/agents/:agentId/skill.md` route that returns Markdown without exposing deleted or cross-workspace agents.
- [x] 2.7 Add basic import payload validation that rejects empty or non-Markdown content before LLM analysis exists.
- [x] 2.8 Add backend tests for renderer output, preview non-persistence, download success, deleted/cross-workspace rejection, and invalid import payloads.
- [x] 2.9 Run focused Agent Management backend/contract tests for skill artifacts.

## 3. Phase 2 - Model Catalog and Model Validation

- [x] 3.1 Add an Agent Management model catalog port and static server-side catalog implementation for the first demo with `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `openrouter/owl-alpha`.
- [x] 3.2 Include model metadata for provider id, model id, display name, capabilities, tier, and enabled state without exposing provider credentials or billing internals.
- [x] 3.3 Add `GET /api/workspaces/:workspaceId/agents/models` using workspace context and shared API response shape.
- [x] 3.4 Update create-agent validation to reject unknown, disabled, or unavailable model ids.
- [x] 3.5 Update update-agent validation to reject unknown, disabled, or unavailable model ids.
- [x] 3.6 Add backend tests for model catalog response, unauthorized access, valid model acceptance, invalid model create rejection, and invalid model update rejection.
- [x] 3.7 Update frontend Agent Management API client with `listAgentModels()`.
- [x] 3.8 Add frontend tests for model catalog parsing and malformed/error responses.
- [x] 3.9 Run focused backend, frontend API-client, and contract tests for model catalog behavior.

## 4. Phase 3 - Guided Modal and Template Draft UI

- [x] 4.1 Replace or extend the New Agent modal with a guided creation modal that supports Template, Prompt Assistant, and Import `skill.md` entry points.
- [x] 4.2 Keep the existing Configure Agent flow intact for editing existing agents.
- [x] 4.3 Add frontend session-only draft state that is discarded when the guided modal closes before submit.
- [x] 4.4 Build the template draft form with editable name, role, model selector, responsibilities, instructions, constraints, escalation rules, and example tasks.
- [x] 4.5 Show generated `skill.md` preview from the current draft values.
- [x] 4.6 Prevent create submission when required draft fields are missing.
- [x] 4.7 Submit a valid template draft through the existing create-agent API and refresh the paginated list on success.
- [x] 4.8 Add component tests for modal entry points, draft discard, template validation, preview rendering, valid submit, and preservation of existing configure behavior.
- [x] 4.9 Run focused frontend component/API-client tests for the guided modal and template draft flow.

## 5. Phase 4 - LLM Provider Chain Backend

- [x] 5.1 Add an `LlmAgentDraftingPort` or equivalent Agent Management application port for prompt draft generation and `skill.md` import extraction.
- [x] 5.2 Define the structured LLM output schema for draft fields, requested tools, requested knowledge, clarifying questions, and warnings.
- [x] 5.3 Implement provider output validation that treats malformed or incomplete structured output as provider failure.
- [x] 5.4 Implement the Gemini provider adapter using server-side environment configuration, defaulting `GEMINI_MODEL_ID` to `gemini-2.5-flash`.
- [x] 5.5 Implement the OpenRouter provider adapter using server-side environment configuration, defaulting `OPENROUTER_MODEL_ID` to `openrouter/owl-alpha`.
- [x] 5.6 Implement provider fallback orchestration: call Gemini first, call OpenRouter only after Gemini failure, and fail the request if both providers fail.
- [x] 5.7 Ensure raw provider errors, API keys, credentials, and private provider payloads are never returned to the frontend.
- [x] 5.8 Keep deterministic mock provider support for automated tests only.
- [x] 5.9 Add backend unit tests for Gemini success, Gemini failure with OpenRouter success, both providers failing, invalid structured output, missing API key handling, and mock-provider test injection.
- [x] 5.10 Run focused backend tests for LLM provider chain behavior.

## 6. Phase 5 - Prompt Assistant Flow

- [ ] 6.1 Add the workspace-scoped assistant draft API route for natural-language descriptions.
- [ ] 6.2 Require `agents:manage` permission for assistant draft generation.
- [ ] 6.3 Return editable draft fields, clarifying questions, warning metadata, and provider metadata without creating an agent.
- [ ] 6.4 Add backend tests for authorization, valid prompt response, clarification response, all-provider failure response, and no agent persistence.
- [ ] 6.5 Add frontend API client support for assistant draft generation.
- [ ] 6.6 Build the prompt assistant modal view with loading, clarification, fallback-provider metadata, retryable failure, and draft review states.
- [ ] 6.7 Ensure all-provider failure preserves any existing user input and asks the user to retry.
- [ ] 6.8 Add component tests for prompt submit, loading state, clarification display, fallback-provider display, all-provider failure, and successful draft review.
- [ ] 6.9 Run focused backend and frontend tests for prompt assistant flow.

## 7. Phase 6 - Free-Form Skill Markdown Import Through LLM

- [ ] 7.1 Add the workspace-scoped skill import analysis API route for free-form Markdown content.
- [ ] 7.2 Require `agents:manage` permission for skill import analysis.
- [ ] 7.3 Use the LLM provider chain to extract an editable draft from arbitrary Markdown `skill.md` content.
- [ ] 7.4 Return extracted draft fields, requested tools, requested knowledge, warnings, and provider metadata without creating an agent.
- [ ] 7.5 Add backend tests for empty import rejection, valid Markdown extraction, provider fallback, all-provider failure, and no agent persistence.
- [ ] 7.6 Add frontend API client support for skill import analysis.
- [ ] 7.7 Build the import view for paste/upload Markdown, import loading, extracted draft review, invalid import error, and retry handling.
- [ ] 7.8 Add component tests for paste import, file import, invalid import, extracted draft review, and retryable provider failure.
- [ ] 7.9 Run focused backend and frontend tests for skill import flow.

## 8. Phase 7 - Tool and Knowledge Recommendation Validation

- [ ] 8.1 Add Agent Management application ports for connected tool catalog lookup and ready KB/RAG document lookup.
- [ ] 8.2 Implement mock public connected-tool catalog adapter for the first demo without importing Tools Integration private code.
- [ ] 8.3 Implement mock public ready-knowledge catalog adapter for the first demo without importing KB/RAG private code.
- [ ] 8.4 Validate requested tools from prompt/import/template drafts against the connected-tool catalog.
- [ ] 8.5 Validate requested knowledge references from prompt/import/template drafts against ready documents in the knowledge catalog.
- [ ] 8.6 Add blocking warnings for missing tools, disconnected tools, missing documents, and unready documents.
- [ ] 8.7 Prevent agent creation while blocking warnings remain.
- [ ] 8.8 Add backend tests for valid connected tool, disconnected tool warning, valid ready document, missing document warning, unready document warning, and no assignment/grant mutation.
- [ ] 8.9 Add frontend tests for warning display, disabled create button, warning resolution, and valid draft submission after resolution.
- [ ] 8.10 Run focused backend and frontend tests for capability validation.

## 9. Phase 8 - Integration, E2E, and Handoff

- [ ] 9.1 Add an end-to-end or integration test for the happy path: open guided create, generate or mock a valid assistant draft through configured test provider behavior, preview `skill.md`, submit agent, and see the enabled agent in the list.
- [ ] 9.2 Add an end-to-end or integration test for blocking warnings preventing agent creation.
- [ ] 9.3 Add manual browser verification notes for model catalog, template draft, LLM assistant, `skill.md` import, `skill.md` download, provider failure retry, and blocking warnings.
- [ ] 9.4 Document required environment variables for Gemini and OpenRouter provider configuration without exposing secrets, including demo defaults `GEMINI_MODEL_ID=gemini-2.5-flash` and `OPENROUTER_MODEL_ID=openrouter/owl-alpha`.
- [ ] 9.5 Create or update `docs/api/agent-management-tools-kb-handoff.md` with teammate handoff requirements for Tools Integration: connected tool catalog API shape and future public assignment API integration.
- [ ] 9.6 Create or update `docs/api/agent-management-tools-kb-handoff.md` with teammate handoff requirements for KB/RAG: ready document/collection API shape and future public grant API integration.
- [ ] 9.7 Document that OpenClaw runtime manifest construction and task cancellation on permission revoke remain Task Orchestration/OpenClaw integration scope.
- [ ] 9.8 Run `npm test`.
- [ ] 9.9 Run `npm run build`.
- [ ] 9.10 Run `openspec validate "enhance-agent-management-creation-assistant" --strict`.
- [ ] 9.11 Run `openspec validate --all --strict`.
- [ ] 9.12 Run `git diff --check`.
