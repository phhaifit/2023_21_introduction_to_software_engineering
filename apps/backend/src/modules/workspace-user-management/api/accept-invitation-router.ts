import { Router, type Request, type Response } from "express";
import type { WorkspaceUserManagementService } from "../application/workspace-user-management-service.ts";
import { requireAuthenticatedUser } from "../../../shared/auth/request-context.ts";
import {
  sendWorkspaceUserManagementApiFailure as sendAuthApiFailure,
  sendWorkspaceUserManagementApiSuccess as sendAuthApiSuccess
} from "./api-response.ts";

export type AcceptInvitationRouterDependencies = {
  service: WorkspaceUserManagementService;
};

export function createAcceptInvitationRouter({
  service,
}: AcceptInvitationRouterDependencies): Router {
  const router = Router();

  router.get("/pending", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      if (!user.email) {
        return sendAuthApiFailure(req, res, "auth.unauthorized", "User email not found in context");
      }
      const pending = await service.listPendingInvitationsForEmail(user.email);
      sendAuthApiSuccess(req, res, pending);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/:code/accept", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const code = req.params.code;
      if (!code) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "code is required");
      }

      const result = await service.acceptInvitation(code, user.userId, user.email);
      sendAuthApiSuccess(req, res, result);
    } catch (err: any) {
      if (err.message?.includes("Authenticated user required")) {
        return sendAuthApiFailure(req, res, "auth.unauthorized", "Authentication required.");
      }
      if (err.message?.includes("already a member")) {
        return sendAuthApiFailure(req, res, "workspace.conflict", err.message);
      }
      if (
        err.message?.includes("different email") ||
        err.message?.includes("Invalid invitation") ||
        err.message?.includes("Invitation expired") ||
        err.message?.includes("Invitation cancelled") ||
        err.message?.includes("Invitation already accepted")
      ) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/:code/reject", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const code = req.params.code;
      if (!code) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "code is required");
      }

      await service.rejectInvitation(code, user.email);
      sendAuthApiSuccess(req, res, { success: true });
    } catch (err: any) {
      if (err.message?.includes("Authenticated user required")) {
        return sendAuthApiFailure(req, res, "auth.unauthorized", "Authentication required.");
      }
      if (
        err.message?.includes("different email") ||
        err.message?.includes("Invalid invitation") ||
        err.message?.includes("Invitation expired") ||
        err.message?.includes("Invitation cancelled") ||
        err.message?.includes("Invitation already accepted")
      ) {
        return sendAuthApiFailure(req, res, "auth.forbidden", err.message);
      }
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  return router;
}
