## ADDED Requirements

### Requirement: Workspace-Scoped Conversation Fetching API Endpoint
The task orchestration API router SHALL expose `GET /api/workspaces/:workspaceId/conversations` to allow clients to fetch workspace-scoped conversation history.

#### Scenario: Client fetches conversation history
- **WHEN** an authenticated client issues a GET request to `/api/workspaces/:workspaceId/conversations`
- **THEN** the server SHALL query the underlying `conversationRepository` and return the matching conversation records in the standardized JSON envelope
