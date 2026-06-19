export const ERROR_CODES = [
  "auth.invalid_credentials",
  "auth.session_expired",
  "auth.forbidden",
  "validation.invalid_input",
  "workspace.not_found",
  "workspace.not_ready",
  "subscription.required",
  "subscription.payment_failed",
  "agent.not_available",
  "tool.secret_unavailable",
  "workflow.invalid_definition",
  "task.execution_failed",
  "knowledge.access_denied",
  "system.unexpected_error"
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiMeta = {
  requestId: string;
  timestamp: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
  meta: ApiMeta;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
