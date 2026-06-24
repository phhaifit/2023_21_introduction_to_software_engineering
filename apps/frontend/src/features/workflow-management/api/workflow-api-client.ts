import type { ErrorCode } from "@vcp/shared/contracts/api.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowDto, WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";

export type WorkflowPublicSummary = Pick<WorkflowDto, "workflowId" | "name" | "status" | "triggerType" | "updatedAt"> & {
  stepCount: number;
};

export type CreateWorkflowCommand = {
  name: string;
  description?: string;
  triggerType: "manual" | "schedule" | "webhook";
  steps: {
    agentId: string;
    stepOrder: number;
  }[];
};

export type UpdateWorkflowCommand = Partial<CreateWorkflowCommand> & {
  status?: "draft" | "active" | "archived";
};

export type WorkflowManagementApiClient = {
  listWorkflows(workspaceId: EntityId<"workspaceId">): Promise<WorkflowPublicSummary[]>;
  createWorkflow(
    workspaceId: EntityId<"workspaceId">,
    payload: CreateWorkflowCommand
  ): Promise<WorkflowPublicSummary>;
  getWorkflow(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): Promise<WorkflowDto & { steps: WorkflowStepDto[] }>;
  updateWorkflow(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">,
    payload: UpdateWorkflowCommand
  ): Promise<WorkflowPublicSummary>;
  executeWorkflow(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">,
    inputData?: Record<string, any>
  ): Promise<void>;
};

export type WorkflowApiClientErrorKind = "api" | "network" | "malformed-response";

export class WorkflowApiClientError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status?: number;
  readonly kind: WorkflowApiClientErrorKind;

  constructor(input: {
    message: string;
    code?: ErrorCode;
    details?: Record<string, unknown>;
    status?: number;
    kind: WorkflowApiClientErrorKind;
  }) {
    super(input.message);
    this.name = "WorkflowApiClientError";
    this.code = input.code ?? "system.unexpected_error";
    this.details = input.details;
    this.status = input.status;
    this.kind = input.kind;
  }
}

type FetchImplementation = typeof fetch;

export function createWorkflowManagementApiClient(input: {
  fetchImplementation?: FetchImplementation;
  baseUrl?: string;
} = {}): WorkflowManagementApiClient {
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
      throw new WorkflowApiClientError({
        message: "Unable to reach the Workflow Management API.",
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

      throw new WorkflowApiClientError({
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
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/workflows`;
  }

  function workflowPath(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): string {
    return `${collectionPath(workspaceId)}/${encodeURIComponent(workflowId)}`;
  }

  return {
    listWorkflows: (workspaceId) => request<WorkflowPublicSummary[]>(collectionPath(workspaceId)),
    createWorkflow: (workspaceId, payload) =>
      request<WorkflowPublicSummary>(collectionPath(workspaceId), {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    getWorkflow: (workspaceId, workflowId) =>
      request<WorkflowDto & { steps: WorkflowStepDto[] }>(workflowPath(workspaceId, workflowId)),
    updateWorkflow: (workspaceId, workflowId, payload) =>
      request<WorkflowPublicSummary>(workflowPath(workspaceId, workflowId), {
        method: "PATCH",
        body: JSON.stringify(payload)
      }),
    executeWorkflow: (workspaceId, workflowId, inputData) =>
      request<void>(`${workflowPath(workspaceId, workflowId)}/execute`, {
        method: "POST",
        body: JSON.stringify({ inputData })
      })
  };
}

function malformedResponse(status: number): WorkflowApiClientError {
  return new WorkflowApiClientError({
    message: "The Workflow Management API returned an invalid response.",
    status,
    kind: "malformed-response"
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
