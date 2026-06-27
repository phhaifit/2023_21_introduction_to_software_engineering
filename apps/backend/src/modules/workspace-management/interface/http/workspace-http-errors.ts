import type { ApiValidationIssue, ErrorCode } from "@vcp/shared/contracts/api.ts";

export class WorkspaceHttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly issues: readonly ApiValidationIssue[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    issues: readonly ApiValidationIssue[] = []
  ) {
    super(message);
    this.name = "WorkspaceHttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}

export function validationError(
  message: string,
  issues: readonly ApiValidationIssue[] = []
): WorkspaceHttpError {
  return new WorkspaceHttpError(400, "validation.invalid_input", message, issues);
}

export function unauthorizedError(): WorkspaceHttpError {
  return new WorkspaceHttpError(401, "auth.unauthorized", "Authentication required.");
}

export function forbiddenError(): WorkspaceHttpError {
  return new WorkspaceHttpError(403, "auth.forbidden", "Workspace access is forbidden.");
}

export function notFoundError(): WorkspaceHttpError {
  return new WorkspaceHttpError(404, "workspace.not_found", "Workspace not found.");
}

export function lifecycleConflictError(): WorkspaceHttpError {
  return new WorkspaceHttpError(
    409,
    "workspace.lifecycle_conflict",
    "Workspace lifecycle does not allow this command."
  );
}

export function idempotencyConflictError(): WorkspaceHttpError {
  return new WorkspaceHttpError(
    409,
    "workspace.idempotency_conflict",
    "Idempotency key was already used for a different request."
  );
}

export function entitlementDeniedError(message: string): WorkspaceHttpError {
  return new WorkspaceHttpError(403, "workspace.entitlement_denied", message);
}

export function unavailableError(): WorkspaceHttpError {
  return new WorkspaceHttpError(
    503,
    "system.unavailable",
    "Workspace service is temporarily unavailable."
  );
}
