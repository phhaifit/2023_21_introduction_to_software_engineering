## 1. Frontend Test and Runtime Foundation

- [x] 1.1 Add Vitest, jsdom, React Testing Library, and user-event dependencies and configuration for Agent Management component tests
- [x] 1.2 Add frontend component tests to the Agent Management test command without removing existing contract tests
- [x] 1.3 Add a shared demo workspace id at the app boundary for local API requests

## 2. Editable Configuration API

- [x] 2.1 Add an application use case and response type for reading enabled or disabled agent configuration within one workspace
- [x] 2.2 Add lifecycle tests for successful, missing, deleted, and cross-workspace configuration reads
- [x] 2.3 Implement `GET /api/workspaces/:workspaceId/agents/:agentId/configuration` with existing `ApiResponse` error mapping
- [x] 2.4 Add route tests proving instructions are returned only for the requested active agent and generated skill configuration is never exposed

## 3. Frontend API Client

- [x] 3.1 Add an injectable Agent Management API client with typed success data and typed API/network errors
- [x] 3.2 Implement and test workspace-scoped list requests and successful response-envelope parsing
- [x] 3.3 Implement and test create requests with name, role, model, and instructions payloads
- [x] 3.4 Implement and test configuration-read and update requests for the selected agent
- [x] 3.5 Implement and test enable, disable, and delete requests with correct HTTP methods and paths
- [x] 3.6 Add client tests for validation details, known API failures, malformed responses, and network failures

## 4. API-Backed List UI

- [x] 4.1 Refactor `AgentManagementPage` to receive `workspaceId` and API client dependencies and own server-backed agent state
- [x] 4.2 Implement initial list loading and add component tests for loading followed by enabled and disabled rows
- [x] 4.3 Add component tests for an empty active list without falling back to browser mock data
- [x] 4.4 Implement recoverable initial-load errors and add a component test for retrying the list request

## 5. Create Agent UI

- [x] 5.1 Connect create-form submission to the API client and prevent submission while a create request is pending
- [x] 5.2 Add a component test proving successful create refreshes the list and resets the form
- [x] 5.3 Map `validation.invalid_input` details to form feedback and add a test proving submitted values are preserved
- [x] 5.4 Add a component test proving unexpected create failures preserve form values, keep the current list, and prevent duplicate requests

## 6. Edit Agent UI

- [x] 6.1 Load editable configuration when Edit is selected and disable submission until the configuration request completes
- [x] 6.2 Add component tests for populated edit fields and `agent.not_available` configuration failures
- [x] 6.3 Connect edit-form submission to the update API without allowing agent name changes
- [x] 6.4 Add a component test proving successful update refreshes the list with the updated role and model
- [x] 6.5 Add a component test proving validation or unexpected update failures preserve edited values and prevent duplicate requests

## 7. Lifecycle Mutation UI

- [x] 7.1 Connect row Enable and Disable actions to the API client with mutation progress feedback
- [x] 7.2 Add component tests proving disable and enable each refresh the row status and available actions
- [x] 7.3 Connect Delete to explicit confirmation and refresh the active list after successful deletion
- [x] 7.4 Add component tests proving confirmed deletion removes the row and cancelled deletion sends no request
- [x] 7.5 Add a component test proving lifecycle failures keep the last loaded list, display a general error, and prevent duplicate requests

## 8. Local In-Memory Integration and Manual Verification

- [x] 8.1 Add a local Express composition root with one `InMemoryAgentRepository`, lifecycle dependencies, and representative seed agents
- [x] 8.2 Add Vite `/api` proxy configuration and one root development command that starts both frontend and local API processes
- [x] 8.3 Add an integration test proving local list and mutations share the same in-memory repository instance
- [x] 8.4 Remove mock data from the browser default while retaining mock fixtures for isolated tests and update app-shell contract coverage
- [x] 8.5 Update Agent Management documentation with startup commands, ports, reset behavior, and API-backed manual test steps
- [x] 8.6 Manually verify list, create, edit, disable, enable, delete, loading, and visible error behavior in the browser

## 9. Verification and Handoff

- [x] 9.1 Run `npm test`
- [x] 9.2 Run `npm run build`
- [x] 9.3 Run `openspec validate "connect-agent-management-ui-api"`
- [x] 9.4 Run `openspec validate --all --strict`
- [x] 9.5 Run `git diff --check`
- [x] 9.6 Document completed tests and explicitly list deferred Prisma, RBAC, production server, and Playwright scenarios in the handoff
