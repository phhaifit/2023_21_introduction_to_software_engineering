import type { DomainResult, WorkspaceValidationIssue } from "./workspace-types.ts";
import { workspaceDomainError } from "./workspace-types.ts";

export const WORKSPACE_FAILURE_RETRY_CLASSIFICATIONS = [
  "retryable",
  "terminal",
  "manual_review_required"
] as const;

export type WorkspaceFailureRetryClassification =
  (typeof WORKSPACE_FAILURE_RETRY_CLASSIFICATIONS)[number];

export type WorkspaceSafeFailure = {
  readonly code: string;
  readonly message: string;
  readonly retryClassification: WorkspaceFailureRetryClassification;
};

const MAX_SAFE_FAILURE_MESSAGE_LENGTH = 240;
const SAFE_FAILURE_CODE_PATTERN = /^[a-z][a-z0-9_.:-]{1,79}$/;
const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}]/u;
const RETRY_CLASSIFICATION_SET = new Set<string>(
  WORKSPACE_FAILURE_RETRY_CLASSIFICATIONS
);

const UNSAFE_FIELD_NAME_PATTERNS = [
  "providerrawresponse",
  "rawproviderresponse",
  "stack",
  "stacktrace",
  "databaseerror",
  "dberror",
  "leasetoken",
  "providerrequestkey",
  "runtimeref",
  "runtimeurl",
  "credential",
  "sessiontoken",
  "password",
  "authorization",
  "authorizationheader",
  "token",
  "secret"
] as const;

const UNSAFE_MESSAGE_PATTERN =
  /https?:\/\/|\b(runtimeRef|runtimeUrl|credential|password|authorization|sessionToken|session token|providerRequestKey|leaseToken|token=|secret|api[_-]?key)\b/i;

export function createSafeWorkspaceFailure(
  input: unknown
): DomainResult<WorkspaceSafeFailure> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failureError([
      {
        path: "",
        message: "Failure input must be an object.",
        code: "workspace_failure_not_object"
      }
    ]);
  }

  const record = input as Record<string, unknown>;
  const issues: WorkspaceValidationIssue[] = [];

  for (const key of Object.keys(record)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (UNSAFE_FIELD_NAME_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
      issues.push({
        path: key,
        message: "Unsafe failure field is not domain-visible.",
        code: "workspace_failure_unsafe_field"
      });
    }
  }

  const code = typeof record.code === "string" ? record.code.trim() : "";
  const rawMessage = typeof record.message === "string" ? record.message : "";
  const retryClassification =
    typeof record.retryClassification === "string"
      ? record.retryClassification
      : "";

  if (!SAFE_FAILURE_CODE_PATTERN.test(code) || CONTROL_CHARACTER_PATTERN.test(code)) {
    issues.push({
      path: "code",
      message: "Failure code must be a safe bounded identifier.",
      code: "workspace_failure_code_invalid"
    });
  }

  if (CONTROL_CHARACTER_PATTERN.test(rawMessage)) {
    issues.push({
      path: "message",
      message: "Failure message must not contain control characters.",
      code: "workspace_failure_message_control_character"
    });
  }

  if (UNSAFE_MESSAGE_PATTERN.test(rawMessage)) {
    issues.push({
      path: "message",
      message: "Failure message contains unsafe runtime or credential material.",
      code: "workspace_failure_message_unsafe"
    });
  }

  const message = rawMessage.trim().replace(/\s+/gu, " ");

  if (message.length === 0) {
    issues.push({
      path: "message",
      message: "Failure message must not be empty.",
      code: "workspace_failure_message_empty"
    });
  }

  if (!RETRY_CLASSIFICATION_SET.has(retryClassification)) {
    issues.push({
      path: "retryClassification",
      message: "Retry classification is invalid.",
      code: "workspace_failure_retry_classification_invalid"
    });
  }

  if (issues.length > 0) {
    return failureError(issues);
  }

  return {
    ok: true,
    value: {
      code,
      message: message.slice(0, MAX_SAFE_FAILURE_MESSAGE_LENGTH),
      retryClassification:
        retryClassification as WorkspaceFailureRetryClassification
    }
  };
}

function failureError(
  issues: readonly WorkspaceValidationIssue[]
): DomainResult<WorkspaceSafeFailure> {
  return {
    ok: false,
    error: workspaceDomainError(
      "workspace.unsafe_failure",
      "Workspace failure data is not safe for domain visibility.",
      issues
    )
  };
}
