## ADDED Requirements

### Requirement: Authenticated Agent Management API Requests
The Agent Management frontend API client SHALL send authenticated requests by default for workspace-scoped Agent Management operations.

#### Scenario: Token is attached to list request
- **WHEN** an authenticated browser session has a persisted session token and the Agent Management page requests the agent list
- **THEN** the request includes the bearer token through the shared frontend authenticated request mechanism

#### Scenario: Token is attached to mutation request
- **WHEN** an authenticated browser session creates, updates, renames, duplicates, enables, disables, deletes, previews, imports, or drafts an agent
- **THEN** the request includes the bearer token through the shared frontend authenticated request mechanism

#### Scenario: Test transport remains injectable
- **WHEN** a test creates an Agent Management API client with an injected fetch implementation
- **THEN** the client uses the injected implementation so tests can verify request paths, headers, payloads, and response handling without relying on browser local storage

#### Scenario: Auth failure remains visible
- **WHEN** an authenticated request receives an `auth.unauthorized` or `auth.forbidden` API failure
- **THEN** the Agent Management client exposes the failure code, message, details, status, and API error kind to the page instead of treating it as successful data
