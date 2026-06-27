import type { Request, Response } from "express";

import type {
  ApiCursorPaginatedSuccess,
  ApiFailure,
  ApiSuccess,
  ErrorCode
} from "@vcp/shared/contracts/api.ts";
import type {
  WorkspaceDetailDto,
  WorkspaceSummaryDto
} from "@vcp/shared/contracts/workspace-management.ts";
import type { WorkspacePersistenceRecord } from "../../application/ports/workspace-persistence-types.ts";
import { WorkspaceHttpError } from "./workspace-http-errors.ts";

export function sendWorkspaceApiSuccess<T>(
  request: Request,
  response: Response,
  statusCode: number,
  data: T
): void {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    meta: createApiMeta(request)
  };

  response.status(statusCode).json(body);
}

export function sendWorkspaceCursorApiSuccess<T>(
  request: Request,
  response: Response,
  data: T[],
  cursor: {
    nextCursor: string | null;
    hasMore: boolean;
  }
): void {
  const body: ApiCursorPaginatedSuccess<T> = {
    ok: true,
    data,
    meta: {
      ...createApiMeta(request),
      cursor
    }
  };

  response.status(200).json(body);
}

export function sendWorkspaceApiFailure(
  request: Request,
  response: Response,
  error: unknown
): void {
  const normalized = normalizeError(error);
  const body: ApiFailure = {
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.issues.length > 0 ? { issues: [...normalized.issues] } : {})
    },
    meta: createApiMeta(request)
  };

  response.status(normalized.statusCode).json(body);
}

export function mapWorkspaceSummary(
  workspace: WorkspacePersistenceRecord
): WorkspaceSummaryDto {
  return {
    workspaceId: workspace.workspaceId as WorkspaceSummaryDto["workspaceId"],
    name: workspace.name,
    status: workspace.status,
    requestedProfile: workspace.requestedProfile,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    provisioningRequestedAt: workspace.provisioningRequestedAt,
    provisionedAt: workspace.provisionedAt,
    deletionRequestedAt: workspace.deletionRequestedAt,
    deletedAt: workspace.deletedAt,
    failure:
      workspace.failureCode || workspace.failureMessage
        ? {
            code: workspace.failureCode ?? "workspace.failure",
            message: workspace.failureMessage ?? "Workspace has a recorded failure."
          }
        : null
  };
}

export function mapWorkspaceDetail(
  workspace: WorkspacePersistenceRecord
): WorkspaceDetailDto {
  return mapWorkspaceSummary(workspace);
}

function normalizeError(error: unknown): {
  statusCode: number;
  code: ErrorCode;
  message: string;
  issues: WorkspaceHttpError["issues"];
} {
  if (error instanceof WorkspaceHttpError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      issues: error.issues
    };
  }

  return {
    statusCode: 500,
    code: "system.unexpected_error",
    message: "Unexpected Workspace API error.",
    issues: []
  };
}

function createApiMeta(request: Request) {
  return {
    requestId:
      ((request as { context?: { requestId?: string } }).context?.requestId) ??
      request.header("x-request-id") ??
      "workspace-request",
    timestamp: new Date().toISOString()
  };
}
