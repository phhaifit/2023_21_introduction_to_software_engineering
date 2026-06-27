## Why

During local development and testing, active chat sessions and task executions are currently maintained within ephemeral `Map` structures directly inside `OpenClawExecutionOrchestrator` and React state. To provide a robust, decoupled architecture that aligns with the established in-memory foundation (`InMemoryAgentRepository`, `InMemoryWorkflowRepository`), a dedicated `InMemoryConversationRepository` is needed to cleanly manage conversation history and bridge active chat sessions with live agent and workflow catalogs within the workspace context.

## What Changes

- Establish `Conversation` and `ChatMessage` domain representation within the Task & Orchestration module.
- Create `InMemoryConversationRepository` to manage in-memory persistence of chat sessions and message logs.
- Integrate `InMemoryConversationRepository` into `local-agent-management-server.ts` alongside existing in-memory repositories.
- Bridge active conversation workspaces with live agent and workflow catalogs to ensure consistent runtime reference resolution.

## Capabilities

### New Capabilities
- `in-memory-conversation-repository`: Defines the requirements, interface contracts, and in-memory storage mechanics for managing chat conversations and messages.

### Modified Capabilities
- `task-history`: Updates requirements to incorporate `InMemoryConversationRepository` as the canonical storage mechanism for conversation history during local development.
- `task-workspace`: Updates requirements to ensure active conversation sessions bridge cleanly with live agent and workflow catalogs within the workspace context.

## Impact

- `apps/backend/src/local-agent-management-server.ts`: Initialized with `InMemoryConversationRepository`.
- `apps/backend/src/modules/task-orchestration/*`: Integrated with conversation storage contracts.
- No impact on production PostgreSQL database schemas or Prisma migrations.
