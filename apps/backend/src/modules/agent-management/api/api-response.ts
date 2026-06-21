import type { Request, Response } from "express";

import type {
  ApiFailure,
  ApiMeta,
  ApiSuccess,
  ErrorCode
} from "@vcp/shared/contracts/api.ts";

export type AgentApiErrorInput = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
};

export function sendAgentApiSuccess<T>(request: Request, response: Response, data: T): void {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    meta: createApiMeta(request)
  };

  response.status(200).json(body);
}

export function sendAgentApiFailure(
  request: Request,
  response: Response,
  input: AgentApiErrorInput
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
    requestId: request.header("x-request-id") ?? "agent-management-request",
    timestamp: new Date().toISOString()
  };
}
