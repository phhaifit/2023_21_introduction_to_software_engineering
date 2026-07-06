import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import { KnowledgeBaseDataSourcesScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-data-sources.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDataSourceDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  window.history.replaceState({}, "", "/");
});

const workspaceId = "workspace-a" as EntityId<"workspaceId">;

const notConnectedSource: KnowledgeDataSourceDto = {
  sourceId: "source-google-drive",
  workspaceId,
  provider: "google_drive",
  displayName: "Google Drive",
  status: "not_connected",
  selectedScopeNodeCount: 0,
  updatedAt: "2026-06-26T00:00:00.000Z"
};

const connectedSource: KnowledgeDataSourceDto = {
  ...notConnectedSource,
  status: "connected",
  connectedAccountEmail: "researcher@example.test",
  selectedScopeNodeCount: 2,
  lastSyncAt: "2026-06-26T00:10:00.000Z"
};
const connectedWithoutScope: KnowledgeDataSourceDto = {
  ...connectedSource,
  selectedScopeNodeCount: 0,
  lastSyncAt: undefined
};

function createClient(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(),
    validateUploadCandidates: vi.fn(),
    prepareUpload: vi.fn(),
    listIngestionJobs: vi.fn(),
    listDataSources: vi.fn(async () => [notConnectedSource]),
    startGoogleDriveOAuth: vi.fn(async () => ({
      authorizationUrl: "https://accounts.google.test/oauth"
    })),
    disconnectDataSource: vi.fn(async () => notConnectedSource),
    getSyncScope: vi.fn(),
    updateSyncScope: vi.fn(),
    requestManualSync: vi.fn(),
    listSyncJobs: vi.fn(),
    ...overrides
  } as unknown as KnowledgeBaseRagApiClient;
}

describe("Knowledge Base / RAG Data Sources API integration", () => {
  it("loads data sources through the API client and renders API-backed cards", async () => {
    const client = createClient();

    render(<KnowledgeBaseDataSourcesScreen apiClient={client} workspaceId={workspaceId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading data sources");
    expect(await screen.findByRole("heading", { name: "Google Drive" })).toBeTruthy();
    expect(screen.queryByLabelText("Data source summary")).toBeNull();
    expect(screen.queryByText("Needs attention")).toBeNull();
    expect(screen.queryByText("Google Drive connected successfully.")).toBeNull();
    expect(client.listDataSources).toHaveBeenCalledWith(workspaceId);
  });

  it("renders empty and error states without mock data", async () => {
    const emptyClient = createClient({ listDataSources: vi.fn(async () => []) });
    const failingClient = createClient({
      listDataSources: vi.fn(async () => {
        throw new Error("Data source API unavailable");
      })
    });

    const { unmount } = render(
      <KnowledgeBaseDataSourcesScreen apiClient={emptyClient} workspaceId={workspaceId} />
    );
    expect(await screen.findByRole("heading", { name: "Connect Google Drive" })).toBeTruthy();
    unmount();

    render(<KnowledgeBaseDataSourcesScreen apiClient={failingClient} workspaceId={workspaceId} />);
    expect(await screen.findByText("Data source API unavailable")).toBeTruthy();
  });

  it("starts Google Drive OAuth without credentials in the frontend payload", async () => {
    const client = createClient();
    const navigateToOAuth = vi.fn();
    const user = userEvent.setup();

    render(
      <KnowledgeBaseDataSourcesScreen
        apiClient={client}
        navigateToOAuth={navigateToOAuth}
        workspaceId={workspaceId}
      />
    );

    await screen.findByRole("heading", { name: "Google Drive" });
    await user.click(screen.getByRole("button", { name: "Connect Google Drive" }));

    await waitFor(() => expect(client.startGoogleDriveOAuth).toHaveBeenCalledTimes(1));
    expect(client.startGoogleDriveOAuth).toHaveBeenCalledWith(workspaceId, {
      displayName: "Google Drive"
    });
    expect(JSON.stringify(vi.mocked(client.startGoogleDriveOAuth).mock.calls[0])).not.toMatch(
      /credential|secret|token|refresh|password|rawProvider/i
    );
    expect(navigateToOAuth).toHaveBeenCalledWith("https://accounts.google.test/oauth");
  });

  it("shows callback success and keeps sync actions in the scope section", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      {},
      "",
      "/knowledge-base-rag?tab=data-sync&googleDrive=connected"
    );
    const client = createClient({
      listDataSources: vi.fn(async () => [connectedWithoutScope])
    });
    render(
      <KnowledgeBaseDataSourcesScreen
        apiClient={client}
        workspaceId={workspaceId}
      />
    );

    expect(
      await screen.findByText("Google Drive connected successfully.")
    ).toBeTruthy();
    expect(window.location.search).toBe("?tab=data-sync");
    expect(screen.getByText("researcher@example.test")).toBeTruthy();
    expect(screen.getByText("Not synced")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Configure scope" })).toBeNull();
    expect(client.requestManualSync).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Dismiss Google Drive notice" })
    );
    expect(screen.queryByText("Google Drive connected successfully.")).toBeNull();
  });

  it("shows automatic sync schedule for a configured source", async () => {
    render(
      <KnowledgeBaseDataSourcesScreen
        apiClient={createClient({
          listDataSources: vi.fn(async () => [
            {
              ...connectedSource,
              autoSyncEnabled: true,
              autoSyncFrequency: "hourly",
              nextAutoSyncAt: "2026-06-26T01:10:00.000Z",
              lastSyncStatus: "completed"
            }
          ])
        })}
        workspaceId={workspaceId}
      />
    );

    expect(await screen.findByText("Hourly")).toBeTruthy();
    expect(screen.getByText("Selected items")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
  });

  it("auto-hides the OAuth success notice after five seconds", () => {
    vi.useFakeTimers();
    window.history.replaceState(
      {},
      "",
      "/knowledge-base-rag?tab=data-sync&googleDrive=connected"
    );

    render(
      <KnowledgeBaseDataSourcesScreen
        apiClient={createClient()}
        workspaceId={workspaceId}
      />
    );

    expect(screen.getByText("Google Drive connected successfully.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText("Google Drive connected successfully.")).toBeNull();
  });
});
