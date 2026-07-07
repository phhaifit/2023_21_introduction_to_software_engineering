import { Router, type Request, type Response } from "express";
import type { WorkspaceUserManagementService } from "../application/workspace-user-management-service.ts";
import { sendAuthApiSuccess, sendAuthApiFailure } from "../../authentication/api/api-response.ts";
import { requireAuthenticatedUser } from "../../../shared/auth/request-context.ts";

export type WorkspaceListRouterDependencies = {
  service: WorkspaceUserManagementService;
};

export function createWorkspaceListRouter({
  service,
}: WorkspaceListRouterDependencies): Router {
  const router = Router();

  router.get("/invitations/pending", async (req: Request, res: Response) => {
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

  router.get("/", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const workspaces = await service.listAllWorkspacesWithAccess(user.userId);
      sendAuthApiSuccess(req, res, workspaces);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.post("/", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        sendAuthApiFailure(req, res, "validation.invalid_input", "Workspace name is required.");
        return;
      }
      const workspace = await service.createWorkspace(name.trim(), user.userId);
      sendAuthApiSuccess(req, res, workspace);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  router.get("/:workspaceId/events", async (req: Request, res: Response) => {
    try {
      const user = requireAuthenticatedUser((req as any).context);
      const workspaceId = req.params.workspaceId;
      const events = await service.listWorkspaceEvents(workspaceId, user.userId);
      sendAuthApiSuccess(req, res, events);
    } catch (err: any) {
      sendAuthApiFailure(req, res, "system.unexpected_error", err.message);
    }
  });

  return router;
}
