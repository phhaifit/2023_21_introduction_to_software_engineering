import { Router, type Request, type Response } from "express";

import type {
  AgentSkillKnowledgeReference,
  AgentSkillImportAnalysisRequest,
  AgentSkillPreviewRequest,
  AgentSkillToolReference
} from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  AgentLifecycleUseCases,
  AgentNotFoundError,
  AgentValidationError
} from "../application/agent-lifecycle-use-cases.ts";
import { LlmDraftingUnavailableError, LlmProviderFailure } from "../application/llm-agent-drafting-port.ts";
import { sendAgentApiFailure, sendAgentApiSuccess, sendAgentPaginatedApiSuccess } from "./api-response.ts";
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

      return dependencies.useCases.listAgents(context.workspace!.workspaceId, {
        search: request.query.search as string | undefined,
        status: request.query.status as string | undefined,
        sortBy: request.query.sortBy as string | undefined,
        sortOrder: request.query.sortOrder as ("asc" | "desc") | undefined,
        page: request.query.page ? parseInt(request.query.page as string, 10) : undefined,
        pageSize: request.query.pageSize ? parseInt(request.query.pageSize as string, 10) : undefined
      });
    });
  });

  router.post("/", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      const payload = readStringPayload(request, ["name", "role", "model", "instructions"]);
      const body = request.body as Record<string, unknown> | undefined;
      const result = await dependencies.useCases.createAgent({
        workspaceId: context.workspace!.workspaceId,
        name: payload.name,
        role: payload.role,
        model: payload.model,
        instructions: payload.instructions,
        responsibilities: readOptionalStringArray(body, "responsibilities"),
        operatingContext: readOptionalString(body, "operatingContext"),
        requestedTools: readOptionalToolReferences(body),
        requestedKnowledge: readOptionalKnowledgeReferences(body),
        constraints: readOptionalStringArray(body, "constraints"),
        escalationRules: readOptionalStringArray(body, "escalationRules"),
        exampleTasks: readOptionalStringArray(body, "exampleTasks")
      });

      return result.publicSummary;
    });
  });

  router.post("/skill-preview", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      return dependencies.useCases.previewSkillMarkdown(readSkillPreviewPayload(request));
    });
  });

  router.post("/assistant/draft", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      const payload = readStringPayload(request, ["prompt"]);
      return dependencies.useCases.generateAssistantDraft(context.workspace!.workspaceId, payload.prompt);
    });
  });

  router.post("/assistant/import-skill", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      return dependencies.useCases.analyzeSkillMarkdownImport(
        context.workspace!.workspaceId,
        readSkillImportPayload(request)
      );
    });
  });

  router.get("/models", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforceAuth(context);

      return dependencies.useCases.listAgentModels(context.workspace!.workspaceId);
    });
  });

  router.get("/:agentId/skill.md", async (request, response) => {
    await handleAgentMarkdownRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforceAuth(context);

      return dependencies.useCases.downloadAgentSkillMarkdown(
        context.workspace!.workspaceId,
        request.params.agentId as EntityId<"agentId">
      );
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
      const body = request.body as Record<string, unknown> | undefined;
      const result = await dependencies.useCases.updateAgent({
        workspaceId: context.workspace!.workspaceId,
        agentId: request.params.agentId as EntityId<"agentId">,
        role: payload.role,
        model: payload.model,
        instructions: payload.instructions,
        responsibilities: readOptionalStringArray(body, "responsibilities"),
        operatingContext: readOptionalString(body, "operatingContext"),
        requestedTools: readOptionalToolReferences(body),
        requestedKnowledge: readOptionalKnowledgeReferences(body),
        constraints: readOptionalStringArray(body, "constraints"),
        escalationRules: readOptionalStringArray(body, "escalationRules"),
        exampleTasks: readOptionalStringArray(body, "exampleTasks")
      });

      return result.publicSummary;
    });
  });

  router.patch("/:agentId/name", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      const payload = readStringPayload(request, ["name"]);
      const result = await dependencies.useCases.renameAgent({
        workspaceId: context.workspace!.workspaceId,
        agentId: request.params.agentId as EntityId<"agentId">,
        name: payload.name
      });

      return result.publicSummary;
    });
  });

  router.post("/:agentId/duplicate", async (request, response) => {
    await handleAgentApiRequest(request, response, async () => {
      const context = getRequestContext(request);
      enforcePermission(context, "agents:manage");

      const result = await dependencies.useCases.duplicateAgent({
        workspaceId: context.workspace!.workspaceId,
        agentId: request.params.agentId as EntityId<"agentId">
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

async function handleAgentMarkdownRequest(
  request: Request,
  response: Response,
  action: () => Promise<{ markdown: string; fileName: "skill.md"; agent: { name: string } }>
): Promise<void> {
  try {
    const artifact = await action();
    response
      .status(200)
      .setHeader("content-type", "text/markdown; charset=utf-8")
      .setHeader(
        "content-disposition",
        `attachment; filename="${toSafeSkillFileName(artifact.agent.name)}.skill.md"`
      )
      .send(artifact.markdown);
  } catch (error) {
    handleAgentApiError(request, response, error);
  }
}

async function handleAgentApiRequest<T>(
  request: Request,
  response: Response,
  action: () => Promise<T>
): Promise<void> {
  try {
    const data = await action();
    if (data && typeof data === "object" && "items" in data && "pagination" in data) {
      sendAgentPaginatedApiSuccess(request, response, (data as any).items, (data as any).pagination);
    } else {
      sendAgentApiSuccess(request, response, data);
    }
  } catch (error) {
    handleAgentApiError(request, response, error);
  }
}

function handleAgentApiError(request: Request, response: Response, error: unknown): void {
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

  if (error instanceof LlmDraftingUnavailableError) {
    sendAgentApiFailure(request, response, {
      code: "assistant.unavailable",
      message: error.message,
      details: { failures: error.failures },
      statusCode: 503
    });
    return;
  }

  if (error instanceof LlmProviderFailure) {
    sendAgentApiFailure(request, response, {
      code: "assistant.provider_failure",
      message: error.message,
      statusCode: 400
    });
    return;
  }

  if (error instanceof AgentValidationError) {
    sendAgentApiFailure(request, response, {
      code: "validation.invalid_input",
      message: error.message,
      details: { issues: error.issues, warnings: error.warnings },
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

function readSkillPreviewPayload(request: Request): AgentSkillPreviewRequest {
  const required = readStringPayload(request, ["name", "role", "model", "instructions"]);
  const payload = request.body as Record<string, unknown> | undefined;

  return {
    ...required,
    responsibilities: readOptionalStringArray(payload, "responsibilities"),
    operatingContext: readOptionalString(payload, "operatingContext"),
    requestedTools: readOptionalToolReferences(payload),
    requestedKnowledge: readOptionalKnowledgeReferences(payload),
    constraints: readOptionalStringArray(payload, "constraints"),
    escalationRules: readOptionalStringArray(payload, "escalationRules"),
    exampleTasks: readOptionalStringArray(payload, "exampleTasks")
  };
}

function readSkillImportPayload(request: Request): AgentSkillImportAnalysisRequest {
  const required = readStringPayload(request, ["markdown"]);
  const payload = request.body as Record<string, unknown> | undefined;

  return {
    markdown: required.markdown,
    fileName: readOptionalString(payload, "fileName")
  };
}

function readOptionalString(
  payload: Record<string, unknown> | undefined,
  field: string
): string | undefined {
  const value = payload?.[field];
  return typeof value === "string" ? value : undefined;
}

function readOptionalStringArray(
  payload: Record<string, unknown> | undefined,
  field: string
): string[] | undefined {
  const value = payload?.[field];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function readOptionalToolReferences(
  payload: Record<string, unknown> | undefined
): AgentSkillToolReference[] | undefined {
  const values = payload?.requestedTools;
  if (!Array.isArray(values)) {
    return undefined;
  }

  return values
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      toolId: typeof item.toolId === "string" ? (item.toolId as EntityId<"toolId">) : undefined,
      name: typeof item.name === "string" ? item.name : "",
      reason: typeof item.reason === "string" ? item.reason : undefined
    }));
}

function readOptionalKnowledgeReferences(
  payload: Record<string, unknown> | undefined
): AgentSkillKnowledgeReference[] | undefined {
  const values = payload?.requestedKnowledge;
  if (!Array.isArray(values)) {
    return undefined;
  }

  return values
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      documentId:
        typeof item.documentId === "string" ? (item.documentId as EntityId<"documentId">) : undefined,
      title: typeof item.title === "string" ? item.title : "",
      reason: typeof item.reason === "string" ? item.reason : undefined
    }));
}

function toSafeSkillFileName(agentName: string): string {
  const safeName = agentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return safeName || "agent";
}
