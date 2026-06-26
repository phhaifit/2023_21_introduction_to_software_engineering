import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import { KnowledgeBaseUploadScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-upload.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  IngestionJobDto,
  KnowledgeDocumentDto,
  PrepareUploadResponse,
  UploadValidationResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;

const preparedDocument: KnowledgeDocumentDto = {
  documentId: "document-a" as EntityId<"documentId">,
  workspaceId,
  name: "Runbook.pdf",
  source: "upload",
  mediaType: "application/pdf",
  sizeBytes: 1024,
  status: "pending",
  chunkCount: 0,
  indexedChunkCount: 0,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z"
};

const ingestionJob: IngestionJobDto = {
  jobId: "job-a" as EntityId<"jobId">,
  workspaceId,
  documentId: preparedDocument.documentId,
  status: "pending",
  progressPercent: 0,
  queuedAt: "2026-06-26T00:00:00.000Z"
};

function createClient(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(),
    validateUploadCandidates: vi.fn(async (_workspaceId, request) => {
      const results = request.files.map((file) => ({
        clientFileId: file.clientFileId,
        fileName: file.fileName,
        status: file.fileName.endsWith(".pdf") ? "accepted" as const : "rejected" as const,
        message: file.fileName.endsWith(".pdf")
          ? "Accepted by API"
          : "Unsupported file type"
      }));

      return {
        results,
        acceptedCount: results.filter((result) => result.status === "accepted").length,
        rejectedCount: results.filter((result) => result.status === "rejected").length
      } satisfies UploadValidationResponse;
    }),
    prepareUpload: vi.fn(async () => ({
      documents: [preparedDocument],
      ingestionJobs: [ingestionJob]
    } satisfies PrepareUploadResponse)),
    listIngestionJobs: vi.fn(),
    listDataSources: vi.fn(),
    connectDataSource: vi.fn(),
    getSyncScope: vi.fn(),
    updateSyncScope: vi.fn(),
    requestManualSync: vi.fn(),
    listSyncJobs: vi.fn(),
    ...overrides
  } as unknown as KnowledgeBaseRagApiClient;
}

describe("Knowledge Base / RAG Upload API integration", () => {
  it("validates selected files through the API client using metadata only", async () => {
    const client = createClient();
    const user = userEvent.setup();

    render(<KnowledgeBaseUploadScreen apiClient={client} workspaceId={workspaceId} />);

    await user.upload(
      screen.getByLabelText("Choose documents to validate"),
      new File(["raw file bytes must not be sent"], "Runbook.pdf", {
        type: "application/pdf",
        lastModified: 1
      })
    );

    await waitFor(() => expect(client.validateUploadCandidates).toHaveBeenCalledTimes(1));
    const [calledWorkspaceId, request] = vi.mocked(client.validateUploadCandidates).mock.calls[0];

    expect(calledWorkspaceId).toBe(workspaceId);
    expect(request).toEqual({
      files: [
        {
          clientFileId: expect.stringMatching(/^candidate-0-/),
          fileName: "Runbook.pdf",
          mediaType: "application/pdf",
          sizeBytes: 31
        }
      ]
    });
    expect(JSON.stringify(request)).not.toContain("raw file bytes must not be sent");
    expect(JSON.stringify(request)).not.toContain("workspaceId");
    expect(await screen.findByText("Accepted by API")).toBeTruthy();
  });

  it("prepares only API-accepted candidates and reports success", async () => {
    const onUploadPrepared = vi.fn();
    const client = createClient();
    const user = userEvent.setup();

    render(
      <KnowledgeBaseUploadScreen
        apiClient={client}
        onUploadPrepared={onUploadPrepared}
        workspaceId={workspaceId}
      />
    );

    await user.upload(screen.getByLabelText("Choose documents to validate"), [
      new File(["pdf"], "Runbook.pdf", { type: "application/pdf", lastModified: 1 }),
      new File(["exe"], "Installer.exe", { type: "application/octet-stream", lastModified: 2 })
    ]);

    expect(await screen.findByText("Accepted by API")).toBeTruthy();
    expect(await screen.findByText("Unsupported file type")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Prepare valid files" }));

    await waitFor(() => expect(client.prepareUpload).toHaveBeenCalledTimes(1));
    const [calledWorkspaceId, request] = vi.mocked(client.prepareUpload).mock.calls[0];

    expect(calledWorkspaceId).toBe(workspaceId);
    expect(request.files).toHaveLength(1);
    expect(request.files[0]).toMatchObject({
      fileName: "Runbook.pdf",
      mediaType: "application/pdf",
      sizeBytes: 3
    });
    expect(JSON.stringify(request)).not.toContain("Installer.exe");
    expect(JSON.stringify(request)).not.toContain("workspaceId");
    expect(JSON.stringify(request)).not.toMatch(/credential|secret|token|rawEmbedding|vectorConfig/);
    expect(await screen.findByText("Prepared 1 document for ingestion.")).toBeTruthy();
    expect(onUploadPrepared).toHaveBeenCalledWith({
      documents: [preparedDocument],
      ingestionJobs: [ingestionJob]
    });
  });

  it("shows validation API errors and does not prepare rejected selections", async () => {
    const client = createClient({
      validateUploadCandidates: vi.fn(async () => {
        throw new Error("Validation API unavailable");
      })
    });
    const user = userEvent.setup();

    render(<KnowledgeBaseUploadScreen apiClient={client} workspaceId={workspaceId} />);

    await user.upload(
      screen.getByLabelText("Choose documents to validate"),
      new File(["pdf"], "Runbook.pdf", { type: "application/pdf", lastModified: 1 })
    );

    expect(await screen.findByText("Validation API unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prepare valid files" })).toBeDisabled();
    expect(client.prepareUpload).not.toHaveBeenCalled();
  });
});
