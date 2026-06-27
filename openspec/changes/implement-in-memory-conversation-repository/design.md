## Context

The Task & Orchestration module coordinates execution workflows within virtual company workspaces. Currently, active chat sessions and task execution streams are maintained within transient in-memory Map structures directly inside `OpenClawExecutionOrchestrator` and client-side React state. While functional for immediate streaming, this couples conversation tracking directly to the orchestrator's lifecycle and lacks a formal repository abstraction matching `InMemoryAgentRepository` and `InMemoryWorkflowRepository`.

## Goals / Non-Goals

**Goals:**
- Design a formal `ConversationRepository` interface and `InMemoryConversationRepository` implementation.
- Establish clean domain entities for `Conversation` and `ChatMessage` to structure chat history.
- Ensure seamless instantiation inside `apps/backend/src/local-agent-management-server.ts`.
- Bridge conversation context cleanly with live agent and workflow catalogs to verify execution targets.

**Non-Goals:**
- Implementing production PostgreSQL storage or modifying Prisma schema (`schema.prisma`).
- Altering the underlying Server-Sent Events (SSE) streaming protocol or OpenClaw execution network transport.

## Decisions

### 1. Dedicated `InMemoryConversationRepository`
- **Decision**: Implement `InMemoryConversationRepository` utilizing a private `Map<string, Conversation>` structure.
- **Rationale**: Decouples conversation history storage from `OpenClawExecutionOrchestrator`, providing clean repository ports and aligning with the established in-memory foundation.
- **Alternatives Considered**: Keeping state within `OpenClawExecutionOrchestrator` (rejected due to violation of single responsibility principle and lack of repository abstraction).

### 2. Domain Model Representation
- **Decision**: Define `Conversation` (housing `workspaceId`, `conversationId`, `title`, `createdAt`) and `ChatMessage` (housing `messageId`, `conversationId`, `role`, `content`, `timestamp`).
- **Rationale**: Provides clear domain typing for managing conversation history across the workspace.

## Risks / Trade-offs

- **Risk**: Ephemeral data loss upon server restart.
  - **Mitigation**: This is an intended trade-off for local development and testing efficiency, mirroring the behavior of `InMemoryAgentRepository`.
