import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseRagPage } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-page.tsx";
import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("KnowledgeBaseRagPage UI", () => {
  it("uses a user-facing title and exposes one Data Sync tab", async () => {
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
    expect(screen.getByRole("button", { name: "Data Sync" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Data Sources" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Synchronization Scope" })).toBeNull();
    expect(screen.queryByText(/RAG Management/)).toBeNull();
  });

  it("maps the OAuth callback to the combined Data Sync tab", async () => {
    window.history.replaceState(
      {},
      "",
      "/knowledge-base-rag?tab=data-sync&googleDrive=connected"
    );
    const apiClient = {
      listDataSources: vi.fn(async () => []),
      getSyncScope: vi.fn(async () => [])
    } as unknown as KnowledgeBaseRagApiClient;

    render(<KnowledgeBaseRagPage apiClient={apiClient} />);

    expect(await screen.findByRole("heading", { name: "Google Drive" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Data Sync" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByText("Google Drive connected successfully.")
    ).toBeVisible();
  });
});
