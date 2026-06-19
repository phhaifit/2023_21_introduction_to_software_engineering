import type { EntityId } from "../../../../shared/contracts";
import type { WorkspaceRole } from "../../../../shared/contracts";

export type AuthenticatedUser = {
  userId: EntityId<"userId">;
  email: string;
  displayName?: string;
};

export type WorkspaceMembershipContext = {
  workspaceId: EntityId<"workspaceId">;
  memberId: EntityId<"memberId">;
  role: WorkspaceRole;
};

export type RequestContext = {
  requestId: string;
  user?: AuthenticatedUser;
  workspace?: WorkspaceMembershipContext;
};

export function requireAuthenticatedUser(context: RequestContext): AuthenticatedUser {
  if (!context.user) {
    throw new Error("Authenticated user required");
  }

  return context.user;
}

export function requireWorkspaceContext(
  context: RequestContext
): WorkspaceMembershipContext {
  if (!context.workspace) {
    throw new Error("Workspace context required");
  }

  return context.workspace;
}
