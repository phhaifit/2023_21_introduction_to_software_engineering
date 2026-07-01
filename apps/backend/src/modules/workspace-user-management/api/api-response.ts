import type { Request, Response } from "express";

import type {
  ApiFailure,
  ApiMeta,
  ApiSuccess,
  ErrorCode
} from "@vcp/shared/contracts/api.ts";

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  "auth.unauthorized": 401,
  "auth.invalid_credentials": 401,
  "auth.session_expired": 401,
  "auth.forbidden": 403,
  "validation.invalid_input": 422,
  "workspace.not_found": 404,
  "member.not_found": 404,
  "workspace.conflict": 409,
  "workspace.not_ready": 503,
  "subscription.required": 402,
  "subscription.payment_failed": 402,
  "agent.not_available": 503,
  "tool.secret_unavailable": 404,
  "workflow.invalid_definition": 422,
  "task.execution_failed": 502,
  "knowledge.access_denied": 403,
  "system.unexpected_error": 500
};

function buildMeta(request: Request): ApiMeta {
  return {
    requestId: request.header("x-request-id") ?? "workspace-user-management-request",
    timestamp: new Date().toISOString()
  };
}

export function sendWorkspaceUserManagementApiSuccess<T>(
  request: Request,
  response: Response,
  data: T
): void {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    meta: buildMeta(request)
  };
  response.status(200).json(body);
}

export function sendWorkspaceUserManagementApiFailure(
  request: Request,
  response: Response,
  code: ErrorCode,
  message: string
): void {
  const body: ApiFailure = {
    ok: false,
    error: { code, message },
    meta: buildMeta(request)
  };
  response.status(HTTP_STATUS_MAP[code]).json(body);
}
