import type { Request, Response } from "express";

import type {
  ApiFailure,
  ApiMeta,
  ApiSuccess,
  ErrorCode,
  ApiPaginatedSuccess
} from "@vcp/shared/contracts/api.ts";

export type WorkflowApiErrorInput = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
};

export function sendWorkflowApiSuccess<T>(request: Request, response: Response, data: T): void {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    meta: createApiMeta(request)
  };

  response.status(200).json(body);
}

export function sendWorkflowApiPaginatedSuccess<T>(
  request: Request,
  response: Response,
  data: T[],
  total: number,
  offset: number,
  limit: number
): void {
  const body: ApiPaginatedSuccess<T> = {
    ok: true,
    data,
    pagination: {
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    },
    meta: createApiMeta(request)
  };

  response.status(200).json(body);
}

export function sendWorkflowApiFailure(
  request: Request,
  response: Response,
  input: WorkflowApiErrorInput
): void {
  const body: ApiFailure = {
    ok: false,
    error: {
      code: input.code,
      message: input.message,
      ...(input.details ? { details: input.details } : {})
    },
    meta: createApiMeta(request)
  };

  response.status(input.statusCode).json(body);
}

function createApiMeta(request: Request): ApiMeta {
  return {
    requestId: request.header("x-request-id") ?? "workflow-management-request",
    timestamp: new Date().toISOString()
  };
}
