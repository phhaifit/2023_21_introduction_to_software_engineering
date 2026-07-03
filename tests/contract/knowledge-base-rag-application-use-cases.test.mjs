import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDataSourceConnectedEvent,
  createIngestionQueuedEvent,
  createSyncRequestedEvent,
  createSyncScopeUpdatedEvent,
  createUploadValidatedEvent
} from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-events.ts";
import { KnowledgeBaseRagValidationError } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-errors.ts";
import { KnowledgeDataSourceUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-data-source-use-cases.ts";
import { KnowledgeDocumentUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-document-use-cases.ts";
import { KnowledgeIngestionUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-ingestion-use-cases.ts";
import {
  KnowledgeUploadUseCases,
  MAX_UPLOAD_CANDIDATE_SIZE_BYTES
} from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import { KnowledgeSyncUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-sync-use-cases.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { LocalKnowledgeFileStorage } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";

const moduleRoot = "apps/backend/src/modules/knowledge-base-rag";
const applicationFiles = collectFiles(join(moduleRoot, "application")).filter((file) =>
  file.endsWith(".ts")
);
const forbiddenApplicationFragments = [
  "@vcp/database",
  "@prisma",
  "PrismaClient",
  "modules/agent-management",
  "modules/workflow-management",
  "modules/task-orchestration",
  "modules/authentication",
  "modules/subscription-payment",
  "modules/workspace-management",
  "modules/workspace-user-management",
  "modules/tools-integration"
];
const forbiddenPublicFragments = [
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
  "vectorRef"
];

for (const file of applicationFiles) {
  const source = readFileSync(file, "utf8");
  for (const fragment of forbiddenApplicationFragments) {
    assert.equal(
      source.includes(fragment),
      false,
      `${file} must not import private modules or Prisma`
    );
  }
}

for (const file of applicationFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(
    source.includes("/api/") || source.includes("Router("),
    false,
    `${file} must remain independent from the HTTP API router`
  );
}

for (const expectedFile of [
  "knowledge-document-use-cases.ts",
  "knowledge-upload-use-cases.ts",
  "knowledge-ingestion-use-cases.ts",
  "knowledge-data-source-use-cases.ts",
  "knowledge-sync-use-cases.ts",
  "knowledge-retrieval-search-use-case.ts",
  "knowledge-base-rag-events.ts",
  "knowledge-base-rag-errors.ts"
]) {
  assert.ok(
    applicationFiles.some((file) => file.endsWith(expectedFile)),
    `${expectedFile} should exist`
  );
}

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";
const actorId = "user-a";
const now = () => "2026-06-26T00:00:00.000Z";
let documentSequence = 0;
let uploadJobSequence = 0;
let syncJobSequence = 0;

const documentRepository = new InMemoryKnowledgeDocumentRepository();
const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
const dataSourceRepository = new InMemoryKnowledgeDataSourceRepository();
const syncScopeRepository = new InMemoryKnowledgeSyncScopeRepository();
const syncJobRepository = new InMemoryKnowledgeSyncJobRepository();

const documentUseCases = new KnowledgeDocumentUseCases({ documentRepository });
const removedStorageKeys = [];
const uploadUseCases = new KnowledgeUploadUseCases({
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
    async remove(storageKey) {
      removedStorageKeys.push(storageKey);
    }
  },
  now,
  generateDocumentId: () => `document-${++documentSequence}`,
  generateJobId: () => `ingestion-job-${++uploadJobSequence}`
});
const ingestionUseCases = new KnowledgeIngestionUseCases({ ingestionJobRepository });
const dataSourceUseCases = new KnowledgeDataSourceUseCases({
  dataSourceRepository,
  now
});
const syncUseCases = new KnowledgeSyncUseCases({
  syncScopeRepository,
  syncJobRepository,
  now,
  generateJobId: () => `sync-job-${++syncJobSequence}`
});

await assert.rejects(
  () => uploadUseCases.validateUploadCandidates(workspaceA, { files: [] }),
  KnowledgeBaseRagValidationError,
  "empty upload candidate list should be rejected"
);

const validation = await uploadUseCases.validateUploadCandidates(workspaceA, {
  files: [
    {
      clientFileId: "file-1",
      fileName: "Handbook.pdf",
      mediaType: "application/pdf",
      sizeBytes: 1024
    },
    {
      clientFileId: "file-2",
      fileName: "script.exe",
      mediaType: "application/x-msdownload",
      sizeBytes: 1024
    },
    {
      clientFileId: "file-3",
      fileName: "large.txt",
      mediaType: "text/plain",
      sizeBytes: MAX_UPLOAD_CANDIDATE_SIZE_BYTES + 1
    },
    {
      clientFileId: "file-4",
      fileName: " ",
      mediaType: "text/plain",
      sizeBytes: 12
    }
  ]
});

assert.equal(validation.acceptedCount, 1);
assert.equal(validation.rejectedCount, 3);
assert.deepEqual(
  validation.results.map((result) => result.reasonCode ?? "accepted"),
  ["accepted", "unsupported_media_type", "file_too_large", "missing_file_name"]
);
assert.equal(
  (await documentRepository.listDocuments(workspaceA)).total,
  0,
  "validation must not create document records"
);
assert.equal(
  (await ingestionJobRepository.listIngestionJobs(workspaceA)).total,
  0,
  "validation must not create ingestion jobs"
);

const prepared = await uploadUseCases.prepareUpload(workspaceA, actorId, {
  files: [
    {
      clientFileId: "file-5",
      fileName: "Runbook.txt",
      mediaType: "text/plain",
      sizeBytes: 2048
    }
  ]
});

assert.equal(prepared.documents.length, 1);
assert.equal(prepared.ingestionJobs.length, 1);
assert.equal(prepared.documents[0].workspaceId, workspaceA);
assert.equal(prepared.documents[0].status, "pending");
assert.equal(prepared.ingestionJobs[0].status, "pending");
assert.equal(prepared.ingestionJobs[0].progressPercent, 0);
assertSafePublicShape(prepared);

const savedDocument = await documentRepository.getDocumentById(
  workspaceA,
  prepared.documents[0].documentId
);
assert.ok(savedDocument, "prepare upload should create document metadata");
assert.equal(savedDocument.storageKey, undefined, "prepare upload does not create storage keys");
assert.equal(savedDocument.contentHash, undefined, "prepare upload does not invent content hashes");

const uploaded = await uploadUseCases.uploadDocuments(workspaceA, actorId, [
  {
    clientFileId: "real-file-1",
    fileName: "Policy.pdf",
    mediaType: "application/pdf",
    content: new Uint8Array([37, 80, 68, 70])
  },
  {
    clientFileId: "real-file-2",
    fileName: "Guide.docx",
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    content: new Uint8Array([80, 75, 3, 4])
  },
  {
    clientFileId: "real-file-3",
    fileName: "Notes.txt",
    mediaType: "text/plain",
    content: new TextEncoder().encode("plain text")
  }
]);

assert.equal(uploaded.documents.length, 3);
assert.deepEqual(
  uploaded.documents.map((document) => document.name),
  ["Policy.pdf", "Guide.docx", "Notes.txt"]
);
assert.equal(uploaded.documents[0].workspaceId, workspaceA);
assertSafePublicShape(uploaded);
const uploadedSavedDocument = await documentRepository.getDocumentById(
  workspaceA,
  uploaded.documents[0].documentId
);
assert.ok(uploadedSavedDocument.storageKey, "real upload persists internal storage key");
assert.ok(uploadedSavedDocument.contentHash, "real upload persists internal content hash");

await assert.rejects(
  () =>
    uploadUseCases.uploadDocuments(workspaceA, actorId, [
      {
        clientFileId: "bad-file",
        fileName: "malware.exe",
        mediaType: "application/x-msdownload",
        content: new Uint8Array([1])
      }
    ]),
  KnowledgeBaseRagValidationError,
  "real upload rejects unsupported files"
);
await assert.rejects(
  () =>
    uploadUseCases.uploadDocuments(workspaceA, actorId, [
      {
        clientFileId: "huge-file",
        fileName: "huge.txt",
        mediaType: "text/plain",
        content: new Uint8Array(MAX_UPLOAD_CANDIDATE_SIZE_BYTES + 1)
      }
    ]),
  KnowledgeBaseRagValidationError,
  "real upload rejects oversized files"
);
await assert.rejects(
  () => uploadUseCases.uploadDocuments(workspaceA, actorId, []),
  KnowledgeBaseRagValidationError,
  "real upload rejects missing files"
);

const failingStorageUseCases = new KnowledgeUploadUseCases({
  documentRepository,
  ingestionJobRepository,
  fileStorage: {
    async store() {
      throw new Error("private filesystem path /tmp/secret");
    },
    async remove() {
      throw new Error("remove should not run when store fails");
    }
  },
  now,
  generateDocumentId: () => `document-${++documentSequence}`,
  generateJobId: () => `ingestion-job-${++uploadJobSequence}`
});
await assert.rejects(
  () =>
    failingStorageUseCases.uploadDocuments(workspaceA, actorId, [
      {
        clientFileId: "storage-failure",
        fileName: "Failure.txt",
        mediaType: "text/plain",
        content: new TextEncoder().encode("content")
      }
    ]),
  {
    name: "KnowledgeFileStorageError",
    message: "Document storage is temporarily unavailable."
  },
  "storage failures must be converted to safe errors"
);

await assert.rejects(
  () =>
    uploadUseCases.uploadDocuments(workspaceA, actorId, [
      {
        clientFileId: "mismatch-file",
        fileName: "Mismatch.pdf",
        mediaType: "application/pdf",
        content: new TextEncoder().encode("not a pdf")
      }
    ]),
  KnowledgeBaseRagValidationError,
  "real upload rejects content that does not match supported file signature"
);

const cleanupCalls = [];
const cleanupUseCases = new KnowledgeUploadUseCases({
  documentRepository: {
    async listDocuments() {
      return { items: [], total: 0 };
    },
    async getDocumentById() {
      return null;
    },
    async saveDocument() {
      throw new Error("database unavailable with /private/path");
    },
    async listDocumentChunks() {
      return { items: [], total: 0 };
    },
    async saveDocumentChunk(chunk) {
      return chunk;
    }
  },
  ingestionJobRepository,
  fileStorage: {
    async store(input) {
      return {
        storageKey: `private/${input.documentId}`,
        contentHash: "sha256-cleanup",
        sizeBytes: input.content.byteLength
      };
    },
    async remove(storageKey) {
      cleanupCalls.push(storageKey);
    }
  },
  now,
  generateDocumentId: () => `document-${++documentSequence}`,
  generateJobId: () => `ingestion-job-${++uploadJobSequence}`
});
await assert.rejects(
  () =>
    cleanupUseCases.uploadDocuments(workspaceA, actorId, [
      {
        clientFileId: "cleanup-file",
        fileName: "Cleanup.txt",
        mediaType: "text/plain",
        content: new TextEncoder().encode("cleanup")
      }
    ]),
  /database unavailable/,
  "persistence failure should still propagate for safe router mapping"
);
assert.deepEqual(cleanupCalls, [`private/document-${documentSequence}`]);

const storageRoot = await mkdtemp(join(tmpdir(), "kb-rag-storage-"));
try {
  const localStorage = new LocalKnowledgeFileStorage(storageRoot);
  const stored = await localStorage.store({
    workspaceId: "workspace/../../escape",
    documentId: "document/../../escape",
    fileName: "../../secret.txt",
    mediaType: "text/plain",
    content: new TextEncoder().encode("safe text")
  });
  assert.doesNotMatch(stored.storageKey, /\.\.|secret/);
  assert.equal(
    await readFile(join(storageRoot, ...stored.storageKey.split("/")), "utf8"),
    "safe text"
  );
  await localStorage.remove(stored.storageKey);
  await assert.rejects(
    () => readFile(join(storageRoot, ...stored.storageKey.split("/")), "utf8"),
    { code: "ENOENT" }
  );
} finally {
  await rm(storageRoot, { recursive: true, force: true });
}

assert.equal(
  (await documentUseCases.listDocuments(workspaceB)).total,
  0,
  "document list use case is workspace-scoped"
);
assert.equal(
  await documentUseCases.getDocument(workspaceB, prepared.documents[0].documentId),
  null,
  "document get use case is workspace-scoped"
);
assert.equal(
  (await ingestionUseCases.listIngestionJobs(workspaceB)).total,
  0,
  "ingestion job list use case is workspace-scoped"
);
assert.equal(
  await ingestionUseCases.getIngestionJob(workspaceB, prepared.ingestionJobs[0].jobId),
  null,
  "ingestion job get use case is workspace-scoped"
);

await dataSourceRepository.saveDataSource({
  sourceId: "source-a",
  workspaceId: workspaceA,
  provider: "notion",
  displayName: "Notion",
  connectionStatus: "not_connected",
  selectedScopeNodeCount: 0,
  createdAt: now(),
  updatedAt: now()
});

const connectedSource = await dataSourceUseCases.connectDataSourcePlaceholder(
  workspaceA,
  "source-a",
  actorId,
  {
    displayName: "Company Notion",
    providerAccountLabel: "workspace-safe-label"
  }
);

assert.equal(connectedSource.status, "connected");
assert.equal(connectedSource.displayName, "Company Notion");
assertSafePublicShape(connectedSource);
const savedSource = await dataSourceRepository.getDataSourceById(workspaceA, "source-a");
assert.equal(savedSource.connectedByUserId, actorId);
assert.deepEqual(savedSource.safeMetadata, {
  providerAccountLabel: "workspace-safe-label"
});
await assert.rejects(
  () =>
    dataSourceUseCases.connectDataSourcePlaceholder(
      workspaceA,
      "source-a",
      actorId,
      { token: "raw-provider-token" }
    ),
  KnowledgeBaseRagValidationError,
  "connection placeholder must reject raw credential-like fields"
);
assert.equal(
  (await dataSourceUseCases.listDataSources(workspaceB)).length,
  0,
  "data source list use case is workspace-scoped"
);

await syncScopeRepository.saveSyncScopeNodes(workspaceA, [
  {
    scopeNodeId: "scope-a",
    workspaceId: workspaceA,
    sourceId: "source-a",
    externalId: "page-a",
    nodeType: "page",
    displayName: "Policies",
    selected: false,
    selectable: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    scopeNodeId: "scope-b",
    workspaceId: workspaceA,
    sourceId: "source-a",
    externalId: "page-b",
    nodeType: "page",
    displayName: "Runbooks",
    selected: false,
    selectable: true,
    createdAt: now(),
    updatedAt: now()
  }
]);

const updatedScope = await syncUseCases.updateSyncScope(workspaceA, {
  selectedScopeNodeIds: ["scope-b"]
});
assert.deepEqual(
  updatedScope.map((node) => [node.scopeNodeId, node.selected]),
  [
    ["scope-a", false],
    ["scope-b", true]
  ]
);
assert.equal(
  (await syncUseCases.getSyncScope(workspaceB)).length,
  0,
  "sync scope read use case is workspace-scoped"
);

const syncJob = await syncUseCases.requestManualSync(workspaceA, actorId, {
  sourceId: "source-a",
  scopeNodeIds: ["scope-b"]
});
assert.equal(syncJob.status, "pending");
assert.equal(syncJob.scannedItemCount, 0);
assert.equal(syncJob.changedItemCount, 0);
assertSafePublicShape(syncJob);
assert.equal(
  (await syncUseCases.listSyncJobs(workspaceB)).total,
  0,
  "sync job list use case is workspace-scoped"
);
assert.equal(
  await syncUseCases.getSyncJob(workspaceB, syncJob.jobId),
  null,
  "sync job get use case is workspace-scoped"
);

const events = [
  createUploadValidatedEvent({
    eventId: "event-upload",
    workspaceId: workspaceA,
    actorId,
    occurredAt: now(),
    status: "accepted",
    acceptedCount: 1,
    rejectedCount: 0
  }),
  createIngestionQueuedEvent({
    eventId: "event-ingestion",
    workspaceId: workspaceA,
    actorId,
    occurredAt: now(),
    documentId: prepared.documents[0].documentId,
    jobId: prepared.ingestionJobs[0].jobId,
    status: "pending"
  }),
  createDataSourceConnectedEvent({
    eventId: "event-source",
    workspaceId: workspaceA,
    actorId,
    occurredAt: now(),
    sourceId: "source-a",
    status: "connected"
  }),
  createSyncScopeUpdatedEvent({
    eventId: "event-scope",
    workspaceId: workspaceA,
    actorId,
    occurredAt: now(),
    sourceId: "source-a",
    selectedScopeNodeCount: 1
  }),
  createSyncRequestedEvent({
    eventId: "event-sync",
    workspaceId: workspaceA,
    actorId,
    occurredAt: now(),
    jobId: syncJob.jobId,
    sourceId: "source-a",
    status: "pending"
  })
];

for (const event of events) {
  assert.ok(event.eventId, "eventId is required");
  assert.ok(event.occurredAt, "occurredAt is required");
  assert.equal(event.payload.workspaceId, workspaceA);
  assertSafePublicShape(event);
}

console.log("knowledge-base-rag application use case checks passed");

function collectFiles(root) {
  const entries = readdirSync(root);
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

function assertSafePublicShape(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePublicShape(item, [...path, String(index)]));
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(
      key,
      new RegExp(forbiddenPublicFragments.join("|"), "i"),
      `public shape must not expose unsafe field ${[...path, key].join(".")}`
    );
    assertSafePublicShape(child, [...path, key]);
  }
}
