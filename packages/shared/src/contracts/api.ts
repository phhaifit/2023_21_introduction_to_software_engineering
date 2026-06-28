export const ERROR_CODES = [
  "auth.unauthorized",
  "auth.invalid_credentials",
  "auth.session_expired",
  "auth.forbidden",
  "validation.invalid_input",
  "workspace.not_found",
  "member.not_found",
  "workspace.conflict",
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

export const AUTHENTICATION_ERROR_CODES = [
  "auth.unauthorized",
  "auth.invalid_credentials",
  "auth.session_expired"
] as const satisfies readonly ErrorCode[];

export const AUTHORIZATION_ERROR_CODES = [
  "auth.forbidden"
] as const satisfies readonly ErrorCode[];

export type AuthenticationErrorCode = (typeof AUTHENTICATION_ERROR_CODES)[number];
export type AuthorizationErrorCode = (typeof AUTHORIZATION_ERROR_CODES)[number];

export type ApiValidationIssue = {
  path: string;
  message: string;
  code?: string;
};

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  issues?: ApiValidationIssue[];
};

export type ApiPaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ApiMeta = {
  requestId: string;
  timestamp: string;
  pagination?: ApiPaginationMeta;
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

export type ApiPaginatedSuccess<T> = ApiSuccess<T[]> & {
  meta: ApiMeta & {
    pagination: ApiPaginationMeta;
  };
};
