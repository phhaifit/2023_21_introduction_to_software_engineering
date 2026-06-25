## Context

Agent Management is the most mature module in the project. It already owns workspace-scoped agents, lifecycle operations, persistence, a public summary DTO, API-backed UI flows, and skill file writing. The current create/configure flow still treats `model` as a simple string and requires users to manually provide role and instructions. The generated `skill.md` is written for runtime use, but users cannot download it, import it, preview richer structured content, or use an assistant to turn a business description into a validated agent configuration.

The broader platform requires strict workspace boundaries. Tools Integration owns connected tools, credentials, and agent-tool assignments. Knowledge Base / RAG owns documents, indexing status, retrieval, and agent knowledge grants. Task Orchestration owns task submission, routing, runtime manifest construction, and OpenClaw execution. Agent Management must therefore assist with configuration and recommendations without becoming the authority for tool permissions, knowledge grants, or OpenClaw task execution.

Current integration state matters:

- Tools Integration has planned API matrix rows for catalog and assignments, but no runtime backend implementation or shared tool DTOs yet.
- KB/RAG now has implemented public workspace routes and shared DTOs for document metadata, ingestion jobs, data sources, sync scope, and sync jobs. It still does not expose an Agent Management-owned grant mutation API, and Agent Management must consume only public KB/RAG boundaries.
- OpenClaw is represented in this repo as a workspace runtime boundary behind `apps/backend/src/shared/openclaw/runtime-adapter.ts`; feature modules should not call Docker/OpenClaw directly.

## Goals / Non-Goals

**Goals:**

- Add a guided Agent Management creation experience while preserving the existing list, create, edit, lifecycle, rename, duplicate, toast, and viewer-mode behavior.
- Support `skill.md` preview, download, and free-form Markdown import.
- Keep imported/generated drafts session-only in the frontend modal.
- Use a real LLM assistant in the first demo, with Gemini `gemini-2.5-flash` as primary provider and OpenRouter `openrouter/owl-alpha` as fallback.
- If all configured LLM providers fail, show a retry message and do not create or mutate the draft.
- Add model selection through a backend-provided model catalog rather than trusting arbitrary free-text model values.
- Validate requested tools and knowledge references against connected tools and ready KB/RAG documents.
- Use mock public catalog adapters for Tools/KB until teammate modules expose suitable runtime APIs.
- Split implementation into small phases with focused automated tests for every phase.

**Non-Goals:**

- Persist draft sessions in the database.
- Store `skill.md` version history.
- Implement real Tools Integration assignment mutation.
- Implement real KB/RAG knowledge grant mutation.
- Implement Task Orchestration runtime manifest construction.
- Implement task cancellation when tool or knowledge permission is revoked.
- Implement OpenClaw task execution or direct OpenClaw runtime calls from Agent Management.
- Implement production provider billing, quotas, or credential management.
- Add local/Ollama providers.

## Decisions

### 1. Keep agent drafts session-only in the frontend

The guided creation modal owns draft state for prompt-generated, template-generated, and imported `skill.md` flows. Closing the modal discards the draft unless the user has already submitted a valid agent creation request.

Rationale:

- The user explicitly does not need persisted drafts.
- Session-only drafts avoid schema changes and keep the first implementation focused.
- Existing Agent persistence remains the source of truth only after the user confirms creation.

Alternative considered: persist `AgentCreationDraft` records. Rejected because it adds lifecycle, expiration, cleanup, and collaboration concerns that are not required for the requested flow.

### 2. Treat `skill.md` as an artifact, not a permission source

`skill.md` preview/download/import is owned by Agent Management. The file can describe requested tools and knowledge context, but those references are never authority. Tool and knowledge access must still be validated against workspace catalogs and grants.

Rationale:

- The platform requirements explicitly put tool assignment in Tools Integration and knowledge access grants in KB/RAG.
- Importing arbitrary Markdown must not grant permissions.
- This keeps OpenClaw runtime behavior aligned with platform governance.

Alternative considered: trust imported `skill.md` tool and document sections. Rejected because it would bypass workspace security and module ownership.

### 3. Use a richer canonical `skill.md` template

The renderer should move beyond the current simple role/model/instructions output and support stable sections such as:

```md
# <Agent Name>

## Role

## Responsibilities

## Operating Context

## Instructions

## Requested Tools

## Requested Knowledge

## Constraints

## Escalation Rules

## Example Tasks
```

Rationale:

