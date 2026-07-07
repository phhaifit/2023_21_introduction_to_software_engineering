import { Router, type Request, type Response } from "express";
import type { WorkspaceUserManagementService } from "../application/workspace-user-management-service.ts";
import { requireWorkspaceContext } from "../../../shared/auth/request-context.ts";
import { requirePermission } from "../../../shared/rbac/permissions.ts";
import { sendAuthApiSuccess, sendAuthApiFailure } from "../../authentication/api/api-response.ts";

export type WorkspaceUserManagementRouterDependencies = {
  service: WorkspaceUserManagementService;
};

export function createWorkspaceUserManagementRouter({
  service,
}: WorkspaceUserManagementRouterDependencies): Router {
  const router = Router({ mergeParams: true });

  router.get("/", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      const membersList = await service.listMembers(workspaceContext.workspaceId);
      sendAuthApiSuccess(req, res, membersList);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/invite", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");

      const body = req.body as any;
      if (!body.email || !body.role) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "email and role are required");
      }

      const user = (req as any).context?.user;
      if (!user || !user.email) {
        return sendAuthApiFailure(req, res, "auth.unauthorized", "User email not found in context");
      }

      const invitation = await service.inviteMember(
        workspaceContext.workspaceId,
        { email: body.email, role: body.role },
        user.userId,
        user.email
      );
      // Wait, invitedByUserId usually uses userId
      // I'll adjust to userId
      
      sendAuthApiSuccess(req, res, invitation);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.patch("/:targetUserId/role", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");

      const targetUserId = req.params.targetUserId;
      const body = req.body as any;
      if (!body.role) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "role is required");
      }

      await service.updateMemberRole(workspaceContext.workspaceId, targetUserId, body.role);
      sendAuthApiSuccess(req, res, { success: true });
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.delete("/:targetUserId", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "workspace:manage_members");

      const targetUserId = req.params.targetUserId;
      await service.removeMember(workspaceContext.workspaceId, targetUserId);
      sendAuthApiSuccess(req, res, { success: true });
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  return router;
}
