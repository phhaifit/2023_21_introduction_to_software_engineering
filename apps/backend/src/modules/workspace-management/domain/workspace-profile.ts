import type { DomainResult, WorkspaceValidationIssue } from "./workspace-types.ts";
import { validateWorkspaceName } from "./workspace-name.ts";
import { workspaceDomainError } from "./workspace-types.ts";

export const REQUESTED_WORKSPACE_PROFILES = ["standard", "premium"] as const;

export type RequestedWorkspaceProfile =
  (typeof REQUESTED_WORKSPACE_PROFILES)[number];

export type RequestedWorkspaceIntent = {
  name: string;
  requestedProfile: RequestedWorkspaceProfile;
};

const REQUEST_INTENT_FIELDS = new Set(["name", "requestedProfile"]);
const REQUESTED_PROFILE_SET = new Set<string>(REQUESTED_WORKSPACE_PROFILES);

export function validateRequestedWorkspaceIntent(
  input: unknown
): DomainResult<RequestedWorkspaceIntent> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      error: workspaceDomainError("workspace.validation_failed", "Workspace intent is invalid.", [
        {
          path: "",
          message: "Workspace intent must be an object.",
          code: "workspace_intent_not_object"
        }
      ])
    };
  }

  const record = input as Record<string, unknown>;
  const issues: WorkspaceValidationIssue[] = [];

  for (const key of Object.keys(record)) {
    if (!REQUEST_INTENT_FIELDS.has(key)) {
      issues.push({
        path: key,
        message: "Client-controlled server-owned Workspace field is not accepted.",
        code: "workspace_intent_forbidden_field"
      });
    }
  }

  const nameResult = validateWorkspaceName(record.name);
  if (!nameResult.ok) {
    issues.push(...(nameResult.error.issues ?? []));
  }

  if (
    typeof record.requestedProfile !== "string" ||
    !REQUESTED_PROFILE_SET.has(record.requestedProfile)
  ) {
    issues.push({
      path: "requestedProfile",
      message: "Requested profile must be standard or premium.",
      code: "workspace_requested_profile_invalid"
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      error: workspaceDomainError(
        "workspace.validation_failed",
        "Workspace intent is invalid.",
        issues
      )
    };
  }

  return {
    ok: true,
    value: {
      name: nameResult.ok ? nameResult.value.displayName : "",
      requestedProfile: record.requestedProfile as RequestedWorkspaceProfile
    }
  };
}
