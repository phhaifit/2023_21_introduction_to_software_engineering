import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkspaceSummaryDto } from "@vcp/shared/contracts/workspace-management.ts";

import { PageHeader } from "../../../components/layout/PageHeader.tsx";
import {
  createWorkspaceManagementApiClient,
  type WorkspaceManagementApiClient
} from "../api/workspace-api-client.ts";
import { WorkspaceCreateForm } from "../components/workspace-create-form.tsx";
import { WorkspaceList } from "../components/workspace-list.tsx";

import "../workspace-management.css";

type ListState =
  | "loading"
  | "empty"
  | "error"
  | "loaded"
  | "loading-next-page"
  | "pagination-error";

export type WorkspaceListPageProps = {
  apiClient?: WorkspaceManagementApiClient;
  onOpenWorkspace?: (workspaceId: string) => void;
};

export function WorkspaceListPage({
  apiClient: providedApiClient,
  onOpenWorkspace
}: WorkspaceListPageProps) {
  const apiClient = useMemo(
    () => providedApiClient ?? createWorkspaceManagementApiClient(),
    [providedApiClient]
  );
  const [items, setItems] = useState<WorkspaceSummaryDto[]>([]);
  const [state, setState] = useState<ListState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const result = await apiClient.listWorkspaces({ limit: 20 });
      setItems(result.items);
      setNextCursor(result.cursor.nextCursor);
      setHasMore(result.cursor.hasMore);
      setState(result.items.length === 0 ? "empty" : "loaded");
    } catch (caught) {
      setError(messageForListError(caught));
      setState("error");
    }
  }, [apiClient]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function loadNextPage() {
    if (!nextCursor || state === "loading-next-page") {
      return;
    }

    setState("loading-next-page");
    setError(null);

    try {
      const result = await apiClient.listWorkspaces({
        cursor: nextCursor,
        limit: 20
      });
      setItems((current) => mergeWorkspacePages(current, result.items));
      setNextCursor(result.cursor.nextCursor);
      setHasMore(result.cursor.hasMore);
      setState("loaded");
    } catch (caught) {
      setError(messageForListError(caught));
      setState("pagination-error");
    }
  }

  return (
    <section className="page-container workspace-management-page" aria-labelledby="workspace-list-title" data-testid="workspace-page">
      <PageHeader
        title="Workspaces"
        description="Create and review Workspace lifecycle status through the public Workspace API."
        eyebrow="Workspace Management"
      />

      <WorkspaceCreateForm
        onAccepted={(response) => {
          setItems((current) => mergeWorkspacePages([response.workspace], current));
          setState("loaded");
        }}
        onCreate={(input) =>
          apiClient.createWorkspace(
            {
              name: input.name,
              requestedProfile: input.requestedProfile
            },
            { idempotencyKey: input.idempotencyKey }
          )
        }
      />

      <div className="workspace-management-section">
        <div>
          <p className="workspace-management-eyebrow">Workspace list</p>
          <h2 id="workspace-list-title">Accessible workspaces</h2>
        </div>

        {state === "loading" ? (
          <div className="workspace-management-loading" role="status">
            Loading workspaces...
          </div>
        ) : null}

        {state === "empty" ? (
          <div className="workspace-management-empty" data-testid="workspace-empty-state">
            <h3>No workspaces yet</h3>
            <p>Create a workspace to start provisioning an OpenClaw runtime.</p>
          </div>
        ) : null}

        {state === "error" ? (
          <div className="workspace-management-alert workspace-management-alert--error" role="alert">
            {error}
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            <WorkspaceList items={items} onOpenWorkspace={onOpenWorkspace} />
            {state === "pagination-error" ? (
              <p className="workspace-management-alert workspace-management-alert--error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="workspace-management-secondary-button"
              disabled={!hasMore || state === "loading-next-page"}
              onClick={loadNextPage}
              type="button"
            >
              {state === "loading-next-page" ? "Loading more..." : "Load more"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

export function mergeWorkspacePages(
  current: readonly WorkspaceSummaryDto[],
  next: readonly WorkspaceSummaryDto[]
): WorkspaceSummaryDto[] {
  const byId = new Map<string, WorkspaceSummaryDto>();

  for (const item of current) {
    byId.set(item.workspaceId, item);
  }

  for (const item of next) {
    byId.set(item.workspaceId, item);
  }

  return Array.from(byId.values());
}

function messageForListError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);

    if (code === "auth.unauthorized") {
      return "Sign in to view workspaces.";
    }

    if (code === "validation.invalid_input") {
      return "The workspace cursor is invalid. Reload the list.";
    }

    if (code === "system.unavailable") {
      return "Workspace list is temporarily unavailable.";
    }
  }

  return "Unable to load workspaces.";
}