- Structured sections make preview, download, import, and LLM extraction more predictable.
- The user can still import free-form Markdown because the import path uses LLM extraction and validation instead of strict parsing.

Alternative considered: require strict Markdown template imports. Rejected because the user wants free-form Markdown imports.

### 4. Use provider chain: Gemini primary, OpenRouter fallback

The Agent Creation Assistant calls Gemini first with default model id `gemini-2.5-flash`. If Gemini is missing configuration, times out, returns HTTP/provider errors, returns malformed content, or fails structured validation, the assistant retries through OpenRouter with default model id `openrouter/owl-alpha`. If OpenRouter also fails, the UI shows a retryable error and does not create or mutate the draft.

The default model ids are environment-overridable so the class demo can recover if provider availability changes:

- `GEMINI_API_KEY`
- `GEMINI_MODEL_ID`, default `gemini-2.5-flash`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL_ID`, default `openrouter/owl-alpha`

Rationale:

- Gemini is suitable as the primary free-tier demo provider.
- OpenRouter provides a practical hosted fallback without local compute.
- Real LLM behavior is required in the first demo.
- `gemini-2.5-flash` is the best fit for structured drafting because it balances latency, quality, and cost for low-volume demo usage.
- `openrouter/owl-alpha` is a fixed free OpenRouter model id, which is more deterministic than the random `openrouter/free` router for automated validation and demo debugging.

Alternative considered: fallback to mock assistant for user-facing demo. Rejected by user decision. Mock adapters remain allowed for automated tests and explicitly configured development/test paths.

### 5. Validate provider output before accepting it

LLM output must be parsed into a structured draft schema before the UI receives it. Missing required fields, invalid model IDs, invalid tool references, invalid knowledge references, or unsupported response shapes are treated as provider failure or blocking draft warnings depending on when the error is detected.

Rationale:

- Raw LLM output is not trustworthy enough to become agent configuration.
- Structured validation creates deterministic tests for failure and fallback paths.

Alternative considered: send raw Markdown generated by the model directly to the form. Rejected because it cannot reliably enforce model, tool, or KB constraints.

### 6. Add a model catalog boundary before enforcing model selection

The first implementation can use a static server-side model catalog. Agent create/update paths should accept only model IDs returned by that catalog. The frontend should render a dropdown rather than free-text entry.

The initial demo catalog should include:

- `gemini-2.5-flash` as the default recommended execution model.
- `gemini-2.5-flash-lite` as a lower-cost/lower-latency execution option.
- `openrouter/owl-alpha` as the hosted fallback execution option when OpenRouter is configured.

The assistant drafting model is not automatically the agent execution model. The assistant may recommend an execution model, but that recommendation must still resolve to an enabled model in this catalog.

Rationale:

- The existing free-text `model` field allows invalid or unavailable model names.
- Model selection affects cost, provider availability, and runtime capabilities.
- A static server-side catalog is enough for the first demo and does not require a new provider-management module.

Alternative considered: keep free-text model input. Rejected because it conflicts with provider-backed execution and LLM-assisted recommendations.

### 7. Use replaceable public catalog adapters for Tools and KB/RAG

Agent Management should define local ports such as `ConnectedToolCatalogPort` and `KnowledgeDocumentCatalogPort`. The first implementation uses a mock public Tools catalog because Tools Integration is still planned. For KB/RAG, Agent Management should prefer the implemented public KB/RAG document API when the integration phase reaches knowledge validation; if the public API is insufficient for agent-specific recommendation validation, the adapter can temporarily fall back to a mock public catalog behind the same port. The final implementation must include a documentation-only teammate handoff at `docs/api/agent-management-tools-kb-handoff.md`; PR notes should summarize and link to that file instead of being the only handoff source.

Rationale:

- Tools Integration API rows are planned but not implemented.
- KB/RAG has public document routes, but no grant mutation API owned by Agent Management.
- Replaceable catalog ports let Agent Management demo recommendation and blocking-warning behavior without private cross-module imports.

Alternative considered: import Tools/KB private data or wait for teammate modules. Rejected because private imports break boundaries and waiting blocks Agent Management progress.

### 8. Keep assignment and grant mutation out of this Agent Management implementation

The assistant may recommend connected tools and ready KB documents. It may validate that requested references are available. It does not perform real tool assignment or knowledge grant mutation in this change.

When real Tools/KB APIs become available, Agent Management should integrate them in two separate steps:

1. Replace mock catalog reads with real public catalog APIs in a follow-up Agent Management integration change.
2. Add optional user-confirmed assignment/grant mutation only through public Tools/KB APIs in a later approved OpenSpec change, while keeping Tools Integration and KB/RAG as the authority for those records.

Until that follow-up is approved, assignment/grant mutation remains in the Tools Integration and KB/RAG module flows. Agent Management must not import private repositories, write assignment/grant tables directly, or silently create permissions from `skill.md`.

Rationale:

- Tool assignment is owned by Tools Integration.
- Knowledge grants are owned by KB/RAG.
- The user's current implementation scope is Agent Management.

Alternative considered: have Agent Management directly create assignments/grants. Rejected because it expands scope and crosses module ownership.

### 9. Do not implement OpenClaw runtime manifest construction in this change

Agent Management exposes agent configuration and `skill.md` artifacts. Task Orchestration should later build an OpenClaw runtime manifest from Agent, Tools, and KB public boundaries when a task runs.

Rationale:

- Task execution and cancellation are owned by Task Orchestration.
- Agent Management should not call OpenClaw directly.
- Runtime manifests need permission checks at task execution time, not only at agent creation time.

Alternative considered: write all tools/KB/model context into the OpenClaw workspace during agent creation. Rejected as the execution source of truth because it can drift when permissions change.

### 10. Phase implementation to limit context and risk

Implementation should proceed in small phase branches/PRs:

1. Skill artifact renderer, preview, download, and basic import shell.
2. Static model catalog and model validation.
3. Template draft modal and preview UX.
4. LLM provider chain and prompt-to-draft flow.
5. Free-form `skill.md` import through LLM extraction.
6. Tool/KB mock catalog validation and blocking warnings.
7. E2E/manual verification and teammate handoff documentation.

Each phase must include focused tests before marking tasks complete.

## Risks / Trade-offs

- [Risk] LLM providers are unavailable or rate-limited during demo -> Mitigation: Gemini/OpenRouter fallback chain, clear retry UI, provider failure tests, and no partial draft mutation when all providers fail.
- [Risk] Real provider free tiers change over time -> Mitigation: keep provider names and models environment-configurable, document required env vars, and avoid hardcoding provider secrets.
- [Risk] LLM output contains invalid or unsafe content -> Mitigation: strict structured parsing, field validation, workspace catalog validation, and warning/blocking states before create.
- [Risk] Mock Tools/KB catalogs drift from teammate implementation -> Mitigation: keep adapters behind ports and write explicit handoff notes for the expected public API shape.
- [Risk] Model catalog introduces shared contract churn -> Mitigation: start with minimal caller-safe DTOs and focused contract tests; keep provider credentials and billing outside the DTO.
- [Risk] The guided modal becomes too large for one implementation pass -> Mitigation: phase work so template, LLM, import, and validation screens can land incrementally.
- [Risk] Users misunderstand `skill.md` as permission authority -> Mitigation: UI labels and validation warnings should make clear that tool/knowledge availability must be connected/ready in the workspace.
- [Risk] Current branch is behind `origin/master` -> Mitigation: recheck and fast-forward from latest `master` before implementation begins.

## Migration Plan

1. Add new assistant/spec DTOs and contract tests without breaking existing Agent Management APIs.
2. Add new API routes in parallel with existing lifecycle routes.
3. Add model catalog validation while preserving existing persisted `model` string storage unless a later phase explicitly changes schema.
4. Replace create-modal free-text model entry with catalog dropdown once backend catalog route is available.
5. Add guided creation entry points without removing the existing manual create flow until the assistant flow passes tests.
6. Add LLM provider configuration through environment variables only; do not store provider secrets in frontend or public DTOs.
7. Add mock Tools/KB catalogs and handoff docs before integrating real teammate APIs.

Rollback is straightforward by hiding guided assistant UI routes and reverting new Agent Management routes/adapters; existing lifecycle APIs and persisted agent records remain compatible.

## Resolved Questions

- The class demo should configure `GEMINI_MODEL_ID=gemini-2.5-flash` and `OPENROUTER_MODEL_ID=openrouter/owl-alpha`, with environment overrides allowed for provider churn.
- The final implementation should include `docs/api/agent-management-tools-kb-handoff.md`; PR notes should only summarize and link to the committed handoff file.
- Real Tools/KB catalog reads should become a follow-up Agent Management integration through public APIs. Real assignment/grant mutation should remain out of this change and only be added later through public Tools/KB APIs after module-owner approval.
