## Context

The current task orchestration chat workspace stores active conversations using `InMemoryConversationRepository`. While this is suitable for isolated unit testing, it results in complete data loss whenever the server restarts or the user refreshes the browser page. To ensure long-term usability and seamless workflows across development sessions, conversation history must be persisted to the PostgreSQL database using Prisma.

## Goals / Non-Goals

**Goals:**
- Extend the Prisma database schema with `Conversation` and `ChatMessage` entities.
- Build `PrismaConversationRepository` implementing `ConversationRepository`.
- Expose `GET /api/workspaces/:workspaceId/conversations` in `task-orchestration-router.ts`.
- Wire `PrismaConversationRepository` into `local-agent-management-server.ts` with fallback to `InMemoryConversationRepository` if `DATABASE_URL` is missing.
- Enable the frontend task workspace UI to fetch initial conversation history upon mount.

**Non-Goals:**
- Modifying existing task execution orchestration logic or SSE streaming mechanisms.
- Changing the underlying authentication or workspace authorization rules.

## Decisions

- **Decision: Prisma Schema Models for Conversation and ChatMessage**
  - *Rationale*: Defining formal Prisma models ensures data integrity, foreign key relations, and automated migration generation. `Conversation` will store `associatedTarget` as JSONB, while `ChatMessage` will link to `Conversation` via `conversationId`.
  - *Alternatives Considered*: Storing conversation state as unstructured JSON in a generic key-value table. Rejected because it lacks schema validation and makes workspace-scoped queries less efficient.

- **Decision: Dual Repository Support in Server Runtime**
  - *Rationale*: Maintaining both `PrismaConversationRepository` and `InMemoryConversationRepository` ensures local development remains robust even without a PostgreSQL connection, adhering to established repository patterns in the project.

- **Decision: Workspace-Scoped Conversation Fetching API**
  - *Rationale*: Placing `GET /api/workspaces/:workspaceId/conversations` within `task-orchestration-router.ts` aligns with existing workspace-scoped execution routes and leverages the existing request context authentication.

## Risks / Trade-offs

- **Risk**: Schema migration failure or conflicts with existing tables.
  - *Mitigation*: Run `prisma db push` or create a definitive migration file to ensure clean table generation and verify with contract tests.
- **Risk**: Duplicate conversation fetching or UI race conditions on mount.
  - *Mitigation*: Ensure frontend state management checks for existing active conversations before overwriting state and handles loading indicators properly.
