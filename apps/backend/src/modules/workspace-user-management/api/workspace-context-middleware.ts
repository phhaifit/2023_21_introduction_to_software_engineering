import type { Request, Response, NextFunction } from "express";
import type { WorkspaceUserManagementRepository } from "../domain/workspace-user-management-repository.ts";
import {
  sendWorkspaceUserManagementApiFailure as sendAuthApiFailure
} from "./api-response.ts";
import type { AuthenticatedUser, WorkspaceMembershipContext } from "../../../shared/auth/request-context.ts";

export function createWorkspaceContextMiddleware(repository: WorkspaceUserManagementRepository) {
  return async function workspaceContextMiddleware(
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    const context = (request as any).context as { user?: AuthenticatedUser; workspace?: WorkspaceMembershipContext } | undefined;
    const user = context?.user;

    if (!user) {
      sendAuthApiFailure(request, response, "auth.unauthorized", "Authentication required to access workspace.");
      return;
    }

    const workspaceId = request.params.workspaceId;
    if (!workspaceId || workspaceId === "invitations") {
      // If the route doesn't have workspaceId in params, or is the reserved 'invitations' route,
      // we can't or shouldn't resolve workspace context.
      next();
      return;
    }

    try {
      const member = await repository.getWorkspaceMember(workspaceId, user.userId);
      if (!member || !member.isAccepted) {
        sendAuthApiFailure(request, response, "auth.forbidden", "You are not an active member of this workspace.");
        return;
      }

      const role = (user.userId === 'local-dev-user' && request.headers["x-mock-role"])
        ? (request.headers["x-mock-role"] as any)
        : member.role;

      (request as any).context = {
        ...context,
        workspace: {
          workspaceId: member.workspaceId,
          memberId: member.memberId,
          role: role,
        }
      };
      
      next();
    } catch (err) {
      sendAuthApiFailure(request, response, "system.unexpected_error", "Failed to resolve workspace context.");
    }
  };
}
