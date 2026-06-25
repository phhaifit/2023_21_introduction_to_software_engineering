import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  toIngestionJobDto,
  toKnowledgeDataSourceDto,
  toKnowledgeDocumentChunkDto,
  toKnowledgeDocumentDto,
  toSyncJobDto,
  toSyncScopeNodeDto
} from "@vcp/backend/modules/knowledge-base-rag/application/dto-mappers.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { PrismaKnowledgeDataSourceRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-data-source-repository.ts";
import { PrismaKnowledgeDocumentRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-document-repository.ts";
import { PrismaKnowledgeIngestionJobRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-ingestion-job-repository.ts";
import {
  PrismaKnowledgeSyncJobRepository,
  PrismaKnowledgeSyncScopeRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-sync-repository.ts";

const moduleRoot = "apps/backend/src/modules/knowledge-base-rag";
const requiredDirs = ["api", "application", "domain", "infrastructure"];
const forbiddenImportFragments = [
  "modules/agent-management",
  "modules/workflow-management",
  "modules/task-orchestration",
  "modules/authentication",
  "modules/subscription-payment",
  "modules/workspace-management",
  "modules/workspace-user-management",
  "modules/tools-integration"
];
const forbiddenDtoFragments = [
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
];

for (const dir of requiredDirs) {
  assert.equal(
    statSync(join(moduleRoot, dir)).isDirectory(),
    true,
    `KB/RAG backend module should contain ${dir}/`
  );
}

const files = collectFiles(moduleRoot).filter((file) => file.endsWith(".ts"));
assert.ok(files.some((file) => file.includes("/domain/")), "domain files exist");
assert.ok(files.some((file) => file.includes("/application/")), "application files exist");
assert.ok(files.some((file) => file.includes("/infrastructure/")), "infrastructure files exist");
assert.ok(files.some((file) => /knowledge-base-rag-router\.ts$/.test(file)), "API router exists");

for (const file of files.filter((file) => file.includes("/domain/") || file.includes("/application/"))) {
  const source = readFileSync(file, "utf8");
  assert.equal(
    source.includes("/api/") || source.includes("Router("),
    false,
    `${file} must remain independent from the HTTP API router`
  );
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const fragment of forbiddenImportFragments) {
    assert.equal(
      source.includes(fragment),
      false,
      `${file} must not import private code from ${fragment}`
    );
  }
}

const prismaRepositoryFiles = files.filter((file) =>
  file.includes("/infrastructure/prisma-")
);
for (const file of prismaRepositoryFiles) {
  const source = readFileSync(file, "utf8");
  assert.match(
    source,
    /from "@vcp\/database"/,
    `${file} should use @vcp/database for Prisma access`
  );
  assert.doesNotMatch(
    source,
    /prisma\.(agent|workflow|workflowStep|task|taskRun|user|session|workspace|workspaceMember|subscription|transaction|tool|toolConnection|agentToolAssignment)\b/,
    `${file} must not query private tables owned by other modules`
  );
}

const repositorySource = readFileSync(
  join(moduleRoot, "application/knowledge-document-repository.ts"),
  "utf8"
);
for (const method of [
  "listDocuments",
  "getDocumentById",
  "saveDocument",
  "listDocumentChunks",
  "saveDocumentChunk"
]) {
  assert.match(repositorySource, new RegExp(`${method}\\(`), `${method} exists`);
}
assert.match(
  repositorySource,
  /workspaceId: EntityId<"workspaceId">/,
  "document repository methods carry workspace scope"
);

assert.equal(typeof PrismaKnowledgeDocumentRepository, "function");
assert.equal(typeof PrismaKnowledgeIngestionJobRepository, "function");
assert.equal(typeof PrismaKnowledgeDataSourceRepository, "function");
assert.equal(typeof PrismaKnowledgeSyncScopeRepository, "function");
assert.equal(typeof PrismaKnowledgeSyncJobRepository, "function");

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";
const documentRepository = new InMemoryKnowledgeDocumentRepository();
const ingestionRepository = new InMemoryKnowledgeIngestionJobRepository();
const dataSourceRepository = new InMemoryKnowledgeDataSourceRepository();
const syncScopeRepository = new InMemoryKnowledgeSyncScopeRepository();
const syncJobRepository = new InMemoryKnowledgeSyncJobRepository();

const documentA = {
  documentId: "document-a",
  workspaceId: workspaceA,
  uploadedByUserId: "user-a",
  displayName: "Runbook",
  fileName: "runbook.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  sizeBytes: 1024,
  sourceType: "upload",
  storageKey: "private/object/key",
  contentHash: "sha256-private",
  status: "pending",
  ingestionStatus: "pending",
  indexingStatus: "pending",
  chunkCount: 1,
  indexedChunkCount: 0,
  createdAt: "2026-06-25T00:00:00.000Z",
  updatedAt: "2026-06-25T00:01:00.000Z"
};

await documentRepository.saveDocument(documentA);
await documentRepository.saveDocument({ ...documentA, documentId: "document-b", workspaceId: workspaceB });

const workspaceADocuments = await documentRepository.listDocuments(workspaceA);
assert.equal(workspaceADocuments.total, 1, "in-memory documents are workspace-scoped");
assert.equal(workspaceADocuments.items[0].documentId, "document-a");

const chunk = {
  chunkId: "chunk-a",
  workspaceId: workspaceA,
  documentId: "document-a",
  chunkIndex: 0,
  contentText: "Visible text preview for the document chunk.",
  contentHash: "chunk-hash",
  embeddingStatus: "pending",
  vectorRef: "vector-private-ref",
  sourceLocator: "page 1",
  createdAt: "2026-06-25T00:02:00.000Z",
  updatedAt: "2026-06-25T00:02:00.000Z"
};
await documentRepository.saveDocumentChunk(chunk);
assert.equal(
  (await documentRepository.listDocumentChunks(workspaceB, "document-a")).total,
  0,
  "in-memory chunks are workspace-scoped"
);

const ingestionJob = {
  jobId: "job-ingest-a",
  workspaceId: workspaceA,
  documentId: "document-a",
  status: "ingesting",
  progress: 40,
  queuedAt: "2026-06-25T00:03:00.000Z",
  requestedByUserId: "user-a",
  createdAt: "2026-06-25T00:03:00.000Z",
  updatedAt: "2026-06-25T00:04:00.000Z"
};
await ingestionRepository.saveIngestionJob(ingestionJob);
assert.equal(
  (await ingestionRepository.listIngestionJobs(workspaceB)).total,
  0,
  "in-memory ingestion jobs are workspace-scoped"
);

const source = {
  sourceId: "source-a",
  workspaceId: workspaceA,
  provider: "notion",
  displayName: "Company Notion",
  connectionStatus: "connected",
  selectedScopeNodeCount: 1,
  connectedByUserId: "user-a",
  safeMetadata: { providerAccountLabel: "safe label" },
  createdAt: "2026-06-25T00:05:00.000Z",
  updatedAt: "2026-06-25T00:05:00.000Z"
};
await dataSourceRepository.saveDataSource(source);
assert.equal(
  (await dataSourceRepository.listDataSources(workspaceB)).length,
  0,
  "in-memory data sources are workspace-scoped"
);

const scopeNode = {
  scopeNodeId: "scope-node-a",
  workspaceId: workspaceA,
  sourceId: "source-a",
  externalId: "page-a",
  nodeType: "page",
  displayName: "Policies",
  selected: true,
  selectable: true,
  safeMetadata: { breadcrumb: "Root / Policies" },
  createdAt: "2026-06-25T00:06:00.000Z",
  updatedAt: "2026-06-25T00:06:00.000Z"
};
await syncScopeRepository.saveSyncScopeNodes(workspaceA, [scopeNode]);
assert.equal(
  (await syncScopeRepository.getSyncScope(workspaceB)).length,
  0,
  "in-memory sync scope is workspace-scoped"
);

const syncJob = {
  jobId: "job-sync-a",
  workspaceId: workspaceA,
  sourceId: "source-a",
  status: "syncing",
  requestedByUserId: "user-a",
  queuedAt: "2026-06-25T00:07:00.000Z",
  totalItems: 10,
  syncedItems: 3,
  failedItems: 0,
  createdAt: "2026-06-25T00:07:00.000Z",
  updatedAt: "2026-06-25T00:07:00.000Z"
};
await syncJobRepository.saveSyncJob(syncJob);
await syncJobRepository.appendSyncJobEvent({
  syncJobEventId: "sync-event-a",
  workspaceId: workspaceA,
  jobId: "job-sync-a",
  eventType: "knowledge.sync.started",
  status: "syncing",
  message: "Started",
  occurredAt: "2026-06-25T00:08:00.000Z",
  createdAt: "2026-06-25T00:08:00.000Z"
});
assert.equal(
  (await syncJobRepository.listSyncJobs(workspaceB)).total,
  0,
  "in-memory sync jobs are workspace-scoped"
);
assert.equal(
  (await syncJobRepository.listSyncJobEvents(workspaceB, "job-sync-a")).length,
  0,
  "in-memory sync job events are workspace-scoped"
);

const publicDtos = [
  toKnowledgeDocumentDto(documentA),
  toKnowledgeDocumentChunkDto(chunk),
  toIngestionJobDto(ingestionJob),
  toKnowledgeDataSourceDto(source),
  toSyncScopeNodeDto(scopeNode),
  toSyncJobDto(syncJob)
];

for (const dto of publicDtos) {
  const serialized = JSON.stringify(dto);
  for (const fragment of forbiddenDtoFragments) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `public DTO should not expose ${fragment}: ${serialized}`
    );
  }
}

console.log("knowledge-base-rag backend boundary checks passed");

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
