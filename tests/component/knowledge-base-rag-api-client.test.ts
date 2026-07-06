import { describe, expect, it, vi } from "vitest";

import {
  KnowledgeBaseRagApiClientError,
  createKnowledgeBaseRagApiClient
} from "@vcp/frontend/features/knowledge-base-rag/knowledge-base-rag-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

const workspaceId = "workspace/a b" as EntityId<"workspaceId">;
const agentId = "agent/a b" as EntityId<"agentId">;
const encodedWorkspacePath = "/api/workspaces/workspace%2Fa%20b/knowledge";

const pagination = {
  page: 2,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: true
};

const document = {
  documentId: "document-a",
  workspaceId,
  name: "Runbook.pdf",
  source: "upload" as const,
  mediaType: "application/pdf",
  sizeBytes: 1024,
  status: "ready" as const,
  chunkCount: 2,
  indexedChunkCount: 2,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:01:00.000Z"
};

const ingestionJob = {
  jobId: "ingestion-job-a",
  workspaceId,
  documentId: "document-a",
  status: "pending" as const,
  progressPercent: 0,
  queuedAt: "2026-06-26T00:02:00.000Z"
};

const dataSource = {
  sourceId: "source/a b",
  workspaceId,
  provider: "notion" as const,
  displayName: "Company Notion",
  status: "connected" as const,
  selectedScopeNodeCount: 1,
  updatedAt: "2026-06-26T00:03:00.000Z"
};

const scopeNode = {
  scopeNodeId: "scope-node-a",
  sourceId: dataSource.sourceId,
  name: "Runbooks",
  nodeType: "page" as const,
  selected: true,
  selectable: true,
  updatedAt: "2026-06-26T00:04:00.000Z"
};

const syncJob = {
  jobId: "sync-job-a",
  workspaceId,
  sourceId: dataSource.sourceId,
  status: "pending" as const,
  requestedAt: "2026-06-26T00:05:00.000Z",
  scannedItemCount: 0,
  changedItemCount: 0
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function success(data: unknown): Response {
  return jsonResponse({
    ok: true,
    data,
    meta: { requestId: "test", timestamp: "2026-06-26T00:00:00.000Z" }
  });
}

function paginatedSuccess(data: unknown[]): Response {
  return jsonResponse({
    ok: true,
    data,
    meta: {
      requestId: "test",
      timestamp: "2026-06-26T00:00:00.000Z",
      pagination
    }
  });
}

function apiFailure(code = "validation.invalid_input", status = 422): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message: "Invalid Knowledge Base / RAG request",
        details: { issues: ["files is required"] }
      },
      meta: { requestId: "test", timestamp: "2026-06-26T00:00:00.000Z" }
    },
    status
  );
}

