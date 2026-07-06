import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import { KnowledgeBaseDataSourcesScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-data-sources.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDataSourceDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";

afterEach(cleanup);

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
  selectedScopeNodeCount: 2,
  lastSyncAt: "2026-06-26T00:10:00.000Z"
};

function createClient(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(),
    validateUploadCandidates: vi.fn(),
    prepareUpload: vi.fn(),
    listIngestionJobs: vi.fn(),
    listDataSources: vi.fn(async () => [notConnectedSource]),
    connectDataSource: vi.fn(async () => connectedSource),
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
    expect(screen.getByText("External data sources")).toBeTruthy();
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
    expect(await screen.findByText("No data sources available")).toBeTruthy();
    expect(screen.queryByText("Google Drive")).toBeNull();
    unmount();

    render(<KnowledgeBaseDataSourcesScreen apiClient={failingClient} workspaceId={workspaceId} />);
    expect(await screen.findByText("Data source API unavailable")).toBeTruthy();
  });

  it("connects a data source placeholder without credentials or private payloads", async () => {
    const client = createClient();
    const user = userEvent.setup();

    render(<KnowledgeBaseDataSourcesScreen apiClient={client} workspaceId={workspaceId} />);

    await screen.findByRole("heading", { name: "Google Drive" });
    await user.click(screen.getByRole("button", { name: "Connect source" }));

    await waitFor(() => expect(client.connectDataSource).toHaveBeenCalledTimes(1));
    expect(client.connectDataSource).toHaveBeenCalledWith(workspaceId, "source-google-drive");
    expect(JSON.stringify(vi.mocked(client.connectDataSource).mock.calls[0])).not.toMatch(
      /credential|secret|token|refresh|password|rawProvider/i
    );
    expect(await screen.findByText("Google Drive connection placeholder recorded.")).toBeTruthy();
  });
});
