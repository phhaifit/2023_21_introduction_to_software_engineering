## Why

When users refresh the task orchestration chat workspace, all active conversations and message history are lost because the application relies on an ephemeral `InMemoryConversationRepository` and client-side React state. To provide a robust, production-grade user experience, conversation history must be permanently stored in PostgreSQL and fetched by the frontend upon page load.

## What Changes

- Add `Conversation` and `ChatMessage` models to `packages/database/prisma/schema.prisma` to establish permanent storage schema.
- Implement `PrismaConversationRepository` in `apps/backend/src/modules/task-orchestration/infrastructure/prisma-conversation-repository.ts` to execute database queries via PrismaClient.
- Expose `GET /api/workspaces/:workspaceId/conversations` in `task-orchestration-router.ts` to return workspace-scoped conversation history.
- Update the server runtime initialization in `local-agent-management-server.ts` to instantiate `PrismaConversationRepository` when `DATABASE_URL` is available.
- Update the frontend task workspace UI to automatically fetch existing conversations when the chat component mounts.

## Capabilities

### New Capabilities
- `prisma-conversation-persistence`: Defines the Prisma schema models, repository implementation, and fallback handling for conversation persistence.

### Modified Capabilities
- `task-history`: Add database persistence requirement and define the new HTTP GET endpoint for fetching conversation history.
- `task-workspace`: Add requirement for the frontend UI to fetch and restore existing workspace conversation history upon mounting.

## Impact

- `packages/database/prisma/schema.prisma`: Schema changes requiring a database migration.
- `apps/backend/src/modules/task-orchestration/*`: Backend repository and API router updates.
- `apps/backend/src/local-agent-management-server.ts`: Server dependency injection wiring.
- `apps/frontend/src/*`: Frontend API client and conversation state restoration updates.
