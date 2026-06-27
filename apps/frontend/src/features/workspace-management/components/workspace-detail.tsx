import type { WorkspaceDetailDto } from "@vcp/shared/contracts/workspace-management.ts";

import { formatWorkspaceTimestamp } from "./workspace-list.tsx";
import {
  getWorkspaceStatusDescription,
  WorkspaceStatusBadge
} from "./workspace-status-badge.tsx";

export type WorkspaceDetailProps = {
  workspace: WorkspaceDetailDto;
  onDeleteRequest?: () => void;
  deleteDisabled?: boolean;
};

export function WorkspaceDetail({
  workspace,
  onDeleteRequest,
  deleteDisabled = false
}: WorkspaceDetailProps) {
  const canRequestDelete =
    workspace.status !== "deleted" && workspace.status !== "deleting";

  return (
    <article className="workspace-detail-panel" aria-labelledby="workspace-detail-title" data-testid="workspace-detail">
      <header className="workspace-detail-panel__header">
        <div>
          <p className="workspace-management-eyebrow">Workspace detail</p>
          <h2 id="workspace-detail-title">{workspace.name}</h2>
          <p>{getWorkspaceStatusDescription(workspace.status)}</p>
        </div>
        <WorkspaceStatusBadge status={workspace.status} />
      </header>

      <dl className="workspace-detail-grid" aria-label="Workspace metadata">
        <div>
          <dt>Status</dt>
          <dd>{workspace.status}</dd>
        </div>
        <div>
          <dt>Requested profile</dt>
          <dd>{workspace.requestedProfile ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            <time dateTime={workspace.createdAt}>
              {formatWorkspaceTimestamp(workspace.createdAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>
            <time dateTime={workspace.updatedAt}>
              {formatWorkspaceTimestamp(workspace.updatedAt)}
            </time>
          </dd>
        </div>
        {workspace.provisioningRequestedAt ? (
          <div>
            <dt>Provisioning requested</dt>
            <dd>
              <time dateTime={workspace.provisioningRequestedAt}>
                {formatWorkspaceTimestamp(workspace.provisioningRequestedAt)}
              </time>
            </dd>
          </div>
        ) : null}
        {workspace.deletionRequestedAt ? (
          <div>
            <dt>Deletion requested</dt>
            <dd>
              <time dateTime={workspace.deletionRequestedAt}>
                {formatWorkspaceTimestamp(workspace.deletionRequestedAt)}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>

      {workspace.failure ? (
        <section className="workspace-management-alert workspace-management-alert--warning" aria-label="Safe failure summary">
          <strong>{workspace.failure.code}</strong>
          <p>{workspace.failure.message}</p>
        </section>
      ) : null}

      {workspace.status === "deleting" ? (
        <p className="workspace-management-alert workspace-management-alert--info" role="status">
          Deletion has been requested. Runtime cleanup may still be running.
        </p>
      ) : null}

      {workspace.status === "delete_failed" ? (
        <p className="workspace-management-alert workspace-management-alert--warning" role="status">
          Delete failed. Retry or operator reconciliation may be required.
        </p>
      ) : null}

      <section className="workspace-public-links" aria-labelledby="workspace-public-links-title">
        <h3 id="workspace-public-links-title">Public module sections</h3>
        <a href="/agents">Agents</a>
        <a href="/workflows">Workflows</a>
      </section>

      {onDeleteRequest ? (
        <div className="workspace-detail-panel__actions">
          <button
            className="workspace-management-danger-button"
            disabled={!canRequestDelete || deleteDisabled}
            onClick={onDeleteRequest}
            type="button"
            data-testid="workspace-delete-button"
          >
            {workspace.status === "deleting" ? "Deletion requested" : "Delete workspace"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
