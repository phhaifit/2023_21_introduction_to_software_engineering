## 1. Domain and Interface Definition

- [x] 1.1 Define `Conversation` and `ChatMessage` domain models and `ConversationRepository` interface in `packages/shared/src/contracts/conversation.ts`
- [x] 1.2 Export new contracts from `packages/shared/src/index.ts`

## 2. Repository Implementation

- [x] 2.1 Implement `InMemoryConversationRepository` in `apps/backend/src/modules/task-orchestration/infrastructure/in-memory-conversation-repository.ts`
- [x] 2.2 Add unit tests for `InMemoryConversationRepository` in `apps/backend/src/modules/task-orchestration/infrastructure/in-memory-conversation-repository.test.ts`

## 3. Server Integration and Catalog Bridging

- [x] 3.1 Instantiate `InMemoryConversationRepository` in `apps/backend/src/local-agent-management-server.ts`
- [x] 3.2 Inject `InMemoryConversationRepository` into `OpenClawExecutionOrchestrator` to bridge active conversations with agent and workflow catalogs

## 4. Verification

- [x] 4.1 Run `npm test` to verify all unit tests pass
- [x] 4.2 Run `npm run build` to verify clean compilation
- [x] 4.3 Run `openspec validate "implement-in-memory-conversation-repository" --strict`
- [x] 4.4 Run `openspec validate --all --strict`
