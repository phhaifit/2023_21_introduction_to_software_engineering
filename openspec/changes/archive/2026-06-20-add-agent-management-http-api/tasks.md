## 1. HTTP API Foundation

- [x] 1.1 Add Express-compatible API dependencies and backend test command wiring if missing
- [x] 1.2 Create Agent Management API response helpers for `ApiResponse` success and failure envelopes
- [x] 1.3 Create mock Agent Management request context boundary for workspace/current-user data
- [x] 1.4 Create Agent Management router factory with injectable lifecycle use cases
- [x] 1.5 Add route registration test proving `/api/workspaces/:workspaceId/agents` can be mounted

## 2. Listing API

- [x] 2.1 Implement `GET /api/workspaces/:workspaceId/agents`
- [x] 2.2 Add API test for listing enabled and disabled agents in the requested workspace
- [x] 2.3 Add API test proving deleted agents are omitted from the list

## 3. Creation API

- [x] 3.1 Implement `POST /api/workspaces/:workspaceId/agents`
- [x] 3.2 Add API test for creating a valid agent and returning a public summary
- [x] 3.3 Add API test for invalid create payload mapping to `validation.invalid_input`
- [x] 3.4 Add API test proving create uses the route workspace id

## 4. Update API

- [x] 4.1 Implement `PATCH /api/workspaces/:workspaceId/agents/:agentId`
- [x] 4.2 Add API test for updating role, model, and instructions
- [x] 4.3 Add API test for missing agent update mapping to `agent.not_available`

## 5. Activation and Deletion API

- [x] 5.1 Implement `POST /api/workspaces/:workspaceId/agents/:agentId/disable`
- [x] 5.2 Add API test for disabling an enabled agent
- [x] 5.3 Implement `POST /api/workspaces/:workspaceId/agents/:agentId/enable`
- [x] 5.4 Add API test for enabling a disabled agent
- [x] 5.5 Implement `DELETE /api/workspaces/:workspaceId/agents/:agentId`
- [x] 5.6 Add API test for deleting an agent and excluding it from later active lists

## 6. Error Mapping and Workspace Scope

- [x] 6.1 Map known lifecycle errors to shared `ApiResponse` error codes
- [x] 6.2 Add API test for validation error response envelope shape
- [x] 6.3 Add API test for cross-workspace access returning `agent.not_available`
- [x] 6.4 Add API test that unexpected errors return `system.unexpected_error`
- [x] 6.5 Ensure responses do not expose private `instructions` or generated skill configuration

## 7. Verification and Handoff

- [x] 7.1 Document the Agent Management API routes and mock-context limitation
- [x] 7.2 Run `npm test`
- [x] 7.3 Run `openspec validate "add-agent-management-http-api"`
- [x] 7.4 Run `openspec validate --all --strict`
- [x] 7.5 Run `git diff --check`
