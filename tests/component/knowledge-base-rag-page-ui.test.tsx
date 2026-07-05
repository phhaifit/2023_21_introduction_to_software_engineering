import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseRagPage } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-page.tsx";
import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";

afterEach(cleanup);

describe("KnowledgeBaseRagPage UI", () => {
  it("uses a user-facing title and exposes Google Drive source tabs", async () => {
    const apiClient = {
      listDocuments: vi.fn(async () => ({
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      }))
    } as unknown as KnowledgeBaseRagApiClient;

    render(<KnowledgeBaseRagPage apiClient={apiClient} />);

    expect(screen.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();
    expect(
      screen.getByText("Manage internal documents and knowledge sources used by agents.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Documents" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload Documents" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Processing Status" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Data Sources" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Synchronization Scope" })).toBeVisible();
    expect(screen.queryByText(/RAG Management/)).toBeNull();
  });
});
