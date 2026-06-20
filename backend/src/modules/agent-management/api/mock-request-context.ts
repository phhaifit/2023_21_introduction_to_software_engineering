import type { Request } from "express";

import type { RequestContext } from "../../../shared/auth/request-context.ts";
import type { EntityId } from "../../../../../shared/contracts/ids.ts";

export function createMockAgentManagementRequestContext(request: Request): RequestContext {
  const workspaceId = request.params.workspaceId as EntityId<"workspaceId">;

  return {
    requestId: request.header("x-request-id") ?? "agent-management-request",
    user: {
      userId: "mock-agent-manager" as EntityId<"userId">,
      email: "agent.manager@example.test",
      displayName: "Mock Agent Manager"
    },
    workspace: {
      workspaceId,
      memberId: "mock-agent-member" as EntityId<"memberId">,
      role: "admin"
    }
  };
}
