import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseDocumentsScreen } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-documents.tsx";
import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;
const pagination = {
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

const documentDto: KnowledgeDocumentDto = {
  documentId: "document-a" as EntityId<"documentId">,
  workspaceId,
  name: "Runbook.pdf",
  source: "upload",
  mediaType: "application/pdf",
  sizeBytes: 2048,
  status: "ready",
  chunkCount: 4,
  indexedChunkCount: 4,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:10:00.000Z"
};

function createClient(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(async () => ({ items: [documentDto], pagination })),
    validateUploadCandidates: vi.fn(),
    prepareUpload: vi.fn(),
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

describe("Knowledge Base / RAG Documents API integration", () => {
  it("loads documents through the API client and renders API-backed DTOs", async () => {
    const client = createClient();

    render(<KnowledgeBaseDocumentsScreen apiClient={client} workspaceId={workspaceId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace documents");
    expect(await screen.findByText("Runbook.pdf")).toBeTruthy();
    expect(screen.getByText("4 of 4 chunks indexed.")).toBeTruthy();
    expect(client.listDocuments).toHaveBeenCalledWith(workspaceId);
  });

  it("renders the API empty state without mock documents", async () => {
    render(
      <KnowledgeBaseDocumentsScreen
        apiClient={createClient({
          listDocuments: vi.fn(async () => ({ items: [], pagination: { ...pagination, totalItems: 0 } }))
        })}
        workspaceId={workspaceId}
      />
    );

    expect(await screen.findByText("No documents available")).toBeTruthy();
    expect(screen.queryByText("Runbook.pdf")).toBeNull();
  });

  it("shows API errors and retries the list request", async () => {
    const listDocuments = vi
      .fn()
      .mockRejectedValueOnce(new Error("Documents API unavailable"))
      .mockResolvedValueOnce({ items: [documentDto], pagination });
    const client = createClient({ listDocuments });
    const user = userEvent.setup();

    render(<KnowledgeBaseDocumentsScreen apiClient={client} workspaceId={workspaceId} />);

    expect(await screen.findByText("Documents API unavailable")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Runbook.pdf")).toBeTruthy();
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });
});
