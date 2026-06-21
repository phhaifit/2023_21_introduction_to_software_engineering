import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import type { ErrorCode } from "@vcp/shared/contracts/api.ts";
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

export type AgentManagementApiClient = {
  listAgents(workspaceId: EntityId<"workspaceId">): Promise<AgentListItem[]>;
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

    if (!("data" in body)) {
      throw malformedResponse(response.status);
    }

    return body.data as T;
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
    listAgents: (workspaceId) => request<AgentListItem[]>(collectionPath(workspaceId)),
    createAgent: (workspaceId, payload) =>
      request<AgentPublicSummary>(collectionPath(workspaceId), {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    getAgentConfiguration: (workspaceId, agentId) =>
      request<AgentEditableConfiguration>(`${agentPath(workspaceId, agentId)}/configuration`),
    updateAgent: (workspaceId, agentId, payload) =>
      request<AgentPublicSummary>(agentPath(workspaceId, agentId), {
        method: "PATCH",
        body: JSON.stringify(payload)
      }),
    enableAgent: (workspaceId, agentId) =>
      request<AgentPublicSummary>(`${agentPath(workspaceId, agentId)}/enable`, {
        method: "POST"
      }),
    disableAgent: (workspaceId, agentId) =>
      request<AgentPublicSummary>(`${agentPath(workspaceId, agentId)}/disable`, {
        method: "POST"
      }),
    deleteAgent: (workspaceId, agentId) =>
      request<AgentPublicSummary>(agentPath(workspaceId, agentId), {
        method: "DELETE"
      })
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
