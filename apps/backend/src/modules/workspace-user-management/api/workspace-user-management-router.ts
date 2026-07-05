import { Router, type Request, type Response } from "express";
import type { WorkspaceUserManagementService } from "../application/workspace-user-management-service.ts";
import { requireAuthenticatedUser, requireWorkspaceContext } from "../../../shared/auth/request-context.ts";
import { requirePermission } from "../../../shared/rbac/permissions.ts";
import {
  sendWorkspaceUserManagementApiFailure as sendAuthApiFailure,
  sendWorkspaceUserManagementApiSuccess as sendAuthApiSuccess
} from "./api-response.ts";

export type WorkspaceUserManagementRouterDependencies = {
  service: WorkspaceUserManagementService;
};

export function createWorkspaceUserManagementRouter({
  service,
}: WorkspaceUserManagementRouterDependencies): Router {
  const router = Router({ mergeParams: true });

  router.get("/members", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      const membersList = await service.listMembers(workspaceContext.workspaceId, workspaceContext.role);
      sendAuthApiSuccess(req, res, membersList);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.get("/events", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const workspaceContext = requireWorkspaceContext((req as any).context);
      const events = await service.listWorkspaceEvents(workspaceContext.workspaceId, user.userId);
      sendAuthApiSuccess(req, res, events);
    } catch (err: any) {
      if (err.message?.includes("access")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/admin-requests", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      const user = requireAuthenticatedUser((req as any).context);
      const request = await service.requestAdminRole(
        workspaceContext.workspaceId,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, request);
    } catch (err: any) {
      if (err.message?.includes("already") || err.message?.includes("not found")) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/admin-requests/:requestId/approve", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      const user = requireAuthenticatedUser((req as any).context);
      const request = await service.approveAdminRequest(
        workspaceContext.workspaceId,
        req.params.requestId,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, request);
    } catch (err: any) {
      if (err.message?.includes("Only Host")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message?.includes("not found")) {
        return sendAuthApiFailure(req, res, "member.not_found", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/admin-requests/:requestId/reject", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      const user = requireAuthenticatedUser((req as any).context);
      const request = await service.rejectAdminRequest(
        workspaceContext.workspaceId,
        req.params.requestId,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, request);
    } catch (err: any) {
      if (err.message?.includes("Only Host")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message?.includes("not found")) {
        return sendAuthApiFailure(req, res, "member.not_found", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/invitations", async (req: Request, res: Response) => {
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
        user.email,
        workspaceContext.role
      );
      
      sendAuthApiSuccess(req, res, invitation);
    } catch (err: any) {
      if (err.message?.includes("permission")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message?.includes("Invalid") || err.message?.includes("already") || err.message?.includes("invite yourself")) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.patch("/members/:memberId", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");

      const memberId = req.params.memberId;
      const body = req.body as any;
      if (!body.role) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "role is required");
      }

      const user = requireAuthenticatedUser((req as any).context);
      const member = await service.updateMemberRole(
        workspaceContext.workspaceId,
        memberId,
        body.role,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, member);
    } catch (err: any) {
      if (err.message?.includes("permission")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message === "Member not found.") {
        return sendAuthApiFailure(req, res, "member.not_found", err.message);
      }
      if (err.message?.includes("Invalid workspace role")) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", err.message);
      }
      if (err.message.includes("last admin")) {
        return sendAuthApiFailure(req, res, "workspace.conflict", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.delete("/members/:memberId", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");
      const user = requireAuthenticatedUser((req as any).context);

      const memberId = req.params.memberId;
      await service.removeMember(workspaceContext.workspaceId, memberId, user.userId, workspaceContext.role);
      sendAuthApiSuccess(req, res, { success: true });
    } catch (err: any) {
      if (err.message?.includes("permission")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message === "Member not found.") {
        return sendAuthApiFailure(req, res, "member.not_found", err.message);
      }
      if (err.message.includes("last admin")) {
        return sendAuthApiFailure(req, res, "workspace.conflict", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.patch("/invitations/:invitationId", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");
      const user = requireAuthenticatedUser((req as any).context);

      const invitationId = req.params.invitationId;
      const body = req.body as any;
      if (!body.role) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "role is required");
      }

      const invitation = await service.updateInvitationRole(
        workspaceContext.workspaceId,
        invitationId,
        body.role,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, invitation);
    } catch (err: any) {
      if (err.message?.includes("permission") || err.message?.includes("can only") || err.message?.includes("Only Host")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message?.includes("Invalid") || err.message?.includes("Pending invitation")) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.delete("/invitations/:invitationId", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");
      const user = requireAuthenticatedUser((req as any).context);

      await service.cancelInvitation(
        workspaceContext.workspaceId,
        req.params.invitationId,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, { success: true });
    } catch (err: any) {
      if (err.message?.includes("permission") || err.message?.includes("can only")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message?.includes("Pending invitation")) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/invitations/:invitationId/resend", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");
      const user = requireAuthenticatedUser((req as any).context);

      const invitation = await service.resendInvitation(
        workspaceContext.workspaceId,
        req.params.invitationId,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, invitation);
    } catch (err: any) {
      if (err.message?.includes("permission") || err.message?.includes("can only")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message?.includes("Pending invitation")) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/members/:memberId/transfer-host", async (req: Request, res: Response) => {
    try {
      const workspaceContext = requireWorkspaceContext((req as any).context);
      requirePermission((req as any).context, "members:manage");
      const user = requireAuthenticatedUser((req as any).context);

      const member = await service.transferHost(
        workspaceContext.workspaceId,
        req.params.memberId,
        user.userId,
        workspaceContext.role
      );
      sendAuthApiSuccess(req, res, member);
    } catch (err: any) {
      if (err.message?.includes("Only Host") || err.message?.includes("permission")) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      if (err.message === "Member not found." || err.message?.includes("Host membership")) {
        return sendAuthApiFailure(req, res, "member.not_found", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  return router;
}