describe("Knowledge Base / RAG API client", () => {
  it("lists, assigns, and revokes agent knowledge documents with encoded routes", async () => {
    const assignment = {
      workspaceId,
      agentId,
      document,
      grantStatus: "active" as const
    };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(success([assignment]))
      .mockResolvedValueOnce(success(assignment))
      .mockResolvedValueOnce(success({ ...assignment, grantStatus: "revoked" }));
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });

    expect(await client.listAgentKnowledgeDocuments(workspaceId, agentId)).toEqual([
      assignment
    ]);
    await client.assignAgentKnowledgeDocument(
      workspaceId,
      agentId,
      document.documentId
    );
    await client.revokeAgentKnowledgeDocument(
      workspaceId,
      agentId,
      document.documentId
    );

    expect(fetchImplementation.mock.calls.map(([path, init]) => [
      path,
      init.method
    ])).toEqual([
      [`${encodedWorkspacePath}/agents/agent%2Fa%20b/documents`, undefined],
      [
        `${encodedWorkspacePath}/agents/agent%2Fa%20b/documents/document-a`,
        "POST"
      ],
      [
        `${encodedWorkspacePath}/agents/agent%2Fa%20b/documents/document-a`,
        "DELETE"
      ]
    ]);
  });

  it("lists documents with encoded workspace and safe query parameters", async () => {
    const fetchImplementation = vi.fn(async () => paginatedSuccess([document]));
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });

    const result = await client.listDocuments(workspaceId, {
      search: "run book",
      sourceId: "source/a b",
      statuses: ["pending", "ready"],
      page: 2,
      pageSize: 10
    });

    expect(result.items[0].documentId).toBe("document-a");
    expect(result.pagination).toEqual(pagination);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${encodedWorkspacePath}/documents?search=run+book&sourceId=source%2Fa+b&status=pending&status=ready&page=2&pageSize=10`,
      expect.objectContaining({ headers: expect.objectContaining({ accept: "application/json" }) })
    );
  });

  it("validates upload candidates with metadata-only JSON payload", async () => {
    const validation = {
      results: [{ clientFileId: "file-a", fileName: "Runbook.pdf", status: "accepted" }],
      acceptedCount: 1,
      rejectedCount: 0
    };
    const fetchImplementation = vi.fn(async () => success(validation));
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });
    const request = {
      files: [
        {
          clientFileId: "file-a",
          fileName: "Runbook.pdf",
          mediaType: "application/pdf",
          sizeBytes: 1024
        }
      ]
    };

    const result = await client.validateUploadCandidates(workspaceId, request);

    expect(result.acceptedCount).toBe(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${encodedWorkspacePath}/uploads/validate`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
        headers: expect.objectContaining({
          accept: "application/json",
          "content-type": "application/json"
        })
      })
    );
  });

  it("prepares upload and lists ingestion jobs with pagination", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(success({ documents: [document], ingestionJobs: [ingestionJob] }))
      .mockResolvedValueOnce(paginatedSuccess([ingestionJob]));
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });

    const prepared = await client.prepareUpload(workspaceId, {
      files: [
        {
          clientFileId: "file-b",
          fileName: "Guide.txt",
          mediaType: "text/plain",
          sizeBytes: 2048
        }
      ]
    });
    const jobs = await client.listIngestionJobs(workspaceId, {
      documentId: "document-a" as EntityId<"documentId">,
      statuses: ["pending"],
      page: 2,
      pageSize: 10
    });

    expect(prepared.documents[0].name).toBe("Runbook.pdf");
    expect(jobs.items[0].jobId).toBe("ingestion-job-a");
    expect(fetchImplementation.mock.calls[0][0]).toBe(`${encodedWorkspacePath}/uploads/prepare`);
    expect(fetchImplementation.mock.calls[1][0]).toBe(
      `${encodedWorkspacePath}/ingestion-jobs?documentId=document-a&status=pending&page=2&pageSize=10`
    );
  });

  it("uploads selected files with multipart form data", async () => {
    const fetchImplementation = vi.fn(async () =>
      success({ documents: [document], ingestionJobs: [ingestionJob] })
    );
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });
    const file = new File(["content"], "Guide.txt", { type: "text/plain" });

    const uploaded = await client.uploadDocuments(workspaceId, [file]);

    expect(uploaded.documents[0].documentId).toBe("document-a");
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${encodedWorkspacePath}/uploads`,
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
        headers: expect.not.objectContaining({
          "content-type": "application/json"
        })
      })
    );
  });

  it("handles data source, sync scope, and sync job routes", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(success([dataSource]))
      .mockResolvedValueOnce(success(dataSource))
      .mockResolvedValueOnce(success([scopeNode]))
      .mockResolvedValueOnce(success([scopeNode]))
      .mockResolvedValueOnce(success(syncJob))
      .mockResolvedValueOnce(paginatedSuccess([syncJob]));
    const client = createKnowledgeBaseRagApiClient({
      fetchImplementation,
      baseUrl: "https://api.test/"
    });

    await client.listDataSources(workspaceId, { provider: "notion", statuses: ["connected"] });
    await client.connectDataSource(workspaceId, dataSource.sourceId, {
      displayName: "Company Notion",
      providerAccountLabel: "safe-label"
    });
    await client.getSyncScope(workspaceId, dataSource.sourceId);
    await client.updateSyncScope(workspaceId, { selectedScopeNodeIds: ["scope-node-a"] });
    await client.requestManualSync(workspaceId, {
      sourceId: dataSource.sourceId,
      scopeNodeIds: ["scope-node-a"]
    });
    await client.listSyncJobs(workspaceId, {
      sourceId: dataSource.sourceId,
      statuses: ["pending"],
      page: 2,
      pageSize: 10
    });

    expect(fetchImplementation.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"])).toEqual([
      [`https://api.test${encodedWorkspacePath}/data-sources?provider=notion&status=connected`, "GET"],
      [`https://api.test${encodedWorkspacePath}/data-sources/source%2Fa%20b/connect`, "POST"],
      [`https://api.test${encodedWorkspacePath}/sync-scope?sourceId=source%2Fa+b`, "GET"],
      [`https://api.test${encodedWorkspacePath}/sync-scope`, "PUT"],
      [`https://api.test${encodedWorkspacePath}/sync-jobs`, "POST"],
      [`https://api.test${encodedWorkspacePath}/sync-jobs?sourceId=source%2Fa+b&status=pending&page=2&pageSize=10`, "GET"]
    ]);
  });

  it("loads a Google Drive draft preview through the non-persistent route", async () => {
    const fetchImplementation = vi.fn(async () => success([scopeNode]));
    const client = createKnowledgeBaseRagApiClient({
      fetchImplementation,
      baseUrl: "https://api.test/"
    });

    const preview = await client.previewGoogleDriveScope(
      workspaceId,
      dataSource.sourceId,
      {
        folderIds: ["folder-a"],
        fileIds: [],
        recursive: true,
        maxFiles: 25
      }
    );

    expect(preview).toEqual([scopeNode]);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `https://api.test${encodedWorkspacePath}/data-sources/source%2Fa%20b/google-drive/preview`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rejects unsafe server-owned and private request fields before fetch", async () => {
    const fetchImplementation = vi.fn(async () => success({}));
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });

    await expect(
      client.validateUploadCandidates(workspaceId, {
        workspaceId: "workspace-b",
        files: [
          {
            clientFileId: "file-a",
            fileName: "Runbook.pdf",
            mediaType: "application/pdf",
            sizeBytes: 1024,
            storageKey: "private/key"
          }
        ]
      } as any)
    ).rejects.toMatchObject({
      kind: "invalid-request",
      code: "validation.invalid_input"
    });
    await expect(
      client.connectDataSource(workspaceId, dataSource.sourceId, {
        providerToken: "secret-token"
      } as any)
    ).rejects.toMatchObject({
      kind: "invalid-request",
      code: "validation.invalid_input"
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("maps API, malformed, and network errors consistently", async () => {
    const apiClient = createKnowledgeBaseRagApiClient({
      fetchImplementation: vi.fn(async () => apiFailure("knowledge.access_denied", 403))
    });
    const malformedClient = createKnowledgeBaseRagApiClient({
      fetchImplementation: vi.fn(async () =>
        jsonResponse({ ok: true, data: [document], meta: { requestId: "test", timestamp: "now" } })
      )
    });
    const networkClient = createKnowledgeBaseRagApiClient({
      fetchImplementation: vi.fn(async () => {
        throw new Error("offline");
      })
    });

    await expect(apiClient.listDocuments(workspaceId)).rejects.toMatchObject({
      kind: "api",
      code: "knowledge.access_denied",
      status: 403,
      details: { issues: ["files is required"] }
    });
    await expect(malformedClient.listDocuments(workspaceId)).rejects.toMatchObject({
      kind: "malformed-response",
      code: "system.unexpected_error"
    });
    await expect(networkClient.listDocuments(workspaceId)).rejects.toMatchObject({
      kind: "network",
      code: "system.unexpected_error"
    });
  });

  it("does not call the old /api/knowledge-base route family", async () => {
    const fetchImplementation = vi.fn(async () => paginatedSuccess([]));
    const client = createKnowledgeBaseRagApiClient({ fetchImplementation });

    await client.listDocuments("workspace-a" as EntityId<"workspaceId">);
    await client.listSyncJobs("workspace-a" as EntityId<"workspaceId">);

    for (const [url] of fetchImplementation.mock.calls) {
      expect(String(url)).not.toContain("/api/knowledge-base");
    }
  });

  it("exposes a typed client error class", () => {
    const error = new KnowledgeBaseRagApiClientError({
      message: "bad request",
      kind: "invalid-request"
    });

    expect(error.name).toBe("KnowledgeBaseRagApiClientError");
    expect(error.code).toBe("system.unexpected_error");
  });
});
