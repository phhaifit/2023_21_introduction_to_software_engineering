## ADDED Requirements

### Requirement: Prisma Database Schema for Conversation Entities
The database schema SHALL define `Conversation` and `ChatMessage` models in `packages/database/prisma/schema.prisma` to establish permanent storage relations.

#### Scenario: Running Prisma migrations
- **WHEN** the Prisma schema is deployed or pushed
- **THEN** PostgreSQL tables `conversations` and `chat_messages` SHALL be created successfully with appropriate foreign keys and indices

### Requirement: Prisma Conversation Repository Implementation
The backend SHALL provide `PrismaConversationRepository` implementing the `ConversationRepository` contract to interact with PostgreSQL via PrismaClient.

#### Scenario: Executing repository operations
- **WHEN** `PrismaConversationRepository` methods are invoked
- **THEN** it SHALL execute corresponding PrismaClient queries to persist or retrieve conversation state from PostgreSQL
