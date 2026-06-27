import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkspaceDetailDto } from "@vcp/shared/contracts/workspace-management.ts";

import { PageHeader } from "../../../components/layout/PageHeader.tsx";
import {
  createWorkspaceManagementApiClient,
  type WorkspaceManagementApiClient
} from "../api/workspace-api-client.ts";
import { WorkspaceDeleteDialog } from "../components/workspace-delete-dialog.tsx";
import { WorkspaceDetail } from "../components/workspace-detail.tsx";

import "../workspace-management.css";

type DetailState = "loading" | "loaded" | "not-found" | "forbidden" | "error";

export type WorkspaceDetailPageProps = {
  apiClient?: WorkspaceManagementApiClient;
  workspaceId: string;
  onBack?: () => void;
};

export function WorkspaceDetailPage({
  apiClient: providedApiClient,
  workspaceId,
  onBack
}: WorkspaceDetailPageProps) {
  const apiClient = useMemo(
    () => providedApiClient ?? createWorkspaceManagementApiClient(),
    [providedApiClient]
  );
  const [workspace, setWorkspace] = useState<WorkspaceDetailDto | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDetail = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const detail = await apiClient.getWorkspace(workspaceId);
      setWorkspace(detail);
      setState("loaded");
    } catch (caught) {
      const mapped = mapDetailError(caught);
      setError(mapped.message);
      setState(mapped.state);
    }
  }, [apiClient, workspaceId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function requestDelete(idempotencyKey: string) {
    setIsDeleting(true);

    try {
      return await apiClient.deleteWorkspace(workspaceId, { idempotencyKey });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="page-container workspace-management-page" aria-labelledby="workspace-detail-page-title">
      <PageHeader
        title="Workspace detail"
        description="Core Workspace metadata and lifecycle state from the public API."
        eyebrow="Workspace Management"
      >
        {onBack ? (
          <button className="workspace-management-secondary-button" onClick={onBack} type="button">
            Back to workspaces
          </button>
        ) : (
          <a className="workspace-management-link" href="/workspaces">
            Back to workspaces
          </a>
        )}
      </PageHeader>

      {state === "loading" ? (
        <div className="workspace-management-loading" role="status">
          Loading workspace detail...
        </div>
      ) : null}

      {state === "not-found" ? (
        <div className="workspace-management-empty" role="status">
          <h2 id="workspace-detail-page-title">Workspace not found</h2>
          <p>{error ?? "This workspace is not available."}</p>
        </div>
      ) : null}

      {state === "forbidden" ? (
        <div className="workspace-management-alert workspace-management-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="workspace-management-alert workspace-management-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {state === "loaded" && workspace ? (
        <>
          <WorkspaceDetail
            deleteDisabled={isDeleting}
            onDeleteRequest={() => setIsDeleteDialogOpen(true)}
            workspace={workspace}
          />
          <WorkspaceDeleteDialog
            isDeleting={isDeleting}
            isOpen={isDeleteDialogOpen}
            onAccepted={(response) => {
              setWorkspace((current) =>
                current
                  ? {
                      ...current,
                      status: response.status,
                      deletionRequestedAt: response.acceptedAt,
                      updatedAt: response.acceptedAt
                    }
                  : current
              );
              setIsDeleteDialogOpen(false);
            }}
            onClose={() => setIsDeleteDialogOpen(false)}
            onDelete={requestDelete}
            workspaceName={workspace.name}
          />
        </>
      ) : null}
    </section>
  );
}

function mapDetailError(error: unknown): { state: DetailState; message: string } {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);

    if (code === "workspace.not_found") {
      return {
        state: "not-found",
        message: "The workspace was not found or is no longer available."
      };
    }

    if (code === "auth.forbidden") {
      return {
        state: "forbidden",
        message: "You do not have permission to view this workspace."
      };
    }

    if (code === "system.unavailable") {
      return {
        state: "error",
        message: "Workspace detail is temporarily unavailable."
      };
    }
  }

  return {
    state: "error",
    message: "Unable to load workspace detail."
  };
}
