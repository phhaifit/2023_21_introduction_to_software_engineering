## Purpose

Define the platform API route matrix, route ownership, common HTTP boundary rules, workspace scoping expectations, auth requirements, request/response contract references, and shared error expectations.

## Requirements

### Requirement: Common API Route Boundary Rules
The platform SHALL define common API route rules before module teams implement additional public endpoints.

#### Scenario: API route uses platform prefix
- **WHEN** a module adds a public backend HTTP route
- **THEN** the route SHALL start with `/api`
- **AND** the route SHALL identify the owning module in the API contract matrix
- **AND** the route SHALL reference the shared `ApiResponse` envelope or a documented module-specific exception

#### Scenario: Workspace-scoped route uses tenant locator
- **WHEN** a route manages workspace-owned data such as members, agents, tools, workflows, tasks, documents, or runtime metadata
- **THEN** the route SHALL use `/api/workspaces/:workspaceId/...`
- **AND** the request body SHALL NOT accept trusted tenant fields such as `workspaceId`, `userId`, `submittedByUserId`, generated identifiers, lifecycle status, timestamps, or infrastructure fields
- **AND** the API adapter SHALL derive trusted tenant and user context from route parameters and authenticated request context

#### Scenario: Protected route documents auth and error behavior
- **WHEN** a route requires authentication or workspace membership
- **THEN** the API contract matrix SHALL document the auth requirement
- **AND** unauthenticated requests SHALL use a shared unauthorized error expectation
- **AND** authenticated requests without required permission SHALL use a shared forbidden error expectation

#### Scenario: List route documents pagination expectation
- **WHEN** a route returns a list that can grow beyond one page
- **THEN** the API contract matrix SHALL document whether the response uses shared pagination metadata
- **AND** module implementations SHALL NOT invent an incompatible pagination envelope

### Requirement: API Contract Matrix
The platform SHALL maintain a reviewed API contract matrix that lists each planned or existing public route, method, owner module, auth requirement, workspace scoping rule, request contract reference, response contract reference, and implementation status.

#### Scenario: Authentication API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `POST /api/auth/register` owned by Authentication
- **AND** it SHALL include `POST /api/auth/login` owned by Authentication
- **AND** it SHALL include `POST /api/auth/logout` owned by Authentication
- **AND** it SHALL include `GET /api/auth/me` owned by Authentication
- **AND** Authentication routes SHALL document whether each route is public or authenticated

#### Scenario: Workspace API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `GET /api/workspaces` owned by Workspace Management
- **AND** it SHALL include `POST /api/workspaces` owned by Workspace Management
- **AND** it SHALL include `GET /api/workspaces/:workspaceId` owned by Workspace Management
- **AND** it SHALL include `DELETE /api/workspaces/:workspaceId` owned by Workspace Management
- **AND** workspace creation and deletion routes SHALL document async OpenClaw worker or runtime handoff expectations

#### Scenario: Workspace Members API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `GET /api/workspaces/:workspaceId/members` owned by Workspace User Management
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/invitations` owned by Workspace User Management
- **AND** it SHALL include `PATCH /api/workspaces/:workspaceId/members/:memberId` owned by Workspace User Management
- **AND** it SHALL include `DELETE /api/workspaces/:workspaceId/members/:memberId` owned by Workspace User Management
- **AND** member mutation routes SHALL document admin or role-based permission expectations

#### Scenario: Agent API boundaries are confirmed
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include implemented Agent Management routes under `/api/workspaces/:workspaceId/agents`
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/agents`
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/agents`
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/agents/:agentId/configuration`
- **AND** it SHALL include `PATCH /api/workspaces/:workspaceId/agents/:agentId`
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/agents/:agentId/enable`
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/agents/:agentId/disable`
- **AND** it SHALL include `DELETE /api/workspaces/:workspaceId/agents/:agentId`
- **AND** each Agent route SHALL document response envelope consistency and public-summary exposure rules

#### Scenario: Subscription API boundaries are confirmed
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include existing Subscription & Payment routes under `/api/subscriptions`
- **AND** it SHALL include `GET /api/subscriptions/details`
- **AND** it SHALL include `POST /api/subscriptions/checkout`
- **AND** it SHALL include `POST /api/subscriptions/upgrade`
- **AND** it SHALL include `POST /api/subscriptions/mock-callback`
- **AND** these routes SHALL be marked as existing or provisional until they align with the shared `ApiResponse` envelope

