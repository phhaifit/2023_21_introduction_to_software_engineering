import type {
  AgentModelCatalogEntry,
  AgentPublicSummary,
  AgentSkillPreviewRequest,
  AgentSkillPreviewResponse,
  AgentCreationAssistantDraftRequest,
  AgentCreationAssistantDraftResponse,
  AgentSkillImportAnalysisRequest
} from "@vcp/shared/contracts/agent-management.ts";
import type { ApiPaginationMeta, ErrorCode } from "@vcp/shared/contracts/api.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";

export type AgentListItem = AgentPublicSummary & {
  createdAt: string;
};

export type AgentEditableConfiguration = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  instructions: string;
  status: Exclude<AgentStatus, "deleted">;
  updatedAt: string;
};

export type CreateAgentPayload = {
  name: string;
  role: string;
  model: string;
  instructions: string;
};

export type UpdateAgentPayload = Omit<CreateAgentPayload, "name">;

export type ListAgentsOptions = {
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type AgentManagementApiClient = {
  listAgents(
    workspaceId: EntityId<"workspaceId">,
    options?: ListAgentsOptions
  ): Promise<{ items: AgentListItem[]; pagination: ApiPaginationMeta }>;
  listAgentModels(
    workspaceId: EntityId<"workspaceId">
  ): Promise<AgentModelCatalogEntry[]>;
  previewSkillMarkdown(
    workspaceId: EntityId<"workspaceId">,
    payload: AgentSkillPreviewRequest
  ): Promise<AgentSkillPreviewResponse>;
  createAssistantDraft(
    workspaceId: EntityId<"workspaceId">,
    payload: AgentCreationAssistantDraftRequest
  ): Promise<AgentCreationAssistantDraftResponse>;
  analyzeSkillImport(
    workspaceId: EntityId<"workspaceId">,
    payload: AgentSkillImportAnalysisRequest
  ): Promise<AgentCreationAssistantDraftResponse>;
  createAgent(
    workspaceId: EntityId<"workspaceId">,
    payload: CreateAgentPayload
  ): Promise<AgentPublicSummary>;
  getAgentConfiguration(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentEditableConfiguration>;
  updateAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    payload: UpdateAgentPayload
  ): Promise<AgentPublicSummary>;
  renameAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    newName: string
  ): Promise<AgentPublicSummary>;
  duplicateAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary>;
  enableAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary>;
  disableAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary>;
  deleteAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary>;
};

export type AgentApiClientErrorKind = "api" | "network" | "malformed-response";

export class AgentApiClientError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status?: number;
  readonly kind: AgentApiClientErrorKind;

  constructor(input: {
    message: string;
    code?: ErrorCode;
    details?: Record<string, unknown>;
    status?: number;
    kind: AgentApiClientErrorKind;
  }) {
    super(input.message);
    this.name = "AgentApiClientError";
    this.code = input.code ?? "system.unexpected_error";
    this.details = input.details;
    this.status = input.status;
    this.kind = input.kind;
  }
}

type FetchImplementation = typeof fetch;

