import type { WorkspacePersistenceRecord } from "../ports/workspace-persistence-types.ts";

export function hasValidPendingBootstrapAccess(input: {
  workspace: WorkspacePersistenceRecord;
  actorUserId: string;
  now: string;
}): boolean {
  return (
    input.workspace.createdByUserId === input.actorUserId &&
    input.workspace.ownerBootstrapState === "pending" &&
    input.workspace.ownerBootstrapExpiresAt !== null &&
    input.workspace.ownerBootstrapExpiresAt > input.now
  );
}

export function isWorkspaceDeleting(status: WorkspacePersistenceRecord["status"]): boolean {
  return status === "deleting" || status === "delete_failed";
}
