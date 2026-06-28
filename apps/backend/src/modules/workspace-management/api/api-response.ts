import type { Request, Response } from "express";
import type { ApiSuccess, ApiFailure, ApiMeta, ErrorCode } from "@vcp/shared/contracts/api.ts";

function buildMeta(request: Request): ApiMeta {
  return {
    requestId: (request as any).context?.requestId ?? "unknown",
    timestamp: new Date().toISOString()
  };
}

export function sendWorkspaceSuccess<T>(
  request: Request,
  response: Response,
  data: T,
  statusCode = 200
): void {
  const body: ApiSuccess<T> = { ok: true, data, meta: buildMeta(request) };
  response.status(statusCode).json(body);
}

export function sendWorkspaceFailure(
  request: Request,
  response: Response,
  opts: { code: ErrorCode | string; message: string; statusCode: number; details?: Record<string, unknown> }
): void {
  const body: ApiFailure = {
    ok: false,
    error: { code: opts.code as ErrorCode, message: opts.message, details: opts.details },
    meta: buildMeta(request)
  };
  response.status(opts.statusCode).json(body);
}
