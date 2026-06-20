import { Router, type Request, type Response } from "express";

import type { EntityId } from "../../../../../shared/contracts/ids.ts";
import {
  AgentLifecycleUseCases,
  AgentNotFoundError,
  AgentValidationError
} from "../application/agent-lifecycle-use-cases.ts";
import { sendAgentApiFailure, sendAgentApiSuccess } from "./api-response.ts";
import { createMockAgentManagementRequestContext } from "./mock-request-context.ts";

export type AgentManagementRouterDependencies = {
  useCases: AgentLifecycleUseCases;
};

export function createAgentManagementRouter(
  dependencies: AgentManagementRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  router.get("/", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = createMockAgentManagementRequestContext(request);

      return dependencies.useCases.listAgents(context.workspace!.workspaceId);
    });
  });

  router.post("/", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = createMockAgentManagementRequestContext(request);
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

  router.patch("/:agentId", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = createMockAgentManagementRequestContext(request);
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
      const context = createMockAgentManagementRequestContext(request);

      return dependencies.useCases.disableAgent(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
    });
  });

  router.post("/:agentId/enable", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = createMockAgentManagementRequestContext(request);

      return dependencies.useCases.enableAgent(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
    });
  });

  router.delete("/:agentId", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = createMockAgentManagementRequestContext(request);

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
