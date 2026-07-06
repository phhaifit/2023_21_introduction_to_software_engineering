import assert from "node:assert/strict";

import { GoogleDriveSyncRuntime } from "@vcp/backend/modules/knowledge-base-rag/application/google-drive-sync-runtime.ts";
import { KnowledgeSyncUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-sync-use-cases.ts";
import { createGoogleDriveSyncJobHandler } from "@vcp/workers/jobs/document-ingestion/google-drive-sync-job.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

const now = "2026-07-05T00:00:00.000Z";
const dataSourceRepository = new InMemoryKnowledgeDataSourceRepository();
const documentRepository = new InMemoryKnowledgeDocumentRepository();
const syncScopeRepository = new InMemoryKnowledgeSyncScopeRepository();
const syncJobRepository = new InMemoryKnowledgeSyncJobRepository();
await dataSourceRepository.saveDataSource({
  sourceId: "source-drive",
  workspaceId: "workspace-a",
  provider: "google_drive",
  displayName: "Google Drive",
  connectionStatus: "connected",
  selectedScopeNodeCount: 1,
  createdAt: now,
  updatedAt: now
});
await syncScopeRepository.saveSyncScopeNodes("workspace-a", [
  {
    scopeNodeId: "scope-folder",
    workspaceId: "workspace-a",
    sourceId: "source-drive",
    externalId: "folder-1",
    nodeType: "folder",
    displayName: "Folder folder-1",
    selected: true,
    selectable: true,
    safeMetadata: { recursive: true, maxFiles: 10, allowedMimeTypes: [] },
    createdAt: now,
    updatedAt: now
  }
]);
await documentRepository.saveDocument({
  documentId: "document-unchanged",
  workspaceId: "workspace-a",
  uploadedByUserId: "user-a",
  displayName: "unchanged.txt",
  fileName: "unchanged.txt",
  mimeType: "text/plain",
  fileType: "txt",
  sizeBytes: 10,
  sourceType: "google_drive",
  sourceId: "source-drive",
  externalId: "file-unchanged",
  sourceModifiedAt: now,
  status: "ready",
  ingestionStatus: "ready",
  indexingStatus: "ready",
  chunkCount: 1,
  indexedChunkCount: 1,
  createdAt: now,
  updatedAt: now
});
for (const [documentId, externalId] of [
  ["document-changed", "file-changed"],
  ["document-trashed", "file-trashed"]
]) {
  await documentRepository.saveDocument({
    documentId,
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
    displayName: `${externalId}.txt`,
    fileName: `${externalId}.txt`,
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: 10,
    sourceType: "google_drive",
    sourceId: "source-drive",
    externalId,
    sourceModifiedAt: "2026-07-04T00:00:00.000Z",
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: now,
    updatedAt: now
  });
}
await syncJobRepository.saveSyncJob({
  jobId: "sync-job",
  workspaceId: "workspace-a",
  sourceId: "source-drive",
  status: "pending",
  requestedByUserId: "user-a",
  queuedAt: now,
  createdAt: now,
  updatedAt: now
});

const imported = [];
const runtime = new GoogleDriveSyncRuntime({
  dataSourceRepository,
  documentRepository,
  syncScopeRepository,
  syncJobRepository,
  oauthService: { getAccessToken: async () => "access-value" },
  provider: {
    listFiles: async () => [
      driveFile("file-new", "new.txt", "text/plain", now),
      driveFile("file-changed", "changed.txt", "text/plain", now),
      driveFile("file-unchanged", "unchanged.txt", "text/plain", now),
      { ...driveFile("file-trashed", "trashed.txt", "text/plain", now), trashed: true },
      driveFile("file-slides", "slides", "application/vnd.google-apps.presentation", now)
    ],
    downloadFile: async (_token, file) => ({
      fileName: file.name,
      mediaType: file.mimeType,
      content: Buffer.from("Imported Google Drive policy")
    })
  },
  uploadUseCases: {
    importExternalFile: async (_workspaceId, _actorId, file) => {
      imported.push(file.externalId);
      return {
        document: {
          documentId: "document-new",
          workspaceId: "workspace-a",
          uploadedByUserId: "user-a",
          displayName: file.fileName,
          fileName: file.fileName,
          mimeType: file.mediaType,
          fileType: "txt",
          sizeBytes: file.content.byteLength,
          sourceType: "google_drive",
          sourceId: file.sourceId,
          externalId: file.externalId,
          sourceModifiedAt: file.sourceModifiedAt,
          status: "ready",
          ingestionStatus: "ready",
          indexingStatus: "ready",
          chunkCount: 2,
          indexedChunkCount: 2,
          createdAt: now,
          updatedAt: now
        },
        job: {}
      };
    }
  },
  now: () => now,
  generateEventId: () => `event-${Math.random()}`
});

await runtime.execute({ workspaceId: "workspace-a", jobId: "sync-job" });
assert.deepEqual(imported, ["file-new", "file-changed"]);
const completed = await syncJobRepository.getSyncJobById("workspace-a", "sync-job");
assert.equal(completed.status, "completed");
assert.equal(completed.totalItems, 5);
assert.equal(completed.syncedItems, 2);
assert.deepEqual(completed.safeSummary, {
  syncMode: "manual",
  importedItemCount: 1,
  updatedItemCount: 1,
  skippedUnchangedItemCount: 1,
  skippedUnsupportedItemCount: 1,
  removedItemCount: 1,
  failedItemCount: 0,
  totalChunksCreated: 4,
  totalVectorsIndexed: 4
});
assert.equal(
  (await documentRepository.getDocumentById("workspace-a", "document-trashed"))
    .status,
  "failed"
);
const events = await syncJobRepository.listSyncJobEvents("workspace-a", "sync-job");
assert.deepEqual(events.map((event) => event.status), ["syncing", "completed"]);
assert.equal(JSON.stringify(completed).includes("access-value"), false);

await dataSourceRepository.saveDataSource({
  sourceId: "source-drive-empty",
  workspaceId: "workspace-a",
  provider: "google_drive",
  displayName: "Empty Drive",
  connectionStatus: "connected",
  selectedScopeNodeCount: 0,
  createdAt: now,
  updatedAt: now
});
const syncUseCases = new KnowledgeSyncUseCases({
  dataSourceRepository,
  syncScopeRepository,
  syncJobRepository,
  now: () => now,
  generateJobId: () => "sync-job-empty"
});
await assert.rejects(
  () =>
    syncUseCases.requestManualSync("workspace-a", "user-a", {
      sourceId: "source-drive-empty"
    }),
  /No Google Drive sync scope is configured\. Add a file ID or folder ID before syncing\./
);

const treeUseCases = new KnowledgeSyncUseCases({
  dataSourceRepository,
  syncScopeRepository,
  syncJobRepository,
  googleDriveOAuthService: { getAccessToken: async () => "tree-access-value" },
  googleDriveProvider: {
    listScopeTree: async () => [
      {
        file: driveFile(
          "folder-1",
          "HR Policies",
          "application/vnd.google-apps.folder",
          now
        ),
        hasMoreChildren: false,
        children: [
          {
            file: driveFile(
              "file-equipment",
              "Equipment Policy.txt",
              "text/plain",
              now
            ),
            hasMoreChildren: false,
            children: []
          },
          {
            file: driveFile(
              "file-slides-preview",
              "Company Slides",
              "application/vnd.google-apps.presentation",
              now
            ),
            hasMoreChildren: false,
            children: []
          }
        ]
      }
    ]
  },
  now: () => now,
  generateJobId: () => "scope-tree-job"
});
const materialized = await treeUseCases.configureGoogleDriveScope(
  "workspace-a",
  "source-drive",
  {
    folderIds: ["folder-1"],
    recursive: true,
    maxFiles: 10,
    allowedMimeTypes: []
  }
);
const root = materialized.find((node) => node.name === "HR Policies");
const equipment = materialized.find(
  (node) => node.name === "Equipment Policy.txt"
);
const unsupported = materialized.find((node) => node.name === "Company Slides");
assert.ok(root);
assert.ok(equipment);
assert.equal(equipment.parentScopeNodeId, root.scopeNodeId);
assert.equal(unsupported.selectable, false);
assert.match(unsupported.unsupportedReason, /not supported/);

const selected = await treeUseCases.updateSyncScope("workspace-a", {
  selectedScopeNodeIds: [equipment.scopeNodeId]
});
assert.deepEqual(
  selected.filter((node) => node.selected).map((node) => node.name),
  ["Equipment Policy.txt"]
);
assert.equal(
  (await dataSourceRepository.getDataSourceById("workspace-a", "source-drive"))
    .selectedScopeNodeCount,
  1
);

await syncJobRepository.saveSyncJob({
  jobId: "selection-sync-job",
  workspaceId: "workspace-a",
  sourceId: "source-drive",
  status: "pending",
  requestedByUserId: "user-a",
  queuedAt: now,
  createdAt: now,
  updatedAt: now
});
let selectedProviderScope;
const selectionRuntime = new GoogleDriveSyncRuntime({
  dataSourceRepository,
  documentRepository,
  syncScopeRepository,
  syncJobRepository,
  oauthService: { getAccessToken: async () => "selection-access-value" },
  provider: {
    listFiles: async (_token, scope) => {
      selectedProviderScope = scope;
      return [];
    },
    downloadFile: async () => {
      throw new Error("download should not run");
    }
  },
  uploadUseCases: {
    importExternalFile: async () => {
      throw new Error("import should not run");
    }
  },
  now: () => now,
  generateEventId: () => `selection-event-${Math.random()}`
});
await selectionRuntime.execute({
  workspaceId: "workspace-a",
  jobId: "selection-sync-job"
});
assert.deepEqual(selectedProviderScope.folderIds, []);
assert.deepEqual(selectedProviderScope.fileIds, ["file-equipment"]);
assert.equal(JSON.stringify(selectedProviderScope).includes("selection-access-value"), false);

const workerCalls = [];
const workerHandler = createGoogleDriveSyncJobHandler({
  execute: async (input) => workerCalls.push(input)
});
await workerHandler({
  jobId: "queue-job",
  name: "knowledge.google_drive_sync",
  queuedAt: now,
  attempts: 0,
  payload: { workspaceId: "workspace-a", jobId: "sync-job" }
});
assert.deepEqual(workerCalls, [
  { workspaceId: "workspace-a", jobId: "sync-job" }
]);
await assert.rejects(
  () =>
    workerHandler({
      jobId: "queue-job",
      name: "knowledge.google_drive_sync",
      queuedAt: now,
      attempts: 0,
      payload: { workspaceId: "workspace-a" }
    }),
  /requires jobId/
);

console.log("knowledge-base-rag Google Drive sync checks passed");

function driveFile(fileId, name, mimeType, modifiedTime) {
  return {
    fileId,
    name,
    mimeType,
    modifiedTime,
    trashed: false,
    canDownload: true,
    parentIds: ["folder-1"]
  };
}
