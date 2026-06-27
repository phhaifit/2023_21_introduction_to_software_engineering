import type { WorkspaceLifecycleStatusDto } from "@vcp/shared/contracts/workspace-management.ts";

const STATUS_LABELS: Record<WorkspaceLifecycleStatusDto, string> = {
  provisioning: "Provisioning",
  active: "Active",
  failed: "Failed",
  deleting: "Deleting",
  delete_failed: "Delete failed",
  deleted: "Deleted"
};

const STATUS_DESCRIPTIONS: Record<WorkspaceLifecycleStatusDto, string> = {
  provisioning: "Runtime setup has been accepted but is not ready yet.",
  active: "Runtime provisioning has completed.",
  failed: "Provisioning failed with a safe recorded failure.",
  deleting: "Deletion has been requested and cleanup is still in progress.",
  delete_failed: "Deletion failed and may require retry or reconciliation.",
  deleted: "Workspace deletion is final."
};

export function getWorkspaceStatusLabel(status: WorkspaceLifecycleStatusDto): string {
  return STATUS_LABELS[status];
}

export function getWorkspaceStatusDescription(status: WorkspaceLifecycleStatusDto): string {
  return STATUS_DESCRIPTIONS[status];
}

export function WorkspaceStatusBadge({
  status
}: {
  status: WorkspaceLifecycleStatusDto;
}) {
  return (
    <span
      className={`workspace-status-badge workspace-status-badge--${status}`}
      aria-label={`Workspace status: ${STATUS_LABELS[status]}`}
      title={STATUS_DESCRIPTIONS[status]}
      data-testid="workspace-status"
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
