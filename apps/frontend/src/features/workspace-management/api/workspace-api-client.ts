import type {
  ApiCursorPaginationMeta,
  ErrorCode
} from "@vcp/shared/contracts/api.ts";
import type {
  CreateWorkspaceAcceptedResponse,
  CreateWorkspaceRequest,
  DeleteWorkspaceAcceptedResponse,
  WorkspaceDetailDto,
  WorkspaceSummaryDto
} from "@vcp/shared/contracts/workspace-management.ts";

type FetchImplementation = typeof fetch;

export type WorkspaceListRequest = {
  cursor?: string | null;
  limit?: number;
};

export type WorkspaceListResult = {
  items: WorkspaceSummaryDto[];
  cursor: ApiCursorPaginationMeta;
};

export type WorkspaceCommandOptions = {
  idempotencyKey: string;
};

export type WorkspaceManagementApiClient = {
  listWorkspaces(input?: WorkspaceListRequest): Promise<WorkspaceListResult>;
  createWorkspace(
    input: CreateWorkspaceRequest,
    options: WorkspaceCommandOptions
  ): Promise<CreateWorkspaceAcceptedResponse>;
  getWorkspace(workspaceId: string): Promise<WorkspaceDetailDto>;
  deleteWorkspace(
    workspaceId: string,
    options: WorkspaceCommandOptions
  ): Promise<DeleteWorkspaceAcceptedResponse>;
};

export type WorkspaceApiClientErrorKind =
  | "api"
  | "network"
  | "malformed-response";

export class WorkspaceApiClientError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly issues?: unknown;
  readonly kind: WorkspaceApiClientErrorKind;
  readonly status?: number;

  constructor(input: {
    message: string;
    code?: ErrorCode;
    details?: Record<string, unknown>;
    issues?: unknown;
    kind: WorkspaceApiClientErrorKind;
    status?: number;
  }) {
    super(input.message);
    this.name = "WorkspaceApiClientError";
    this.code = input.code ?? "system.unexpected_error";
    this.details = input.details;
    this.issues = input.issues;
    this.kind = input.kind;
    this.status = input.status;
  }
}

export type WorkspaceIdempotencyKeyFactory = () => string;

export function createWorkspaceIdempotencyKey(): string {
  const randomSource = globalThis.crypto;

  if (randomSource && "randomUUID" in randomSource) {
    return `wks:${randomSource.randomUUID()}`;
  }

  return `wks:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 14)}`;
}

export function createWorkspaceManagementApiClient(input: {
  baseUrl?: string;
  fetchImplementation?: FetchImplementation;
  getAuthToken?: () => string | null | undefined;
} = {}): WorkspaceManagementApiClient {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const baseUrl = input.baseUrl?.replace(/\/$/, "") ?? "";

  async function request<T>(path: string, init: RequestInit = {}): Promise<{
    data: T;
    meta: Record<string, unknown>;
  }> {
    let response: Response;

    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        headers: buildHeaders(init, input.getAuthToken?.())
      });
    } catch {
      throw new WorkspaceApiClientError({
        message: "Unable to reach the Workspace API.",
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

      throw new WorkspaceApiClientError({
        code: error.code as ErrorCode,
        message: error.message,
        details: isRecord(error.details) ? error.details : undefined,
        issues: error.issues,
        kind: "api",
        status: response.status
      });
    }

    if (!("data" in body) || !isRecord(body.meta)) {
      throw malformedResponse(response.status);
    }

    return {
      data: body.data as T,
      meta: body.meta
    };
  }

  return {
    async listWorkspaces(input = {}) {
      const query = new URLSearchParams();

      if (input.cursor) {
        query.set("cursor", input.cursor);
      }

      if (input.limit) {
        query.set("limit", input.limit.toString());
      }

      const queryString = query.toString();
      const response = await request<WorkspaceSummaryDto[]>(
        queryString ? `/api/workspaces?${queryString}` : "/api/workspaces"
      );
      const cursor = response.meta.cursor;

      if (
        !isRecord(cursor) ||
        !("nextCursor" in cursor) ||
        typeof cursor.hasMore !== "boolean"
      ) {
        throw malformedResponse(200);
      }

      return {
        items: response.data,
        cursor: {
          nextCursor:
            typeof cursor.nextCursor === "string" ? cursor.nextCursor : null,
          hasMore: cursor.hasMore
        }
      };
    },

    async createWorkspace(input, options) {
      return (await request<CreateWorkspaceAcceptedResponse>("/api/workspaces", {
        method: "POST",
        headers: {
          "Idempotency-Key": options.idempotencyKey
        },
        body: JSON.stringify({
          name: input.name,
          requestedProfile: input.requestedProfile
        })
      })).data;
    },

    async getWorkspace(workspaceId) {
      return (await request<WorkspaceDetailDto>(
        `/api/workspaces/${encodeURIComponent(workspaceId)}`
      )).data;
    },

    async deleteWorkspace(workspaceId, options) {
      return (await request<DeleteWorkspaceAcceptedResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceId)}`,
        {
          method: "DELETE",
          headers: {
            "Idempotency-Key": options.idempotencyKey
          }
        }
      )).data;
    }
  };
}

function buildHeaders(
  init: RequestInit,
  authToken: string | null | undefined
): HeadersInit {
  return {
    accept: "application/json",
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    ...init.headers
  };
}

function malformedResponse(status: number): WorkspaceApiClientError {
  return new WorkspaceApiClientError({
    message: "The Workspace API returned an invalid response.",
    kind: "malformed-response",
    status
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
