import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import express from "express";

import {
  KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import { createKnowledgeBaseRagRouter } from "@vcp/backend/modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import { KnowledgeDataSourceUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-data-source-use-cases.ts";
import { KnowledgeDocumentUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-document-use-cases.ts";
import { KnowledgeIngestionUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-ingestion-use-cases.ts";
import { KnowledgeSyncUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-sync-use-cases.ts";
import { KnowledgeUploadUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

const moduleRoot = "apps/backend/src/modules/knowledge-base-rag";
const apiFiles = collectFiles(join(moduleRoot, "api")).filter((file) =>
  file.endsWith(".ts")
);
const routerSource = readFileSync(
  join(moduleRoot, "api/knowledge-base-rag-router.ts"),
  "utf8"
);

for (const { method, path } of KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS) {
  assert.ok(
    routerSource.includes(path) || routerSource.includes("KNOWLEDGE_BASE_RAG_API_ROUTES"),
    `router should expose ${method} ${path}`
  );
  assert.ok(
    path.startsWith("/api/workspaces/:workspaceId/knowledge"),
    `${method} ${path} must remain workspace-scoped`
  );
}

assert.equal(
  routerSource.includes("/api/knowledge-base"),
  false,
  "router must not expose the old /api/knowledge-base route family"
);

for (const file of apiFiles) {
  const source = readFileSync(file, "utf8");
  for (const forbidden of [
    "@vcp/database",
    "PrismaClient",
    "modules/agent-management",
    "modules/workflow-management",
    "modules/task-orchestration",
    "modules/authentication",
    "apps/frontend",
    "apps/workers",
    "objectStorage",
    "storageAdapter",
    "embeddingProvider",
    "vectorDatabase"
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${file} must not import or call ${forbidden}`
    );
  }
}

const runtime = createKnowledgeBaseRagRuntime();

await runtime.dataSourceRepository.saveDataSource({
  sourceId: "source-a",
  workspaceId: "workspace-a",
  provider: "notion",
  displayName: "Company Notion",
  connectionStatus: "not_connected",
  selectedScopeNodeCount: 0,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z"
});
await runtime.dataSourceRepository.saveDataSource({
  sourceId: "source-google-drive-empty",
  workspaceId: "workspace-a",
  provider: "google_drive",
  displayName: "Google Drive",
  connectionStatus: "connected",
  selectedScopeNodeCount: 0,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z"
});
await runtime.syncScopeRepository.saveSyncScopeNodes("workspace-a", [
  {
    scopeNodeId: "scope-node-a",
    workspaceId: "workspace-a",
    sourceId: "source-a",
    externalId: "external-page-a",
    nodeType: "page",
    displayName: "Runbooks",
    selected: false,
    selectable: true,
    createdAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z"
  }
]);

await withKnowledgeBaseRagApi(runtime.useCases, async (baseUrl) => {
  const emptyDocuments = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/documents"
  );
  assert.equal(emptyDocuments.status, 200);
  assert.equal(emptyDocuments.body.ok, true);
  assert.deepEqual(emptyDocuments.body.data, []);
  assert.equal(emptyDocuments.body.meta.pagination.totalItems, 0);

  const validation = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads/validate",
    {
      method: "POST",
      body: {
        files: [
          {
            clientFileId: "candidate-1",
            fileName: "Runbook.pdf",
            mediaType: "application/pdf",
            sizeBytes: 1024
          },
          {
            clientFileId: "candidate-2",
            fileName: "unsafe.exe",
            mediaType: "application/x-msdownload",
            sizeBytes: 1024
          }
        ]
      }
    }
  );
  assert.equal(validation.status, 200);
  assert.equal(validation.body.data.acceptedCount, 1);
  assert.equal(validation.body.data.rejectedCount, 1);
  assert.equal(
    (await runtime.documentRepository.listDocuments("workspace-a")).total,
    0,
    "upload validation route must not create document records"
  );

  const invalidTrustedField = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads/validate",
    {
      method: "POST",
      body: {
        workspaceId: "workspace-b",
        files: []
      }
    }
  );
  assert.equal(invalidTrustedField.status, 422);
  assert.equal(invalidTrustedField.body.error.code, "validation.invalid_input");

  const prepared = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads/prepare",
    {
      method: "POST",
      body: {
        files: [
          {
            clientFileId: "candidate-3",
            fileName: "Handbook.txt",
            mediaType: "text/plain",
            sizeBytes: 2048
          }
        ]
      }
    }
  );
  assert.equal(prepared.status, 200);
  assert.equal(prepared.body.data.documents.length, 1);
  assert.equal(prepared.body.data.ingestionJobs.length, 1);
  assert.equal(prepared.body.data.documents[0].workspaceId, "workspace-a");
  assertNoForbiddenPublicKeys(prepared.body);

  for (const uploadCase of [
    { fileName: "Runtime.pdf", mediaType: "application/pdf", content: "%PDF" },
    {
      fileName: "Runtime.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: "PK\u0003\u0004"
    },
    { fileName: "Runtime.txt", mediaType: "text/plain", content: "runtime text" },
    {
      fileName: "Runtime.csv",
      mediaType: "application/csv",
      content: "name,status\nLaptop,approved",
      expectedMediaType: "text/csv"
    },
    {
      fileName: "Runtime.markdown",
      mediaType: "application/octet-stream",
      content: "# Runtime handbook",
      expectedMediaType: "text/markdown"
    }
  ]) {
    const uploaded = await requestMultipart(
      baseUrl,
      "/api/workspaces/workspace-a/knowledge/uploads",
      uploadCase
    );
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.body.data.documents.length, 1);
    assert.equal(uploaded.body.data.documents[0].workspaceId, "workspace-a");
    assert.equal(uploaded.body.data.documents[0].name, uploadCase.fileName);
    assert.equal(
      uploaded.body.data.documents[0].mediaType,
      uploadCase.expectedMediaType ?? uploadCase.mediaType
    );
    assertNoForbiddenPublicKeys(uploaded.body);
  }

  const unsupportedUpload = await requestMultipart(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads",
    {
      fileName: "Runtime.exe",
      mediaType: "application/x-msdownload",
      content: "bad"
    }
  );
  assert.equal(unsupportedUpload.status, 422);
  assert.equal(unsupportedUpload.body.error.code, "validation.invalid_input");

  const oversizedUpload = await requestMultipart(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads",
    {
      fileName: "TooLarge.txt",
      mediaType: "text/plain",
      content: "x".repeat(25 * 1024 * 1024 + 1)
    }
  );
  assert.equal(oversizedUpload.status, 422);
  assert.equal(oversizedUpload.body.error.code, "validation.invalid_input");

  const missingFileUpload = await requestMultipart(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads",
    null
  );
  assert.equal(missingFileUpload.status, 422);
  assert.equal(missingFileUpload.body.error.code, "validation.invalid_input");

  const documents = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/documents"
  );
  assert.equal(documents.status, 200);
  assert.ok(
    documents.body.data.some((document) => document.name === "Handbook.txt"),
    "metadata prepare document remains listed"
  );
  assert.ok(
    documents.body.data.some((document) => document.name === "Runtime.pdf"),
    "real uploaded document is listed"
  );
  assert.equal(documents.body.meta.pagination.totalItems, 6);

  const ingestionJobs = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/ingestion-jobs"
  );
  assert.equal(ingestionJobs.status, 200);
  assert.equal(ingestionJobs.body.data.length, 6);
  assert.ok(
    ingestionJobs.body.data.every((job) => job.status === "pending"),
    "prepared and uploaded documents queue pending ingestion metadata"
  );

  const dataSources = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/data-sources"
  );
  assert.equal(dataSources.status, 200);
  assert.equal(dataSources.body.data[0].sourceId, "source-a");

  const connectedSource = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/data-sources/source-a/connect",
    {
      method: "POST",
      body: {
        displayName: "Connected Notion",
        providerAccountLabel: "safe-label"
      }
    }
  );
  assert.equal(connectedSource.status, 200);
  assert.equal(connectedSource.body.data.status, "connected");
  assert.equal(connectedSource.body.data.displayName, "Connected Notion");
  assertNoForbiddenPublicKeys(connectedSource.body);

  const unsafeConnect = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/data-sources/source-a/connect",
    {
      method: "POST",
      body: {
        providerToken: "must-not-be-accepted"
      }
    }
  );
  assert.equal(unsafeConnect.status, 422);
  assert.equal(unsafeConnect.body.error.code, "validation.invalid_input");

  const syncScope = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/sync-scope?sourceId=source-a"
  );
  assert.equal(syncScope.status, 200);
  assert.equal(syncScope.body.data.length, 1);
  assert.equal(syncScope.body.data[0].scopeNodeId, "scope-node-a");

  const updatedScope = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/sync-scope",
    {
      method: "PUT",
      body: {
        selectedScopeNodeIds: ["scope-node-a"]
      }
    }
  );
  assert.equal(updatedScope.status, 200);
  assert.equal(updatedScope.body.data[0].selected, true);

  const syncJob = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/sync-jobs",
    {
      method: "POST",
      body: {
        sourceId: "source-a",
        scopeNodeIds: ["scope-node-a"]
      }
    }
  );
  assert.equal(syncJob.status, 200);
  assert.equal(syncJob.body.data.status, "pending");
  assertNoForbiddenPublicKeys(syncJob.body);

  const noScopeSync = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/sync-jobs",
    {
      method: "POST",
      body: { sourceId: "source-google-drive-empty" }
    }
  );
  assert.equal(noScopeSync.status, 422);
  assert.equal(noScopeSync.body.error.code, "validation.invalid_input");
  assert.equal(
    noScopeSync.body.error.message,
    "No Google Drive sync scope is configured. Add a file ID or folder ID before syncing."
  );
  assertNoForbiddenPublicKeys(noScopeSync.body);

  const drivePreview = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/data-sources/source-google-drive-empty/google-drive/preview",
    {
      method: "POST",
      body: {
        fileIds: ["1DRIVEFILE123"],
        recursive: false,
        maxFiles: 25
      }
    }
  );
  assert.equal(drivePreview.status, 200);
  assert.equal(drivePreview.body.data[0].name, "Equipment Policy.txt");
  assert.equal(
    (
      await runtime.syncScopeRepository.getSyncScope(
        "workspace-a",
        "source-google-drive-empty"
      )
    ).length,
    0,
    "preview route must not persist scope"
  );
  assertNoForbiddenPublicKeys(drivePreview.body);

  const configuredDriveScope = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/data-sources/source-google-drive-empty/google-drive/scope",
    {
      method: "PUT",
      body: {
        fileIds: [
          "https://docs.google.com/document/d/1DRIVEFILE123/edit?tab=t.0"
        ],
        recursive: false,
        maxFiles: 25
      }
    }
  );
  assert.equal(configuredDriveScope.status, 200);
  assert.equal(configuredDriveScope.body.data[0].externalId, "1DRIVEFILE123");

  const autoSyncSettings = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/data-sources/source-google-drive-empty/google-drive/auto-sync",
    {
      method: "PUT",
      body: { autoSyncEnabled: true, autoSyncFrequency: "hourly" }
    }
  );
  assert.equal(autoSyncSettings.status, 200);
  assert.equal(autoSyncSettings.body.data.autoSyncEnabled, true);
  assert.equal(autoSyncSettings.body.data.autoSyncFrequency, "hourly");
  assertNoForbiddenPublicKeys(autoSyncSettings.body);

  const syncJobs = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/sync-jobs"
  );
  assert.equal(syncJobs.status, 200);
  assert.equal(syncJobs.body.data.length, 1);
  assert.equal(syncJobs.body.meta.pagination.totalItems, 1);

  const agentAnswer = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/agents/agent-a/ask",
    {
      method: "POST",
      body: {
        message: "What is the equipment approval policy?",
        topK: 3
      }
    }
  );
  assert.equal(agentAnswer.status, 200);
  assert.equal(agentAnswer.body.data.status, "answered");
  assert.equal(agentAnswer.body.data.citations[0].documentId, "document-policy");
  assertNoForbiddenPublicKeys(agentAnswer.body);

  const invalidAgentAsk = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/agents/agent-a/ask",
    {
      method: "POST",
      body: { message: "   " }
    }
  );
  assert.equal(invalidAgentAsk.status, 200);
  assert.equal(invalidAgentAsk.body.data.status, "invalid_request");

  const viewerMutation = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/uploads/validate",
    {
      method: "POST",
      headers: { "x-test-role": "viewer" },
      body: { files: [] }
    }
  );
  assert.equal(viewerMutation.status, 403);
  assert.equal(viewerMutation.body.error.code, "auth.forbidden");

  const unauthenticated = await requestJson(
    baseUrl,
    "/api/workspaces/workspace-a/knowledge/documents",
    {
      headers: { "x-test-auth": "false" }
    }
  );
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.error.code, "auth.unauthorized");

  const callbackPath =
    "/api/workspaces/workspace-a/knowledge/data-sources/google-drive/oauth/callback?code=browser-code&state=safe-state";
  const browserCallback = await fetch(`${baseUrl}${callbackPath}`, {
    headers: { accept: "text/html", "x-request-id": "test-request" },
    redirect: "manual"
  });
  assert.equal(browserCallback.status, 303);
  const redirectLocation = browserCallback.headers.get("location");
  assert.equal(
    redirectLocation,
    "http://127.0.0.1:5173/knowledge-base-rag?tab=data-sync&googleDrive=connected"
  );
  assert.equal(/browser-code|safe-state|token|secret/i.test(redirectLocation), false);

  const jsonCallback = await requestJson(baseUrl, callbackPath, {
    headers: { accept: "application/json" }
  });
  assert.equal(jsonCallback.status, 200);
  assert.equal(jsonCallback.body.data.connected, true);
  assertNoForbiddenPublicKeys(jsonCallback.body);

  const oldRoute = await fetch(`${baseUrl}/api/knowledge-base/documents`);
  assert.equal(oldRoute.status, 404);
});

function createKnowledgeBaseRagRuntime() {
  let documentSequence = 0;
  let ingestionJobSequence = 0;
  let syncJobSequence = 0;
  const now = () => "2026-06-26T00:00:00.000Z";
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const dataSourceRepository = new InMemoryKnowledgeDataSourceRepository();
  const syncScopeRepository = new InMemoryKnowledgeSyncScopeRepository();
  const syncJobRepository = new InMemoryKnowledgeSyncJobRepository();

  return {
    documentRepository,
    ingestionJobRepository,
    dataSourceRepository,
    syncScopeRepository,
    syncJobRepository,
    useCases: {
      documentUseCases: new KnowledgeDocumentUseCases({ documentRepository }),
      uploadUseCases: new KnowledgeUploadUseCases({
        documentRepository,
        ingestionJobRepository,
        fileStorage: {
          async store(input) {
            return {
              storageKey: `private/${input.workspaceId}/${input.documentId}/${input.fileName}`,
              contentHash: `sha256-${input.documentId}`,
              sizeBytes: input.content.byteLength
            };
          },
          async remove() {
            throw new Error("remove should not run in API happy path")
          }
        },
        now,
        generateDocumentId: () => `document-${++documentSequence}`,
        generateJobId: () => `ingestion-job-${++ingestionJobSequence}`
      }),
      ingestionUseCases: new KnowledgeIngestionUseCases({ ingestionJobRepository }),
      dataSourceUseCases: new KnowledgeDataSourceUseCases({
        dataSourceRepository,
        now
      }),
      syncUseCases: new KnowledgeSyncUseCases({
        syncScopeRepository,
        syncJobRepository,
        dataSourceRepository,
        googleDriveOAuthService: {
          async getAccessToken() {
            return "safe-test-access-value";
          }
        },
        googleDriveProvider: {
          async listScopeTree() {
            return [
              {
                file: {
                  fileId: "1DRIVEFILE123",
                  name: "Equipment Policy.txt",
                  mimeType: "text/plain",
                  modifiedTime: now(),
                  trashed: false,
                  canDownload: true
                },
                children: [],
                hasMoreChildren: false
              }
            ];
          }
        },
        now,
        generateJobId: () => `sync-job-${++syncJobSequence}`
      }),
      agentKnowledgeOrchestrationUseCase: {
        async ask(workspaceId, agentId, request) {
          if (!request.message.trim()) {
            return {
              status: "invalid_request",
              answer: "",
              citations: [],
              warnings: ["Agent knowledge retrieval input is invalid."]
            };
          }
          return {
            status: "answered",
            answer: "Equipment requests are reviewed within three business days.",
            citations: [
              {
                citationId: "E1",
                documentId: "document-policy",
                documentTitle: "sample-company-policy.txt",
                snippet:
                  "Equipment requests are reviewed within three business days.",
                sourceType: "upload",
                sourceLocator: "text:0"
              }
            ],
            warnings: []
          };
        }
      },
      frontendBaseUrl: "http://127.0.0.1:5173",
      googleDriveOAuthService: {
        async callback() {
          return {
            connected: true,
            source: {
              sourceId: "source-google-drive",
              workspaceId: "workspace-a",
              provider: "google_drive",
              displayName: "Google Drive",
              status: "connected",
              selectedScopeNodeCount: 0,
              updatedAt: now()
            }
          };
        }
      }
    }
  };
}

async function withKnowledgeBaseRagApi(useCases, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.headers["x-test-role"] || "admin";
    const authenticated = req.headers["x-test-auth"] !== "false";
    const match = req.path.match(/^\/api\/workspaces\/([^\/]+)/);
    const workspaceId = match ? match[1] : "workspace-a";

    if (!authenticated) {
      req.context = { requestId: req.headers["x-request-id"] || "test-request" };
    } else {
      req.context = {
        requestId: req.headers["x-request-id"] || "test-request",
        user: {
          userId: "test-user",
          email: "test@example.com"
        },
        workspace: {
          workspaceId,
          memberId: "test-member",
          role
        }
      };
    }
    next();
  });
  app.use(createKnowledgeBaseRagRouter(useCases));

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-request-id": "test-request",
      ...(options.headers ?? {})
    },
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function requestMultipart(baseUrl, path, file) {
  const boundary = `----kb-rag-test-${Date.now()}`;
  const body = file
    ? [
        `--${boundary}`,
        `Content-Disposition: form-data; name="files"; filename="${file.fileName}"`,
        `Content-Type: ${file.mediaType}`,
        "",
        file.content,
        `--${boundary}--`,
        ""
      ].join("\r\n")
    : [`--${boundary}`, `--${boundary}--`, ""].join("\r\n");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "x-request-id": "test-request"
    },
    body
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

function assertNoForbiddenPublicKeys(value, path = "") {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPublicKeys(item, `${path}[${index}]`));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const keyPath = path ? `${path}.${key}` : key;
    for (const forbidden of [
      "credential",
      "secret",
      "token",
      "password",
      "refreshToken",
      "rawEmbedding",
      "embeddingVector",
      "vectorConfig",
      "privateUrl",
      "queuePayload",
      "storageKey",
      "contentHash",
      "vectorRef",
      "safeMetadata"
    ]) {
      assert.equal(
        key.toLowerCase().includes(forbidden.toLowerCase()),
        false,
        `${keyPath} must not expose private infrastructure fields`
      );
    }
    assertNoForbiddenPublicKeys(child, keyPath);
  }
}

function collectFiles(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? collectFiles(path) : [path];
    });
}
