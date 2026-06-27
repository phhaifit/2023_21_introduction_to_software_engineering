import type { WorkspaceSummaryDto } from "@vcp/shared/contracts/workspace-management.ts";

import {
  getWorkspaceStatusDescription,
  WorkspaceStatusBadge
} from "./workspace-status-badge.tsx";

export type WorkspaceListProps = {
  items: readonly WorkspaceSummaryDto[];
  onOpenWorkspace?: (workspaceId: string) => void;
};

export function WorkspaceList({ items, onOpenWorkspace }: WorkspaceListProps) {
  return (
    <div className="workspace-management-table-wrapper" data-testid="workspace-list">
      <table className="workspace-management-table">
        <caption className="sr-only">Workspace list</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
            <th scope="col">Updated</th>
            <th scope="col">Failure</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((workspace) => (
            <tr key={workspace.workspaceId} data-testid="workspace-list-item">
              <td>
                <div className="workspace-management-name-cell">
                  <strong>{workspace.name}</strong>
                  {workspace.requestedProfile ? (
                    <span>{workspace.requestedProfile} profile</span>
                  ) : null}
                </div>
              </td>
              <td>
                <div className="workspace-management-status-cell">
                  <WorkspaceStatusBadge status={workspace.status} />
                  <span>{getWorkspaceStatusDescription(workspace.status)}</span>
                </div>
              </td>
              <td>
                <time dateTime={workspace.updatedAt}>
                  {formatWorkspaceTimestamp(workspace.updatedAt)}
                </time>
              </td>
              <td>
                {workspace.failure ? (
                  <span className="workspace-management-safe-failure">
                    {workspace.failure.message}
                  </span>
                ) : (
                  <span className="workspace-management-muted">None</span>
                )}
              </td>
              <td>
                {onOpenWorkspace ? (
                  <button
                    className="workspace-management-link-button"
                    type="button"
                    onClick={() => onOpenWorkspace(workspace.workspaceId)}
                  >
                    View details
                  </button>
                ) : (
                  <a
                    className="workspace-management-link"
                    href={`/workspaces/${encodeURIComponent(workspace.workspaceId)}`}
                  >
                    View details
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function formatWorkspaceTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
