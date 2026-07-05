import { Router, type Request, type Response } from "express";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { SUBSCRIPTION_PLANS } from "@vcp/shared/contracts/plans.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";
import { canPerform } from "../../../shared/rbac/permissions.ts";
import {
  WorkspaceUseCases,
  WorkspaceNotFoundError,
  WorkspaceAccessDeniedError,
  WorkspaceValidationError,
  WorkspaceCannotBeDeletedError
} from "../application/workspace-use-cases.ts";
import { sendWorkspaceSuccess, sendWorkspaceFailure } from "./api-response.ts";

// ---------------------------------------------------------------------------
// Auth helpers — mirrors pattern used in agent-management-router
// ---------------------------------------------------------------------------

class AuthenticationError extends Error {}
class AuthorizationError extends Error {}

function getRequestContext(req: Request): RequestContext {
  return (req as any).context ?? { requestId: "unknown" };
}

function enforceAuth(ctx: RequestContext): void {
  if (!ctx.user) throw new AuthenticationError("Not authenticated");
}

function enforceWorkspacePermission(ctx: RequestContext, perm: "workspace:delete"): void {
  enforceAuth(ctx);
  if (!ctx.workspace) throw new AuthorizationError("Workspace context required");
  const decision = canPerform(ctx.workspace.role, perm);
  if (!decision.allowed) throw new AuthorizationError(decision.reason ?? "Forbidden");
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createWorkspaceManagementRouter(useCases: WorkspaceUseCases): Router {
  const router = Router({ mergeParams: true });

  // GET /api/workspaces
  router.get("/", async (req: Request, res: Response) => {
    await handle(req, res, async () => {
      const ctx = getRequestContext(req);
      enforceAuth(ctx);
      const data = await useCases.listWorkspaces(ctx.user!.userId);
      sendWorkspaceSuccess(req, res, data);
    });
  });

  // POST /api/workspaces
  router.post("/", async (req: Request, res: Response) => {
    await handle(req, res, async () => {
      const ctx = getRequestContext(req);
      enforceAuth(ctx);

      const body = req.body as Record<string, unknown> | undefined;
      const name = typeof body?.name === "string" ? body.name : "";
      const plan = body?.plan as SubscriptionPlan | undefined;

      const issues: string[] = [];
      if (!name.trim()) issues.push("name is required");
      if (!plan || !SUBSCRIPTION_PLANS.includes(plan)) issues.push("plan must be one of: " + SUBSCRIPTION_PLANS.join(", "));
      if (issues.length > 0) throw new WorkspaceValidationError(issues);

      const data = await useCases.createWorkspace({
        userId: ctx.user!.userId,
        name,
        plan: plan!
      });
      sendWorkspaceSuccess(req, res, data, 201);
    });
  });

  // GET /api/workspaces/:workspaceId
  router.get("/:workspaceId", async (req: Request, res: Response) => {
    await handle(req, res, async () => {
      const ctx = getRequestContext(req);
      enforceAuth(ctx);
      const workspaceId = req.params.workspaceId as EntityId<"workspaceId">;
      const data = await useCases.getWorkspaceDetail(workspaceId, ctx.user!.userId);
      sendWorkspaceSuccess(req, res, data);
    });
  });

  // DELETE /api/workspaces/:workspaceId  (admin only — workspace:delete)
  router.delete("/:workspaceId", async (req: Request, res: Response) => {
    await handle(req, res, async () => {
      const ctx = getRequestContext(req);
      // Membership context is set by the auth middleware when the route includes
      // a workspaceId param. The permission check reads the role from context.
      enforceWorkspacePermission(ctx, "workspace:delete");
      const workspaceId = req.params.workspaceId as EntityId<"workspaceId">;
      const data = await useCases.deleteWorkspace(workspaceId, ctx.user!.userId);
      sendWorkspaceSuccess(req, res, data);
    });
  });

  return router;
}

// ---------------------------------------------------------------------------
// Shared error handler
// ---------------------------------------------------------------------------

async function handle(req: Request, res: Response, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    if (err instanceof AuthenticationError) {
      sendWorkspaceFailure(req, res, { code: "auth.unauthorized", message: err.message, statusCode: 401 });
    } else if (err instanceof AuthorizationError) {
      sendWorkspaceFailure(req, res, { code: "auth.forbidden", message: err.message, statusCode: 403 });
    } else if (err instanceof WorkspaceValidationError) {
      sendWorkspaceFailure(req, res, {
        code: "validation.invalid_input",
        message: err.message,
        statusCode: 400,
        details: { issues: err.issues }
      });
    } else if (err instanceof WorkspaceNotFoundError) {
      sendWorkspaceFailure(req, res, { code: "workspace.not_found", message: err.message, statusCode: 404 });
    } else if (err instanceof WorkspaceAccessDeniedError) {
      sendWorkspaceFailure(req, res, { code: "auth.forbidden", message: err.message, statusCode: 403 });
    } else if (err instanceof WorkspaceCannotBeDeletedError) {
      sendWorkspaceFailure(req, res, {
        code: "validation.invalid_input",
        message: err.message,
        statusCode: 409
      });
    } else {
      sendWorkspaceFailure(req, res, {
        code: "system.unexpected_error",
        message: "Unexpected Workspace Management error",
        statusCode: 500
      });
    }
  }
}
