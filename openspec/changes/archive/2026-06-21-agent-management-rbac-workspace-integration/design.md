## Context

Currently, the Agent Management module utilizes a `getMockContext` function to simulate the request environment, and it does not check whether a user has permissions (e.g. `agents:manage`) to perform lifecycle operations. Agents could theoretically be leaked across workspaces or modified by unauthorized users (e.g. Anonymous or Viewer roles).

## Goals / Non-Goals

**Goals:**
- Replace the mock context with the real `RequestContext` derived from incoming API requests.
- Enforce the `agents:manage` permission for create, update, enable, disable, and delete endpoints.
- Scope all repository operations strictly to the current `workspaceId`.
- Ensure appropriate HTTP error statuses (401 Unauthorized, 403 Forbidden) are returned when authentication or authorization fails.

**Non-Goals:**
- Designing the shared Authentication or Workspace module itself (we only consume its output/tokens).
- Changing the Prisma data models or schema (data isolation will be handled via application-level query scoping).

## Decisions

- **Enforce RBAC at the HTTP Boundary**: Instead of injecting authorization logic deep within the Use Cases, we will verify the `RequestContext` and its `permissions` array at the API router/controller level. This ensures unauthorized requests are rejected early with 401/403 errors, keeping the Use Cases focused purely on agent lifecycle rules.
- **Strict adherence to module boundaries**: Agent Management will not import private code from Authentication or Workspace modules. It will solely rely on standard `RequestContext` types or shared auth middlewares available via the common platform libraries.

## Risks / Trade-offs

- **Risk**: Test setups that rely on `getMockContext` will break if they don't supply necessary permissions.
  **Mitigation**: Update all HTTP API tests and Contract tests to inject valid `RequestContext` objects with `agents:manage` permission for mutation paths.
