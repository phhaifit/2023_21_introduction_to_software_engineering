import { Router, type Request, type Response } from "express";

import type { EntityId } from "../../../../../shared/contracts/ids.ts";
import {
  AgentLifecycleUseCases,
  AgentNotFoundError,
  AgentValidationError
} from "../application/agent-lifecycle-use-cases.ts";
import { sendAgentApiFailure, sendAgentApiSuccess } from "./api-response.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";
import { canPerform } from "../../../shared/rbac/permissions.ts";
export type AgentManagementRouterDependencies = {
  useCases: AgentLifecycleUseCases;
};

class AuthenticationError extends Error {}
class AuthorizationError extends Error {}

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

function enforcePermission(context: RequestContext, permission: "agents:manage") {
  enforceAuth(context);
  const role = context.workspace!.role;
  const decision = canPerform(role, permission);
  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason || "Forbidden");
  }
}

export function createAgentManagementRouter(
  dependencies: AgentManagementRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  router.get("/", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforceAuth(context);

      return dependencies.useCases.listAgents(context.workspace!.workspaceId);
    });
  });

  router.post("/", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      const payload = readStringPayload(request, ["name", "role", "model", "instructions"]);
      const result = await dependencies.useCases.createAgent({
        workspaceId: context.workspace!.workspaceId,
        name: payload.name,
        role: payload.role,
        model: payload.model,
        instructions: payload.instructions
      });

      return result.publicSummary;
    });
  });

  router.get("/:agentId/configuration", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforceAuth(context);

      return dependencies.useCases.getAgentConfiguration(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
    });
  });

  router.patch("/:agentId", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      const payload = readStringPayload(request, ["role", "model", "instructions"]);
      const result = await dependencies.useCases.updateAgent({
        workspaceId: context.workspace!.workspaceId,
        agentId: request.params.agentId as EntityId<"agentId">,
        role: payload.role,
        model: payload.model,
        instructions: payload.instructions
      });

      return result.publicSummary;
    });
  });

  router.post("/:agentId/disable", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      return dependencies.useCases.disableAgent(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
    });
  });

  router.post("/:agentId/enable", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      return dependencies.useCases.enableAgent(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
    });
  });

  router.delete("/:agentId", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      return dependencies.useCases.deleteAgent(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
    });
  });

  return router;
}

async function handleAgentApiRequest<T>(
  request: Request,
  response: Response,
  action: () => Promise<T>
): Promise<void> {
  try {
    const data = await action();
    sendAgentApiSuccess(request, response, data);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      sendAgentApiFailure(request, response, {
        code: "auth.unauthorized",
        message: error.message,
        statusCode: 401
      });
      return;
    }

    if (error instanceof AuthorizationError) {
      sendAgentApiFailure(request, response, {
        code: "auth.forbidden",
        message: error.message,
        statusCode: 403
      });
      return;
    }

    if (error instanceof AgentValidationError) {
      sendAgentApiFailure(request, response, {
        code: "validation.invalid_input",
        message: error.message,
        details: { issues: error.issues },
        statusCode: 400
      });
      return;
    }

    if (error instanceof AgentNotFoundError) {
      sendAgentApiFailure(request, response, {
        code: "agent.not_available",
        message: "Agent is not available in this workspace.",
        statusCode: 404
      });
      return;
    }

    sendAgentApiFailure(request, response, {
      code: "system.unexpected_error",
      message: "Unexpected Agent Management API error.",
      statusCode: 500
    });
  }
}

function readStringPayload<T extends string>(
  request: Request,
  fields: readonly T[]
): Record<T, string> {
  const payload = request.body as Record<string, unknown> | undefined;
  const values = {} as Record<T, string>;
  const issues: string[] = [];

  for (const field of fields) {
    const value = payload?.[field];

    if (typeof value !== "string") {
      issues.push(`${field} is required`);
      values[field] = "";
    } else {
      values[field] = value;
    }
  }

  if (issues.length > 0) {
    throw new AgentValidationError(issues);
  }

  return values;
}
