import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import { KnowledgeBaseSyncScopeScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-sync-scope.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceDto,
  SyncJobDto,
  SyncScopeNodeDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;
const connectedSource: KnowledgeDataSourceDto = {
  sourceId: "source-google-drive",
  externalId: "folder-existing",
  workspaceId,
  provider: "google_drive",
  displayName: "Google Drive",
  status: "connected",
  selectedScopeNodeCount: 2,
  updatedAt: "2026-06-26T00:00:00.000Z"
};

const rootNode: SyncScopeNodeDto = {
  scopeNodeId: "scope-root",
  sourceId: "source-google-drive",
  externalId: "file-existing",
  name: "Company Handbook",
  nodeType: "folder",
  selected: true,
  selectable: true,
  updatedAt: "2026-06-26T00:00:00.000Z"
};

const childNode: SyncScopeNodeDto = {
  scopeNodeId: "scope-child",
  sourceId: "source-google-drive",
  parentScopeNodeId: rootNode.scopeNodeId,
  name: "Benefits Overview.pdf",
  nodeType: "file",
  selected: false,
  selectable: true,
  updatedAt: "2026-06-26T00:00:00.000Z"
};

const syncJob: SyncJobDto = {
  jobId: "sync-job-a" as EntityId<"jobId">,
  workspaceId,
  sourceId: "source-google-drive",
  status: "pending",
  requestedAt: "2026-06-26T00:05:00.000Z",
  scannedItemCount: 0,
  changedItemCount: 0
};

function createClient(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(),
    validateUploadCandidates: vi.fn(),
    prepareUpload: vi.fn(),
    listIngestionJobs: vi.fn(),
    listDataSources: vi.fn(async () => [connectedSource]),
    connectDataSource: vi.fn(),
    getSyncScope: vi.fn(async () => [rootNode, childNode]),
    configureGoogleDriveScope: vi.fn(async () => [rootNode, childNode]),
    configureGoogleDriveAutoSync: vi.fn(async () => ({
      ...connectedSource,
      autoSyncEnabled: true,
      autoSyncFrequency: "hourly"
    })),
    requestManualSync: vi.fn(async () => syncJob),
    listSyncJobs: vi.fn(async () => ({
      items: [syncJob],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })),
    ...overrides
  } as unknown as KnowledgeBaseRagApiClient;
}

describe("Knowledge Base / RAG Sync Scope API integration", () => {
  it("loads sync scope and sync jobs through the API client", async () => {
    const client = createClient();

    render(<KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading synchronization scope");
    expect(await screen.findByLabelText("Paste Drive file/folder URLs or IDs")).toBeTruthy();
    expect(screen.getByText("sync-job-a")).toBeTruthy();
    expect(client.getSyncScope).toHaveBeenCalledWith(workspaceId);
    expect(client.listSyncJobs).toHaveBeenCalledWith(workspaceId);
  });

  it("renders empty and error states without mock scope nodes", async () => {
    const emptyClient = createClient({
      getSyncScope: vi.fn(async () => []),
      listSyncJobs: vi.fn(async () => ({
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      }))
    });
    const failingClient = createClient({
      getSyncScope: vi.fn(async () => {
        throw new Error("Sync scope API unavailable");
      })
    });

    const { unmount } = render(
      <KnowledgeBaseSyncScopeScreen apiClient={emptyClient} workspaceId={workspaceId} />
    );
    expect(await screen.findByLabelText("Paste Drive file/folder URLs or IDs")).toBeTruthy();
    unmount();

    render(<KnowledgeBaseSyncScopeScreen apiClient={failingClient} workspaceId={workspaceId} />);
    expect(
      await screen.findByText(/Some synchronization details could not be loaded/)
    ).toBeTruthy();
    expect(screen.getByLabelText("Paste Drive file/folder URLs or IDs")).toBeTruthy();
  });

  it("shows ID-only instructions for Google Docs, files, and folders", async () => {
    render(
      <KnowledgeBaseSyncScopeScreen
        apiClient={createClient({
          getSyncScope: vi.fn(async () => []),
          listSyncJobs: vi.fn(async () => ({
            items: [],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false
            }
          }))
        })}
        workspaceId={workspaceId}
      />
    );

    expect(
      await screen.findByText(/Choose which Google Drive files or folders/)
    ).toBeTruthy();
    expect(screen.getByText(/docs\.google\.com\/document\/d/)).toBeTruthy();
    expect(screen.getByText(/drive\.google\.com\/file\/d/)).toBeTruthy();
    expect(screen.getByText(/drive\.google\.com\/drive\/folders/)).toBeTruthy();
    expect(
      screen.getByText("182d96jUaHozp6IrL8Ne55-YmSQSePagGfy85y3t2W6g")
    ).toBeTruthy();
    expect(screen.getByText(/Full URLs are normalized automatically/)).toBeTruthy();
  });

  it("normalizes Drive URLs and saves Auto Sync settings", async () => {
    const client = createClient({
      getSyncScope: vi.fn(async () => [])
    });
    const user = userEvent.setup();

    render(<KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />);

    await user.type(
      await screen.findByLabelText("Paste Drive file/folder URLs or IDs"),
      "https://drive.google.com/drive/folders/folder-a?usp=sharing{enter}https://docs.google.com/document/d/file-a/edit?tab=t.0"
    );
    await user.click(screen.getByLabelText("Include nested folders"));
    await user.click(screen.getByLabelText("Enable Auto Sync"));
    await user.selectOptions(screen.getByLabelText("Auto Sync frequency"), "hourly");
    await user.click(screen.getByRole("button", { name: "Save Google Drive scope" }));

    await waitFor(() => expect(client.configureGoogleDriveScope).toHaveBeenCalledTimes(1));
    expect(client.configureGoogleDriveScope).toHaveBeenCalledWith(
      workspaceId,
      "source-google-drive",
      expect.objectContaining({
        folderIds: ["folder-a"],
        fileIds: ["file-a"],
        recursive: true,
        maxFiles: 100
      })
    );
    expect(client.configureGoogleDriveAutoSync).toHaveBeenCalledWith(
      workspaceId,
      "source-google-drive",
      { autoSyncEnabled: true, autoSyncFrequency: "hourly" }
    );
    expect(JSON.stringify(vi.mocked(client.configureGoogleDriveScope).mock.calls[0][2])).not.toMatch(
      /workspaceId|credential|secret|token|refresh|password|storageKey|vectorRef|queuePayload/i
    );
    expect(await screen.findByText("Synchronization scope updated.")).toBeTruthy();
  });

  it("requests manual sync as a queued intent without worker runtime payloads", async () => {
    const client = createClient();
    const user = userEvent.setup();

    render(<KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />);

    await screen.findByLabelText("Paste Drive file/folder URLs or IDs");
    await user.click(screen.getByRole("button", { name: "Request manual sync" }));

    await waitFor(() => expect(client.requestManualSync).toHaveBeenCalledTimes(1));
    expect(client.requestManualSync).toHaveBeenCalledWith(workspaceId, {
      sourceId: "source-google-drive",
      scopeNodeIds: ["scope-root"]
    });
    expect(JSON.stringify(vi.mocked(client.requestManualSync).mock.calls[0][1])).not.toMatch(
      /credential|secret|token|refresh|password|rawProvider|worker|queuePayload|vectorConfig/i
    );
    expect(await screen.findByText("Manual sync requested.")).toBeTruthy();
  });
});
