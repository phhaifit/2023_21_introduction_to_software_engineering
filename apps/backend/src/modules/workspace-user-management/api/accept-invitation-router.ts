import { Router, type Request, type Response } from "express";
import type { WorkspaceUserManagementService } from "../application/workspace-user-management-service.ts";
import { sendAuthApiSuccess, sendAuthApiFailure } from "../../authentication/api/api-response.ts";
import { requireAuthenticatedUser } from "../../../shared/auth/request-context.ts";

export type AcceptInvitationRouterDependencies = {
  service: WorkspaceUserManagementService;
};

export function createAcceptInvitationRouter({
  service,
}: AcceptInvitationRouterDependencies): Router {
  const router = Router();

  router.post("/:code/accept", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const code = req.params.code;
      if (!code) {
        return sendAuthApiFailure(req, res, "validation.invalid_input", "code is required");
      }

      await service.acceptInvitation(code, user.userId);
      sendAuthApiSuccess(req, res, { success: true });
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  return router;
}
