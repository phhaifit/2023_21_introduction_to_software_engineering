import { Router, type Request, type Response } from "express";

import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowStatus } from "@vcp/shared/contracts/statuses.ts";
import { WorkflowUseCases } from "../application/workflow-use-cases.ts";
import { sendWorkflowApiFailure, sendWorkflowApiSuccess, sendWorkflowApiPaginatedSuccess } from "./api-response.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";
import { canPerform } from "../../../shared/rbac/permissions.ts";
import { WorkflowValidationError } from "../domain/workflow-validation.ts";

export type WorkflowManagementRouterDependencies = {
  useCases: WorkflowUseCases;
};

class AuthenticationError extends Error {}
class AuthorizationError extends Error {}
class WorkflowNotFoundError extends Error {}

function getRequestContext(request: Request): RequestContext {
  return (request as any).context || { requestId: "unknown" };
}

function enforceAuth(context: RequestContext) {
  if (!context.user) {
    throw new AuthenticationError("User is not authenticated");
  }
  if (!context.workspace) {
    throw new AuthorizationError("Workspace context required");
  }
}

function enforcePermission(context: RequestContext, permission: "workflows:manage") {
  enforceAuth(context);
  const role = context.workspace!.role;
  const decision = canPerform(role, permission);
  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason || "Forbidden");
  }
}

export function createWorkflowManagementRouter(
  dependencies: WorkflowManagementRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  router.get("/", async (request, response) => {
    await handleWorkflowApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforceAuth(context);

      const limit = Number(request.query.limit) || 50;
      const offset = Number(request.query.offset) || 0;

      const result = await dependencies.useCases.listWorkflows(context.workspace!.workspaceId, limit, offset);
      return sendWorkflowApiPaginatedSuccess(request, response, result.items, result.total, offset, limit);
    });
  });

  router.post("/", async (request, response) => {
    await handleWorkflowApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "workflows:manage");

      const payload = request.body || {};
      
      if (!payload.name || typeof payload.name !== "string") {
        throw new WorkflowValidationError(["name is required"]);
      }

      if (payload.steps && !Array.isArray(payload.steps)) {
        throw new WorkflowValidationError(["steps must be an array"]);
      }

      const result = await dependencies.useCases.createWorkflow({
        workspaceId: context.workspace!.workspaceId,
        name: payload.name,
        steps: payload.steps || []
      });

      sendWorkflowApiSuccess(request, response, result);
    });
  });

  router.get("/:workflowId", async (request, response) => {
    await handleWorkflowApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforceAuth(context);

      const result = await dependencies.useCases.getWorkflow(
        context.workspace!.workspaceId,
        request.params.workflowId as EntityId<"workflowId">
      );

      if (!result) {
        throw new WorkflowNotFoundError();
      }

      sendWorkflowApiSuccess(request, response, result);
    });
  });

  router.patch("/:workflowId", async (request, response) => {
    await handleWorkflowApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "workflows:manage");

      const payload = request.body || {};

      try {
        const result = await dependencies.useCases.updateWorkflow({
          workspaceId: context.workspace!.workspaceId,
          workflowId: request.params.workflowId as EntityId<"workflowId">,
          name: payload.name,
          status: payload.status,
          steps: payload.steps
        });

        sendWorkflowApiSuccess(request, response, result);
      } catch (err: any) {
        if (err.message === "Workflow not found") {
          throw new WorkflowNotFoundError();
        }
        throw err;
      }
    });
  });

  router.post("/:workflowId/execute", async (request, response) => {
    await handleWorkflowApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "workflows:manage");

      const payload = request.body || {};

      try {
        await dependencies.useCases.executeWorkflow({
          workspaceId: context.workspace!.workspaceId,
          workflowId: request.params.workflowId as EntityId<"workflowId">,
          triggeredBy: context.user!.userId,
          inputData: payload.inputData
        });

        // 202 Accepted because execution is handed off asynchronously
        response.status(202).json({
          ok: true,
          data: { status: "handed-off" }
        });
      } catch (err: any) {
        if (err.message === "Workflow not found") {
          throw new WorkflowNotFoundError();
        }
        if (err.message === "Cannot execute inactive workflow" || err.message === "Cannot execute workflow with no steps") {
          return sendWorkflowApiFailure(request, response, {
            statusCode: 400,
            code: "validation_error",
            message: err.message
          });
        }
        throw err;
      }
    });
  });

  router.delete("/:workflowId", async (request, response) => {
    await handleWorkflowApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "workflows:manage");

      try {
        await dependencies.useCases.deleteWorkflow(
          context.workspace!.workspaceId,
          request.params.workflowId as EntityId<"workflowId">
        );
        response.status(204).send();
      } catch (err: any) {
        if (err.message === "Workflow not found") {
          throw new WorkflowNotFoundError();
        }
        throw err;
      }
    });
  });

  return router;
}

async function handleWorkflowApiRequest(
  request: Request,
  response: Response,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      sendWorkflowApiFailure(request, response, {
        code: "auth.unauthorized",
        message: error.message,
        statusCode: 401
      });
      return;
    }

    if (error instanceof AuthorizationError) {
      sendWorkflowApiFailure(request, response, {
        code: "auth.forbidden",
        message: error.message,
        statusCode: 403
      });
      return;
    }

    if (error instanceof WorkflowValidationError) {
      sendWorkflowApiFailure(request, response, {
        code: "validation.invalid_input",
        message: error.message,
        details: { issues: error.issues },
        statusCode: 400
      });
      return;
    }

    if (error instanceof WorkflowNotFoundError) {
      sendWorkflowApiFailure(request, response, {
        code: "resource.not_found",
        message: "Workflow not found in this workspace.",
        statusCode: 404
      });
      return;
    }

    sendWorkflowApiFailure(request, response, {
      code: "system.unexpected_error",
      message: error?.message || "Unexpected Workflow API error.",
      statusCode: 500
    });
  }
}
