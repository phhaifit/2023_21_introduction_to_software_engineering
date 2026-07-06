import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { AgentKnowledgeAssignmentPanel } from "@vcp/frontend/features/agent-management/agent-knowledge-assignment-panel.tsx";
import type { KnowledgeBaseRagApiClient } from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import type { AgentKnowledgeDocumentDto, KnowledgeDocumentDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;
const agentId = "agent-a" as EntityId<"agentId">;
const assignedDocument = createDocumentDto("document-a", "Support Handbook");
const availableDocument = createDocumentDto("document-b", "Equipment Policy");
const assignment: AgentKnowledgeDocumentDto = {
  workspaceId,
  agentId,
  document: assignedDocument,
  grantStatus: "active"
};

function client(overrides: Partial<KnowledgeBaseRagApiClient> = {}) {
  return {
    listDocuments: vi.fn(async () => ({
      items: [assignedDocument, availableDocument],
      pagination: {
        page: 1,
        pageSize: 100,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })),
    listAgentKnowledgeDocuments: vi.fn(async () => [assignment]),
    assignAgentKnowledgeDocument: vi.fn(async (_workspace, _agent, documentId) => ({
      workspaceId,
      agentId,
      document: documentId === availableDocument.documentId
        ? availableDocument
        : assignedDocument,
      grantStatus: "active"
    })),
    revokeAgentKnowledgeDocument: vi.fn(async (_workspace, _agent, documentId) => ({
      workspaceId,
      agentId,
      document: documentId === assignedDocument.documentId
        ? assignedDocument
        : availableDocument,
      grantStatus: "revoked"
    })),
    ...overrides
  } as unknown as KnowledgeBaseRagApiClient;
}

function renderPanel(apiClient = client(), canManage = true) {
  render(
    <AgentKnowledgeAssignmentPanel
      workspaceId={workspaceId}
      agentId={agentId}
      apiClient={apiClient}
      canManage={canManage}
    />
  );
  return apiClient;
}

describe("AgentKnowledgeAssignmentPanel", () => {
  it("loads assigned and available documents from API data", async () => {
    const apiClient = client();
    renderPanel(apiClient);

    expect(screen.getByRole("status")).toHaveTextContent("Loading knowledge");
    const assigned = await screen.findByRole("region", { name: "Assigned documents" });
    const available = screen.getByRole("region", { name: "Available documents" });
    expect(within(assigned).getByText("Support Handbook")).toBeTruthy();
    expect(within(available).getByText("Equipment Policy")).toBeTruthy();
    expect(apiClient.listDocuments).toHaveBeenCalledWith(workspaceId, {
      page: 1,
      pageSize: 100
    });
    expect(apiClient.listAgentKnowledgeDocuments).toHaveBeenCalledWith(
      workspaceId,
      agentId
    );
  });

  it("renders empty assigned and available states without runtime mock data", async () => {
    renderPanel(
      client({
        listDocuments: vi.fn(async () => ({
          items: [],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        })),
        listAgentKnowledgeDocuments: vi.fn(async () => [])
      })
    );

    expect(
      await screen.findByText(/No documents assigned.*will not retrieve/i)
    ).toBeTruthy();
    expect(screen.getByText("No knowledge documents are available.")).toBeTruthy();
    expect(screen.queryByText("Support Handbook")).toBeNull();
  });

  it("assigns an available document and updates both lists", async () => {
    const apiClient = client();
    const user = userEvent.setup();
    renderPanel(apiClient);
    await screen.findByText("Equipment Policy");

    await user.click(screen.getByRole("button", { name: "Assign Equipment Policy" }));

    expect(apiClient.assignAgentKnowledgeDocument).toHaveBeenCalledWith(
      workspaceId,
      agentId,
      availableDocument.documentId
    );
    expect(await screen.findByText("Equipment Policy assigned.")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Assigned documents" })).getByText(
        "Equipment Policy"
      )
    ).toBeTruthy();
  });

  it("revokes an assigned document and returns it to available documents", async () => {
    const apiClient = client();
    const user = userEvent.setup();
    renderPanel(apiClient);
    await screen.findByText("Support Handbook");

    await user.click(screen.getByRole("button", { name: "Revoke Support Handbook" }));

    expect(apiClient.revokeAgentKnowledgeDocument).toHaveBeenCalledWith(
      workspaceId,
      agentId,
      assignedDocument.documentId
    );
    expect(await screen.findByText("Support Handbook access revoked.")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Available documents" })).getByText(
        "Support Handbook"
      )
    ).toBeTruthy();
  });

  it("shows only safe load/assign/remove errors and supports retry", async () => {
    const retryClient = client({
      listDocuments: vi
        .fn()
        .mockRejectedValueOnce(
          new Error("storageKey=/private/a rawVector providerPayload secret")
        )
        .mockResolvedValueOnce({
          items: [availableDocument],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        }),
      listAgentKnowledgeDocuments: vi.fn(async () => [])
    });
    const user = userEvent.setup();
    renderPanel(retryClient);

    expect(
      await screen.findByText("Unable to load agent knowledge documents.")
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /storageKey|private\/a|rawVector|providerPayload|secret/
    );
    await user.click(
      screen.getByRole("button", { name: "Retry knowledge documents" })
    );
    expect(await screen.findByText("Equipment Policy")).toBeTruthy();

    retryClient.assignAgentKnowledgeDocument = vi.fn(async () => {
      throw new Error("absolutePath queuePayload stackTrace credential");
    });
    await user.click(screen.getByRole("button", { name: "Assign Equipment Policy" }));
    expect(await screen.findByText("Unable to assign document.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /absolutePath|queuePayload|stackTrace|credential/
    );
  });

  it("disables mutation buttons while assign and revoke requests are in flight", async () => {
    let resolveAssign!: (value: AgentKnowledgeDocumentDto) => void;
    const assignPromise = new Promise<AgentKnowledgeDocumentDto>((resolve) => {
      resolveAssign = resolve;
    });
    let resolveRevoke!: (value: AgentKnowledgeDocumentDto) => void;
    const revokePromise = new Promise<AgentKnowledgeDocumentDto>((resolve) => {
      resolveRevoke = resolve;
    });
    const apiClient = client({
      assignAgentKnowledgeDocument: vi.fn(() => assignPromise),
      revokeAgentKnowledgeDocument: vi.fn(() => revokePromise)
    });
    const user = userEvent.setup();
    renderPanel(apiClient);
    await screen.findByText("Equipment Policy");

    await user.click(screen.getByRole("button", { name: "Assign Equipment Policy" }));
    expect(screen.getByRole("button", { name: "Assign Equipment Policy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revoke Support Handbook" })).toBeDisabled();
    resolveAssign({
      workspaceId,
      agentId,
      document: availableDocument,
      grantStatus: "active"
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Assign Equipment Policy" })
      ).toBeNull()
    );

    await user.click(screen.getByRole("button", { name: "Revoke Support Handbook" }));
    expect(screen.getByRole("button", { name: "Revoke Support Handbook" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revoke Equipment Policy" })).toBeDisabled();
    resolveRevoke({
      workspaceId,
      agentId,
      document: assignedDocument,
      grantStatus: "revoked"
    });
    expect(await screen.findByText("Support Handbook access revoked.")).toBeTruthy();
  });

  it("hides assignment mutations in viewer mode", async () => {
    renderPanel(client(), false);
    await screen.findByText("Support Handbook");
    expect(screen.queryByRole("button", { name: /Assign / })).toBeNull();
    expect(screen.queryByRole("button", { name: /Revoke / })).toBeNull();
  });

  it("does not import local mock documents as a runtime source", () => {
    const source = readFileSync(
      "apps/frontend/src/features/agent-management/agent-knowledge-assignment-panel.tsx",
      "utf8"
    );
    expect(source).not.toMatch(/mock-data|knowledge-base-rag-mock-data/);
    expect(source).toMatch(/listDocuments/);
    expect(source).toMatch(/listAgentKnowledgeDocuments/);
  });
});

function createDocumentDto(
  documentId: string,
  name: string
): KnowledgeDocumentDto {
  return {
    documentId: documentId as EntityId<"documentId">,
    workspaceId,
    name,
    source: "upload",
    mediaType: "text/plain",
    sizeBytes: 100,
    status: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  };
}
