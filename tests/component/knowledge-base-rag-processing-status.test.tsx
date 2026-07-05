import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import { KnowledgeBaseProcessingStatusScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-processing-status.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  IngestionJobDto,
  KnowledgeDocumentDto
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
});
