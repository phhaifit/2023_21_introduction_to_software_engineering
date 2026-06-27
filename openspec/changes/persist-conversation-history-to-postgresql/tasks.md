## 1. Database Schema and Persistence

- [x] 1.1 Add `Conversation` and `ChatMessage` models to `packages/database/prisma/schema.prisma`
- [x] 1.2 Run `npm run prisma -- db push` to synchronize PostgreSQL database schema
- [x] 1.3 Implement `PrismaConversationRepository` in `apps/backend/src/modules/task-orchestration/infrastructure/prisma-conversation-repository.ts`
- [x] 1.4 Add unit tests for `PrismaConversationRepository` in `apps/backend/src/modules/task-orchestration/infrastructure/prisma-conversation-repository.test.ts`

## 2. Server Runtime and API Endpoint

- [x] 2.1 Expose `GET /api/workspaces/:workspaceId/conversations` in `apps/backend/src/modules/task-orchestration/api/task-orchestration-router.ts`
- [x] 2.2 Update `local-agent-management-server.ts` to instantiate `PrismaConversationRepository` when `DATABASE_URL` is available (with fallback to `InMemoryConversationRepository`)

## 3. Frontend Integration

- [x] 3.1 Update frontend task orchestration API client to define `fetchConversations` method
- [x] 3.2 Update frontend task chat workspace UI to call `fetchConversations` on mount and restore conversation history

## 4. Verification

- [x] 4.1 Run `npm test` to verify all unit tests pass
- [x] 4.2 Run `npm run build` to verify clean compilation
- [x] 4.3 Run `openspec validate "persist-conversation-history-to-postgresql" --strict`
- [x] 4.4 Run `openspec validate --all --strict`
