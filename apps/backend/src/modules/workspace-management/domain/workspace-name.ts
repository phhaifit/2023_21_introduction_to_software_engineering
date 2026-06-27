import type { DomainResult } from "./workspace-types.ts";
import { workspaceDomainError } from "./workspace-types.ts";

export const WORKSPACE_NAME_MAX_LENGTH = 80;

export type WorkspaceName = {
  readonly displayName: string;
  readonly normalizedName: string;
};

const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}]/u;

export function validateWorkspaceName(input: unknown): DomainResult<WorkspaceName> {
  if (typeof input !== "string") {
    return {
      ok: false,
      error: workspaceDomainError("workspace.validation_failed", "Workspace name is invalid.", [
        {
          path: "name",
          message: "Workspace name must be a string.",
          code: "workspace_name_not_string"
        }
      ])
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(input)) {
    return {
      ok: false,
      error: workspaceDomainError("workspace.validation_failed", "Workspace name is invalid.", [
        {
          path: "name",
          message: "Workspace name must not contain control characters.",
          code: "workspace_name_control_character"
        }
      ])
    };
  }

  const displayName = input.trim().replace(/\s+/gu, " ");

  if (displayName.length === 0) {
    return {
      ok: false,
      error: workspaceDomainError("workspace.validation_failed", "Workspace name is invalid.", [
        {
          path: "name",
          message: "Workspace name must not be empty.",
          code: "workspace_name_empty"
        }
      ])
    };
  }

  if (displayName.length > WORKSPACE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: workspaceDomainError("workspace.validation_failed", "Workspace name is invalid.", [
        {
          path: "name",
          message: `Workspace name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`,
          code: "workspace_name_too_long"
        }
      ])
    };
  }

  return {
    ok: true,
    value: {
      displayName,
      normalizedName: displayName.toLowerCase()
    }
  };
}
