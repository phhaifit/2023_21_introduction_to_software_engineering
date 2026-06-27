# Agent Management Creation Assistant Handoff

This handoff documents the Phase 9 verification and teammate integration
requirements for `enhance-agent-management-creation-assistant`.

## Provider Environment

Configure provider credentials only on the backend/server side. Do not expose
these values to frontend code, public DTOs, logs, PR descriptions, or committed
files.

Required for Gemini-backed assistant drafting:

```bash
GEMINI_API_KEY=<server-side secret>
GEMINI_MODEL_ID=gemini-2.5-flash
```

Required for OpenRouter fallback drafting:

```bash
OPENROUTER_API_KEY=<server-side secret>
OPENROUTER_MODEL_ID=openrouter/owl-alpha
```

`GEMINI_MODEL_ID` and `OPENROUTER_MODEL_ID` are optional overrides. When they
are omitted, Agent Management defaults to `gemini-2.5-flash` and
`openrouter/owl-alpha`.

Automated tests may inject deterministic mock provider behavior. User-facing
flows must not silently return mock drafts when Gemini and OpenRouter both fail;
they must show a retryable failure.

## Manual Browser Verification

Start the app from the repository root:

```bash
npm run dev
```

Use the frontend at `http://127.0.0.1:5173` and the backend API at
`http://127.0.0.1:3001`.

Verify model catalog and template draft:

1. Open Agent Management.
2. Click `New Agent`.
3. Confirm the model selector loads catalog models including
   `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `openrouter/owl-alpha`.
4. Fill template name, role, model, instructions, and optional sections.
5. Confirm `skill.md preview` renders the current draft.
6. Submit the draft and confirm the new agent appears as enabled in the list.

Verify LLM prompt assistant:

1. Open `New Agent` and select `Prompt Assistant`.
2. Submit a natural-language agent description.
3. Confirm loading state appears.
4. If a valid draft returns, click `Edit in Template`, review fields and
   `skill.md preview`, then create the agent.
5. If the provider chain fails, confirm the UI preserves user input and shows a
   retryable failure instead of creating a draft.

Verify `skill.md` import:

1. Open `New Agent` and select `Import skill.md`.
2. Paste or upload Markdown content with a role and instructions.
3. Click `Analyze skill.md`.
4. Confirm extracted draft fields are shown for review.
5. Confirm empty or non-Markdown content returns a validation error and does not
   create an agent.

Verify `skill.md` download:

1. Create or select an enabled or disabled agent.
2. Use the row action to download `skill.md`.
3. Confirm the downloaded Markdown reflects the current agent configuration.
4. Confirm deleted or cross-workspace agents cannot expose `skill.md` content.

Verify blocking warnings:

1. Create a draft that requests an unavailable tool or unready/missing
   knowledge reference.
2. Confirm the blocking warning is visible.
3. Confirm creation is blocked until the invalid request is removed or corrected.
4. Confirm Agent Management does not create tool assignments or knowledge
   grants during this flow.

Verify runtime profile reconstruction:

1. From a backend/dev console or focused test call, invoke
   `getAgentRuntimeProfile(workspaceId, agentId)` for an enabled agent.
2. Confirm the profile includes identity, workspace, enabled runnable status,
   model, role, instructions, runtime configuration sections, canonical
   `skill.md`, requested tool intent, requested knowledge intent, and
   materialization hints.
3. Confirm disabled, deleted, missing, and cross-workspace agents reject.
4. Confirm the profile does not contain credentials, raw provider payloads, raw
   provider errors, OpenClaw runtime URLs, container IDs, terminal commands,
   `agents.list[]` output, task manifests, real assignment IDs, or real grant
   IDs.

## Tools Integration Handoff

Agent Management currently validates requested tools through a replaceable
public catalog port. Tools Integration remains the authority for connected
tools, credentials, and agent-tool assignments.

Future public connected-tool catalog shape needed by Agent Management:

```ts
type ConnectedToolCatalogEntry = {
  toolId: EntityId<"toolId">;
  name: string;
  connected: boolean;
  available: boolean;
};

type ConnectedToolCatalogPort = {
  listConnectedTools(
    workspaceId: EntityId<"workspaceId">
  ): Promise<ConnectedToolCatalogEntry[]>;
};
```

Future assignment integration requirements:

- Agent Management may pass selected tool intent to a public Tools Integration
  API only after a separate OpenSpec change approves that mutation flow.
- Agent Management must not write `AgentToolAssignment` rows directly.
- Agent Management must not persist or return tool credentials, OAuth tokens,
  API keys, masked secrets, or provider-private configuration.
- Task Orchestration must resolve current tool permissions through Tools
  Integration before OpenClaw execution, because permissions can change after an
  agent is created.

## KB/RAG Handoff

Agent Management currently validates requested knowledge through a replaceable
public ready-document catalog port. KB/RAG remains the authority for documents,
indexing status, retrieval, and knowledge access grants.

Future public ready-knowledge catalog shape needed by Agent Management:

```ts
type KnowledgeDocumentCatalogEntry = {
  documentId: EntityId<"documentId">;
  title: string;
  ready: boolean;
  status: "ready" | "pending" | "ingesting" | "failed" | "unavailable";
};

type KnowledgeDocumentCatalogPort = {
  listKnowledgeDocuments(
    workspaceId: EntityId<"workspaceId">
  ): Promise<KnowledgeDocumentCatalogEntry[]>;
};
```

Future grant integration requirements:

- Agent Management may pass selected knowledge intent to a public KB/RAG grant
  API only after a separate OpenSpec change approves that mutation flow.
- Agent Management must not write `KnowledgeAccessGrant` rows directly.
- Agent Management must not return raw document storage paths, vector database
  internals, embedding payloads, queue internals, or private KB/RAG
  implementation details.
- Task Orchestration must resolve current knowledge grants through KB/RAG before
  OpenClaw execution, because document readiness and grants can change after an
  agent is created.

## OpenClaw and Task Orchestration Scope

Agent Management owns control-plane agent configuration, `skill.md` preview and
download, session-only draft review, model validation, capability-intent
validation, and a server-side runtime profile boundary.

Task Orchestration and OpenClaw integration remain responsible for:

- OpenClaw agent workspace materialization.
- `agents.list[]` synchronization.
- OpenClaw Gateway, CLI, HTTP, or terminal calls.
- Runtime manifest construction.
- Streaming, logs, cancellation, and task lifecycle projection.
- Resolving current tool assignments and KB/RAG grants before execution.
- Handling task cancellation when permissions are revoked.

Agent Management must not call OpenClaw directly, manage containers, persist
Gateway tokens, or build task manifests.
