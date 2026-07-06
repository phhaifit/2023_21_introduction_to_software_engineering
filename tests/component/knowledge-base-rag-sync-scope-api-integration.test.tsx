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
  it("loads saved scope without rendering duplicated sync history", async () => {
    const client = createClient();

    render(<KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading synchronization scope");
    const input = await screen.findByLabelText("Paste Drive file/folder URLs or IDs");
    expect(input).toHaveValue("");
    expect(client.getSyncScope).toHaveBeenCalledWith(workspaceId);
    expect(client.listSyncJobs).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Saved Drive content" })).toBeTruthy();
    expect(screen.getByText("Company Handbook")).toBeTruthy();
    expect(screen.queryByText(rootNode.externalId!)).toBeNull();
    expect(screen.queryByText("sync-job-a")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sync jobs" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
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
      await screen.findByText(/Saved scope is temporarily unavailable/)
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
    expect(screen.getByText(/Full URLs and raw IDs are accepted/)).toBeTruthy();
  });

  it("normalizes Drive URLs and saves Auto Sync settings", async () => {
    const savedFileId = "file-a";
    const savedFolderId = "folder-a";
    const client = createClient({
      getSyncScope: vi.fn(async () => []),
      configureGoogleDriveScope: vi.fn(async () => [
        {
          ...rootNode,
          scopeNodeId: "saved-folder",
          externalId: savedFolderId,
          name: `Folder ${savedFolderId}`,
          nodeType: "folder",
          selected: true
        },
        {
          ...childNode,
          scopeNodeId: "saved-file",
          parentScopeNodeId: undefined,
          externalId: savedFileId,
          name: `File ${savedFileId}`,
          selected: true
        }
      ])
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
    await user.click(screen.getByRole("button", { name: "Save scope" }));

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
    expect(screen.getByLabelText("Paste Drive file/folder URLs or IDs")).toHaveValue("");
    expect(screen.getByText("Google Drive folder")).toBeTruthy();
    expect(screen.getByText("Google Drive file")).toBeTruthy();
    expect(screen.queryByText(savedFolderId)).toBeNull();
    expect(screen.queryByText(savedFileId)).toBeNull();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
  });

  it("does not repopulate new input with saved raw Drive IDs after reload", async () => {
    const rawDriveId = "1PrivateSavedDriveFileIdForScope";
    const savedNode: SyncScopeNodeDto = {
      ...childNode,
      scopeNodeId: "saved-drive-file",
      parentScopeNodeId: undefined,
      externalId: rawDriveId,
      name: `File ${rawDriveId}`,
      selected: true
    };
    const client = createClient({
      getSyncScope: vi.fn(async () => [savedNode])
    });

    const { unmount } = render(
      <KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />
    );
    expect(
      await screen.findByLabelText("Paste Drive file/folder URLs or IDs")
    ).toHaveValue("");
    expect(screen.getByText("Google Drive file")).toBeTruthy();
    expect(screen.queryByText(rawDriveId)).toBeNull();
    unmount();

    render(<KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />);
    expect(
      await screen.findByLabelText("Paste Drive file/folder URLs or IDs")
    ).toHaveValue("");
    expect(screen.getByText("Google Drive file")).toBeTruthy();
    expect(screen.queryByText(rawDriveId)).toBeNull();
  });

  it("shows simple sections and syncs now without exposing internal runtime wording", async () => {
    const client = createClient();
    const user = userEvent.setup();

    render(<KnowledgeBaseSyncScopeScreen apiClient={client} workspaceId={workspaceId} />);

    await screen.findByLabelText("Paste Drive file/folder URLs or IDs");
    expect(screen.getByRole("heading", { name: "Drive content" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sync settings" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Save and sync" })).toBeTruthy();
    expect(screen.queryByText(/^Step 1$/i)).toBeNull();
    expect(screen.queryByText(/^Step 2$/i)).toBeNull();
    expect(screen.queryByText(/Step 3/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Request manual sync" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(client.requestManualSync).toHaveBeenCalledTimes(1));
    expect(client.requestManualSync).toHaveBeenCalledWith(workspaceId, {
      sourceId: "source-google-drive",
      scopeNodeIds: ["scope-root"]
    });
    expect(JSON.stringify(vi.mocked(client.requestManualSync).mock.calls[0][1])).not.toMatch(
      /credential|secret|token|refresh|password|rawProvider|worker|queuePayload|vectorConfig/i
    );
    expect(
      await screen.findByText("Sync job started. View progress in Processing Status.")
    ).toBeTruthy();
  });

  it("disables Sync now until at least one scope item has been saved", async () => {
    render(
      <KnowledgeBaseSyncScopeScreen
        apiClient={createClient({
          getSyncScope: vi.fn(async () => [])
        })}
        workspaceId={workspaceId}
      />
    );

    const syncButton = await screen.findByRole("button", { name: "Sync now" });
    expect(syncButton).toBeDisabled();
    expect(
      screen.getByText("Save at least one Drive file or folder before syncing.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save scope" })).toBeDisabled();
    expect(screen.queryByText(/Notion|Confluence/i)).toBeNull();
  });
});
