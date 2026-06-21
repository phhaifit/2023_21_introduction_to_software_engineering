import {
  roleHasPermission,
  type Permission,
  type WorkspaceRole
} from "../../../../shared/contracts/index.ts";
import type { RequestContext } from "../auth/request-context.ts";

export type AuthorizationDecision = {
  allowed: boolean;
  reason?: string;
};

export function canPerform(
  role: WorkspaceRole,
  permission: Permission
): AuthorizationDecision {
  if (roleHasPermission(role, permission)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Role ${role} does not have permission ${permission}`
  };
}

export function requirePermission(
  context: RequestContext,
  permission: Permission
): void {
  const role = context.workspace?.role;

  if (!role) {
    throw new Error("Workspace role required");
  }

  const decision = canPerform(role, permission);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}