export function createAgentManagementApiClient(input: {
  fetchImplementation?: FetchImplementation;
  baseUrl?: string;
} = {}): AgentManagementApiClient {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const baseUrl = input.baseUrl?.replace(/\/$/, "") ?? "";

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers
        }
      });
    } catch {
      throw new AgentApiClientError({
        message: "Unable to reach the Agent Management API.",
        kind: "network"
      });
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw malformedResponse(response.status);
    }

    if (!isRecord(body) || typeof body.ok !== "boolean") {
      throw malformedResponse(response.status);
    }

    if (body.ok === false) {
      const error = body.error;

      if (!isRecord(error) || typeof error.code !== "string" || typeof error.message !== "string") {
        throw malformedResponse(response.status);
      }

      throw new AgentApiClientError({
        code: error.code as ErrorCode,
        message: error.message,
        details: isRecord(error.details) ? error.details : undefined,
        status: response.status,
        kind: "api"
      });
    }

    if (!("data" in body) || !("meta" in body)) {
      throw malformedResponse(response.status);
    }

    return { data: body.data as T, meta: body.meta as any };
  }

  function collectionPath(workspaceId: EntityId<"workspaceId">): string {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/agents`;
  }

  function agentPath(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): string {
    return `${collectionPath(workspaceId)}/${encodeURIComponent(agentId)}`;
  }

  return {
    listAgents: async (workspaceId, options) => {
      const query = new URLSearchParams();
      if (options?.search) query.set("search", options.search);
      if (options?.status) query.set("status", options.status);
      if (options?.sortBy) query.set("sortBy", options.sortBy);
      if (options?.sortOrder) query.set("sortOrder", options.sortOrder);
      if (options?.page) query.set("page", options.page.toString());
      if (options?.pageSize) query.set("pageSize", options.pageSize.toString());

      const qs = query.toString();
      const path = qs ? `${collectionPath(workspaceId)}?${qs}` : collectionPath(workspaceId);

      const response = await request<AgentListItem[]>(path);
      return {
        items: response.data,
        pagination: response.meta.pagination
      };
    },
    listAgentModels: async (workspaceId) =>
      (await request<AgentModelCatalogEntry[]>(`${collectionPath(workspaceId)}/models`)).data,
    previewSkillMarkdown: async (workspaceId, payload) =>
      (await request<AgentSkillPreviewResponse>(`${collectionPath(workspaceId)}/skill-preview`, {
        method: "POST",
        body: JSON.stringify(payload)
      })).data,
    createAssistantDraft: async (workspaceId, payload) =>
      (await request<AgentCreationAssistantDraftResponse>(`${collectionPath(workspaceId)}/assistant/draft`, {
        method: "POST",
        body: JSON.stringify(payload)
      })).data,
    analyzeSkillImport: async (workspaceId, payload) =>
      (await request<AgentCreationAssistantDraftResponse>(`${collectionPath(workspaceId)}/assistant/import-skill`, {
        method: "POST",
        body: JSON.stringify(payload)
      })).data,
    createAgent: async (workspaceId, payload) =>
      (await request<AgentPublicSummary>(collectionPath(workspaceId), {
        method: "POST",
        body: JSON.stringify(payload)
      })).data,
    getAgentConfiguration: async (workspaceId, agentId) =>
      (await request<AgentEditableConfiguration>(`${agentPath(workspaceId, agentId)}/configuration`)).data,
    updateAgent: async (workspaceId, agentId, payload) =>
      (await request<AgentPublicSummary>(agentPath(workspaceId, agentId), {
        method: "PATCH",
        body: JSON.stringify(payload)
      })).data,
    renameAgent: async (workspaceId, agentId, name) =>
      (await request<AgentPublicSummary>(`${agentPath(workspaceId, agentId)}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      })).data,
    duplicateAgent: async (workspaceId, agentId) =>
      (await request<AgentPublicSummary>(`${agentPath(workspaceId, agentId)}/duplicate`, {
        method: "POST"
      })).data,
    enableAgent: async (workspaceId, agentId) =>
      (await request<AgentPublicSummary>(`${agentPath(workspaceId, agentId)}/enable`, {
        method: "POST"
      })).data,
    disableAgent: async (workspaceId, agentId) =>
      (await request<AgentPublicSummary>(`${agentPath(workspaceId, agentId)}/disable`, {
        method: "POST"
      })).data,
    deleteAgent: async (workspaceId, agentId) =>
      (await request<AgentPublicSummary>(agentPath(workspaceId, agentId), {
        method: "DELETE"
      })).data
  };
}

function malformedResponse(status: number): AgentApiClientError {
  return new AgentApiClientError({
    message: "The Agent Management API returned an invalid response.",
    status,
    kind: "malformed-response"
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
