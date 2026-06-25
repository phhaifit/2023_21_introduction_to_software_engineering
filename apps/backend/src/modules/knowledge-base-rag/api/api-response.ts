import type { Request, Response } from "express";

import type {
  ApiFailure,
  ApiMeta,
  ApiPaginatedSuccess,
  ApiPaginationMeta,
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
  "workspace.not_ready": 503,
  "subscription.required": 402,
  "subscription.payment_failed": 402,
  "agent.not_available": 503,
  "tool.secret_unavailable": 503,
  "workflow.invalid_definition": 422,
  "task.execution_failed": 500,
  "knowledge.access_denied": 403,
  "system.unexpected_error": 500
};

export function sendKnowledgeBaseRagApiSuccess<T>(
  request: Request,
  response: Response,
  data: T
): void {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    meta: createApiMeta(request)
  };

  response.status(200).json(body);
}

export function sendKnowledgeBaseRagPaginatedApiSuccess<T>(
  request: Request,
  response: Response,
  data: T[],
  pagination: ApiPaginationMeta
): void {
  const body: ApiPaginatedSuccess<T> = {
    ok: true,
    data,
    meta: {
      ...createApiMeta(request),
      pagination
    }
  };

  response.status(200).json(body);
}

export function sendKnowledgeBaseRagApiFailure(
  request: Request,
  response: Response,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): void {
  const body: ApiFailure = {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    },
    meta: createApiMeta(request)
  };

  response.status(HTTP_STATUS_MAP[code]).json(body);
}

export function createPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): ApiPaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

function createApiMeta(request: Request): ApiMeta {
  const context = (request as any).context as { requestId?: string } | undefined;

  return {
    requestId: context?.requestId ?? request.header("x-request-id") ?? "knowledge-base-rag-request",
    timestamp: new Date().toISOString()
  };
}
