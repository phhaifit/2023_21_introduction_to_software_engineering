## 1. Request Context Integration

- [x] 1.1 Use `RequestContext` middleware across Agent Management HTTP routes instead of `getMockContext`
- [x] 1.2 Extract `workspaceId` and user permissions from the incoming request context
- [x] 1.3 Ensure cross-workspace agent isolation (do not leak agents to other workspaces)

## 2. RBAC Enforcement

- [x] 2.1 Enforce `agents:manage` permission on agent mutations (create, update, enable, disable, delete)
- [x] 2.2 Reject mutations from Viewers with `403 Forbidden`
- [x] 2.3 Reject all requests from Anonymous users with `401 Unauthorized`
- [x] 2.4 Verify that Admin/Editor roles can mutate agents successfully

## 3. Testing and Validation

- [x] 3.1 Update HTTP API tests to inject valid/invalid permissions and assert authorization responses
- [x] 3.2 Run `npm test` to verify all tests pass
- [x] 3.3 Run `openspec validate "agent-management-rbac-workspace-integration"` to ensure compliance
