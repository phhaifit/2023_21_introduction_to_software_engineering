import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import { KnowledgeBaseProcessingStatusScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-processing-status.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  IngestionJobDto,
  KnowledgeDocumentDto,
  SyncJobDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;
const pagination = {
  page: 1,
  pageSize: 100,
  totalItems: 4,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

const documents: KnowledgeDocumentDto[] = [
  createDocument("document-queued", "Queued.txt", "text/plain"),
  {
    ...createDocument("document-processing", "Processing.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    status: "ingesting"
  },
  {
    ...createDocument("document-ready", "Ready.pdf", "application/pdf"),
    status: "ready",
    chunkCount: 4,
    indexedChunkCount: 4
  },
  {
    ...createDocument("document-failed", "Failed.txt", "text/plain"),
    status: "failed"
  }
];

const jobs: IngestionJobDto[] = [
  createJob("job-queued", "document-queued", "pending", 80),
  createJob("job-processing", "document-processing", "ingesting", 65),
  createJob("job-ready", "document-ready", "ready", 20),
  {
    ...createJob("job-failed", "document-failed", "failed", 100),
    finishedAt: "2026-07-03T00:05:00.000Z",
    failure: {
      errorCode: "DOCUMENT_PROCESSING_FAILED",
      errorMessage: "The document could not be processed."
    }
  }
];

function createClient(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(async () => ({ items: documents, pagination })),
    listIngestionJobs: vi.fn(async () => ({ items: jobs, pagination })),
    listSyncJobs: vi.fn(async () => ({
      items: [],
      pagination: { ...pagination, totalItems: 0 }
    })),
    ...overrides
  } as unknown as KnowledgeBaseRagApiClient;
}

function createDocument(
  documentId: string,
  name: string,
  mediaType: string
): KnowledgeDocumentDto {
  return {
    documentId: documentId as EntityId<"documentId">,
    workspaceId,
    name,
    source: "upload",
    mediaType,
    sizeBytes: 128,
    status: "pending",
    chunkCount: 0,
    indexedChunkCount: 0,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  };
}

function createJob(
  jobId: string,
  documentId: string,
  status: IngestionJobDto["status"],
  progressPercent: number
): IngestionJobDto {
  return {
    jobId: jobId as EntityId<"ingestionJobId">,
    workspaceId,
    documentId: documentId as EntityId<"documentId">,
    status,
    progressPercent,
    queuedAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:01:00.000Z"
  };
}

describe("Knowledge Base / RAG Processing Status", () => {
  it("loads workspace jobs from the API and maps all lifecycle states", async () => {
    const client = createClient();

    render(
      <KnowledgeBaseProcessingStatusScreen apiClient={client} workspaceId={workspaceId} />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading processing status");
    expect((await screen.findAllByText("Queued.txt")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Queued").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);

    const queuedCard = screen.getAllByText("Queued.txt")[0].closest("article");
    const processingCard = screen.getByText("Processing.docx").closest("article");
    const readyCard = screen.getByText("Ready.pdf").closest("article");
    const failedCard = screen.getByText("Failed.txt").closest("article");
    expect(queuedCard && within(queuedCard).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0"
    );
    expect(processingCard && within(processingCard).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "65"
    );
    expect(readyCard && within(readyCard).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
    expect(failedCard && within(failedCard).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "99"
    );
    expect(screen.getByText("The document could not be processed.")).toBeTruthy();
    expect(client.listIngestionJobs).toHaveBeenCalledWith(workspaceId, {
      page: 1,
      pageSize: 100
    });
    expect(client.listDocuments).toHaveBeenCalledWith(workspaceId, {
      page: 1,
      pageSize: 100
    });
  });

  it("renders an API empty state without using prototype jobs", async () => {
    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient({
          listDocuments: vi.fn(async () => ({
            items: [],
            pagination: { ...pagination, totalItems: 0 }
          })),
          listIngestionJobs: vi.fn(async () => ({
            items: [],
            pagination: { ...pagination, totalItems: 0 }
          }))
        })}
        workspaceId={workspaceId}
      />
    );

    expect(await screen.findByText("No processing jobs")).toBeTruthy();
    expect(screen.queryByText("Employee Handbook.pdf")).toBeNull();
  });

  it("labels scheduled Google Drive jobs as automatic sync", async () => {
    const user = userEvent.setup();
    const scheduledJob: SyncJobDto = {
      jobId: "sync-scheduled" as EntityId<"jobId">,
      workspaceId,
      sourceId: "source-drive",
      status: "completed",
      requestedAt: "2026-07-05T00:00:00.000Z",
      startedAt: "2026-07-05T00:00:01.000Z",
      finishedAt: "2026-07-05T00:00:02.000Z",
      scannedItemCount: 4,
      changedItemCount: 2,
      importedItemCount: 1,
      updatedItemCount: 1,
      skippedUnchangedItemCount: 2,
      skippedUnsupportedItemCount: 0,
      removedItemCount: 1,
      failedItemCount: 0,
      syncMode: "scheduled"
    };

    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient({
          listDocuments: vi.fn(async () => ({
            items: [],
            pagination: { ...pagination, totalItems: 0 }
          })),
          listIngestionJobs: vi.fn(async () => ({
            items: [],
            pagination: { ...pagination, totalItems: 0 }
          })),
          listSyncJobs: vi.fn(async () => ({
            items: [scheduledJob],
            pagination: { ...pagination, totalItems: 1 }
          }))
        })}
        workspaceId={workspaceId}
      />
    );

    expect(await screen.findByText("Automatic sync")).toBeTruthy();
    const syncCard = screen.getByRole("heading", { name: "Google Drive sync" }).closest("article");
    expect(syncCard).not.toBeNull();
    expect(within(syncCard!).getByText("Imported 1 · Updated 1 · Skipped 2")).toBeTruthy();
    expect(within(syncCard!).queryByText("Discovered")).toBeNull();
    expect(within(syncCard!).queryByText("Removed")).toBeNull();
    expect(screen.queryByText("sync-scheduled")).toBeNull();

    await user.click(
      within(syncCard!).getByRole("button", { name: "View details" })
    );
    const details = screen.getByRole("dialog", { name: "Google Drive sync" });
    expect(within(details).getByText("Discovered")).toBeTruthy();
    expect(within(details).getByText("Skipped unchanged")).toBeTruthy();
    expect(within(details).getByText("Removed")).toBeTruthy();
    expect(within(details).queryByText("sync-scheduled")).toBeNull();
  });

  it("explains provider failures that happen before Drive scanning", async () => {
    const user = userEvent.setup();
    const failedSync: SyncJobDto = {
      jobId: "ca39c5dc-4144-433c-bf1b-60e0c682845f" as EntityId<"jobId">,
      workspaceId,
      sourceId: "source-drive",
      status: "failed",
      requestedAt: "2026-07-05T00:00:00.000Z",
      startedAt: "2026-07-05T00:00:01.000Z",
      finishedAt: "2026-07-05T00:00:02.000Z",
      scannedItemCount: 0,
      changedItemCount: 0,
      syncMode: "manual",
      failure: {
        errorCode: "google_drive.not_found",
        errorMessage:
          "The selected Drive file or folder could not be found or is not accessible."
      }
    };

    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient({
          listSyncJobs: vi.fn(async () => ({
            items: [failedSync],
            pagination: { ...pagination, totalItems: 1 }
          }))
        })}
        workspaceId={workspaceId}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "Google Drive sync" })
    ).toBeTruthy();
    expect(
      screen.getByText("Sync failed before any files could be scanned.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "The selected Drive file or folder could not be found or is not accessible."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(/GOOGLE_DRIVE_OAUTH_SCOPE_MODE=readonly/)
    ).toBeTruthy();
    expect(screen.queryByText(failedSync.jobId)).toBeNull();

    const failedSyncCard = screen
      .getByRole("heading", { name: "Google Drive sync" })
      .closest("article");
    await user.click(
      within(failedSyncCard!).getByRole("button", { name: "View details" })
    );
    const details = screen.getByRole("dialog", { name: "Google Drive sync" });
    expect(
      within(details).getByText(
        "The sync failed before any files could be scanned, so failed file count is 0."
      )
    ).toBeTruthy();
    expect(within(details).getByText("Failed files")).toBeTruthy();
  });

  it("shows a safe unavailable state and retries without rendering raw errors", async () => {
    const listIngestionJobs = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("storageKey=/private/uploads/a.txt Authorization: Bearer secret")
      )
      .mockResolvedValueOnce({ items: jobs, pagination });
    const user = userEvent.setup();

    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient({ listIngestionJobs })}
        workspaceId={workspaceId}
      />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Processing status is temporarily unavailable"
    );
    expect(screen.queryByText(/storageKey|Bearer secret/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText("Queued.txt")).length).toBeGreaterThan(0);
    expect(listIngestionJobs).toHaveBeenCalledTimes(2);
  });

  it("refreshes status manually and sanitizes unsafe failure details", async () => {
    const pendingJob = createJob("job-refresh", "document-queued", "pending", 0);
    const failedJob = {
      ...createJob("job-refresh", "document-queued", "failed", 20),
      failure: {
        errorCode: "DOCUMENT_PROCESSING_FAILED",
        errorMessage: "filePath=/private/upload token=secret"
      }
    };
    const listIngestionJobs = vi
      .fn()
      .mockResolvedValueOnce({ items: [pendingJob], pagination })
      .mockResolvedValueOnce({ items: [failedJob], pagination });
    const user = userEvent.setup();

    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient({ listIngestionJobs })}
        workspaceId={workspaceId}
      />
    );

    expect((await screen.findAllByText("Queued.txt")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(
      (
        await screen.findAllByText(
          "Processing failed. Review the document and try again."
        )
      ).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/private\/upload|token=secret/i)).toBeNull();
    expect(listIngestionJobs).toHaveBeenCalledTimes(2);
  });

  it("opens useful details and only presents retry for failed jobs", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient()}
        workspaceId={workspaceId}
      />
    );

    const readyCard = (await screen.findByText("Ready.pdf")).closest("article");
    expect(readyCard).not.toBeNull();
    expect(within(readyCard!).queryByText("Retry failed job")).toBeNull();
    await user.click(within(readyCard!).getByRole("button", { name: "View details" }));

    const readyDialog = screen.getByRole("dialog", { name: "Ready.pdf" });
    expect(within(readyDialog).getByText("Document status")).toBeVisible();
    expect(within(readyDialog).getByText("Ready", { selector: "strong" })).toBeVisible();
    expect(within(readyDialog).getByText("Processing job status")).toBeVisible();
    expect(within(readyDialog).getByText("Completed")).toBeVisible();
    expect(
      within(readyDialog).getByText("Ready for retrieval", { selector: "strong" })
    ).toBeVisible();
    expect(within(readyDialog).getByText("application/pdf")).toBeVisible();
    expect(within(readyDialog).getByText("4 of 4 chunks indexed")).toBeVisible();
    expect(within(readyDialog).queryByText("Retry failed job")).toBeNull();
    expect(within(readyDialog).queryByText("Debug details")).toBeNull();
    expect(within(readyDialog).queryByText("Job ID")).toBeNull();
    expect(within(readyDialog).queryByText("Document ID")).toBeNull();
    expect(within(readyDialog).queryByText("job-ready")).toBeNull();
    expect(within(readyDialog).queryByText("document-ready")).toBeNull();

    await user.click(
      within(readyDialog).getByRole("button", { name: "Close processing job details" })
    );
    const failedCard = screen.getByText("Failed.txt").closest("article");
    expect(failedCard).not.toBeNull();
    const retry = within(failedCard!).getByRole("button", {
      name: "Retry failed job"
    });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute("title", "Retry is not implemented yet.");
    await user.click(within(failedCard!).getByRole("button", { name: "View details" }));
    const failedDialog = screen.getByRole("dialog", { name: "Failed.txt" });
    expect(within(failedDialog).getByText("Failure reason")).toBeVisible();
    expect(
      within(failedDialog).getByText("The document could not be processed.")
    ).toBeVisible();
    expect(within(failedDialog).getByText("Not implemented yet")).toBeVisible();
  });

  it("shows safe Google Drive document metadata without internal IDs", async () => {
    const driveDocument: KnowledgeDocumentDto = {
      ...createDocument(
        "document-drive-private-id",
        "Equipment policy.pdf",
        "application/pdf"
      ),
      source: "google_drive",
      status: "ready",
      lastSyncedAt: "2026-07-05T02:00:00.000Z",
      sourceModifiedAt: "2026-07-05T01:30:00.000Z",
      chunkCount: 3,
      indexedChunkCount: 3
    };
    const driveJob = {
      ...createJob(
        "job-drive-private-id",
        "document-drive-private-id",
        "ready",
        100
      ),
      currentStep: "Ready for retrieval",
      finishedAt: "2026-07-05T02:00:00.000Z"
    };
    const user = userEvent.setup();

    render(
      <KnowledgeBaseProcessingStatusScreen
        apiClient={createClient({
          listDocuments: vi.fn(async () => ({
            items: [driveDocument],
            pagination: { ...pagination, totalItems: 1 }
          })),
          listIngestionJobs: vi.fn(async () => ({
            items: [driveJob],
            pagination: { ...pagination, totalItems: 1 }
          }))
        })}
        workspaceId={workspaceId}
      />
    );

    const card = (await screen.findByText("Equipment policy.pdf")).closest("article");
    await user.click(within(card!).getByRole("button", { name: "View details" }));
    const dialog = screen.getByRole("dialog", { name: "Equipment policy.pdf" });
    expect(within(dialog).getByText("Google Drive")).toBeTruthy();
    expect(within(dialog).getByText("Original Drive name")).toBeTruthy();
    expect(within(dialog).getByText("Last synced")).toBeTruthy();
    expect(within(dialog).getByText("Source modified")).toBeTruthy();
    expect(within(dialog).getByText("3 of 3 chunks indexed")).toBeTruthy();
    expect(within(dialog).queryByText("document-drive-private-id")).toBeNull();
    expect(within(dialog).queryByText("job-drive-private-id")).toBeNull();
  });
});