#### Scenario: Tools API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `GET /api/workspaces/:workspaceId/tools/catalog` owned by Tools & Integration
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/tools/integrations` owned by Tools & Integration
- **AND** it SHALL include `PATCH /api/workspaces/:workspaceId/tools/integrations/:integrationId/credentials` owned by Tools & Integration
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/tools/assignments` owned by Tools & Integration
- **AND** it SHALL include `DELETE /api/workspaces/:workspaceId/tools/assignments/:assignmentId` owned by Tools & Integration
- **AND** credential routes SHALL document that raw secrets are never returned in API responses

#### Scenario: Workflow API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `GET /api/workspaces/:workspaceId/workflows` owned by Workflow Management
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/workflows` owned by Workflow Management
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/workflows/:workflowId` owned by Workflow Management
- **AND** it SHALL include `PATCH /api/workspaces/:workspaceId/workflows/:workflowId` owned by Workflow Management
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/workflows/:workflowId/publish` owned by Workflow Management
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/workflows/:workflowId/archive` owned by Workflow Management
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/workflows/:workflowId/execution-requests` owned by Workflow Management
- **AND** execution request routes SHALL document the handoff to Task & Orchestration or worker processing

#### Scenario: Task API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `POST /api/workspaces/:workspaceId/tasks` owned by Task & Orchestration
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/tasks/:taskId` owned by Task & Orchestration
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/tasks/:taskId/cancel` owned by Task & Orchestration
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/tasks/:taskId/runs` owned by Task & Orchestration
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/tasks/:taskId/logs` owned by Task & Orchestration
- **AND** task creation SHALL document that workspace and submitter identity come from route and authenticated request context rather than the request body

#### Scenario: Knowledge API boundaries are defined
- **WHEN** the matrix is reviewed
- **THEN** it SHALL include `GET /api/workspaces/:workspaceId/knowledge/documents` owned by Knowledge Base / RAG
- **AND** it SHALL include `DELETE /api/workspaces/:workspaceId/knowledge/documents/:documentId` owned by Knowledge Base / RAG
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/knowledge/uploads/validate` owned by Knowledge Base / RAG
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/knowledge/uploads/prepare` owned by Knowledge Base / RAG
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/knowledge/ingestion-jobs` owned by Knowledge Base / RAG
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/knowledge/data-sources` owned by Knowledge Base / RAG
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect` owned by Knowledge Base / RAG
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/knowledge/sync-scope` owned by Knowledge Base / RAG
- **AND** it SHALL include `PUT /api/workspaces/:workspaceId/knowledge/sync-scope` owned by Knowledge Base / RAG
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/knowledge/sync-jobs` owned by Knowledge Base / RAG
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/knowledge/sync-jobs` owned by Knowledge Base / RAG
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/knowledge/retrieval/search` owned by Knowledge Base / RAG
- **AND** it SHALL include `GET /api/workspaces/:workspaceId/knowledge/agents/:agentId/documents` owned by Knowledge Base / RAG
- **AND** it SHALL include `POST /api/workspaces/:workspaceId/knowledge/agents/:agentId/documents/:documentId` owned by Knowledge Base / RAG
- **AND** it SHALL include `DELETE /api/workspaces/:workspaceId/knowledge/agents/:agentId/documents/:documentId` owned by Knowledge Base / RAG
- **AND** document ingestion and sync routes SHALL document worker handoff expectations
- **AND** KB/RAG request bodies SHALL NOT accept trusted workspace, actor/user, generated ID, lifecycle status, timestamp, private storage, raw credential, vector database, embedding payload, or queue fields

### Requirement: Matrix Verification
The platform SHALL include lightweight verification for the API route matrix without requiring every route to be implemented.

#### Scenario: Matrix coverage is checked
- **WHEN** contract tests run
- **THEN** they SHALL verify that the API matrix exists
- **AND** they SHALL verify that every module from the ownership guide has at least one route boundary entry
- **AND** they SHALL verify that common API rules are documented
- **AND** they SHALL verify that existing Agent Management and Subscription & Payment routes are represented with their current status

#### Scenario: Verification does not imply implementation
- **WHEN** a route is marked as `planned` in the matrix
- **THEN** contract tests SHALL NOT require a backend router or live server behavior for that route
- **AND** implementation tests SHALL remain the responsibility of the owning module's OpenSpec change
