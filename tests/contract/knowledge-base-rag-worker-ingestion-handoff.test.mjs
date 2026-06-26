import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import {
  KnowledgeIngestionHandoff,
  KnowledgeIngestionWorkerError
} from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-ingestion-handoff.ts";

const moduleRoot = "apps/backend/src/modules/knowledge-base-rag";
const workerRoot = join(moduleRoot, "worker");
const workerFile = join(workerRoot, "knowledge-ingestion-handoff.ts");
const forbiddenImportFragments = [
  "modules/agent-management",
  "modules/workflow-management",
  "modules/task-orchestration",
  "modules/authentication",
  "modules/subscription-payment",
  "modules/workspace-management",
  "modules/workspace-user-management",
  "modules/tools-integration",
  "apps/frontend",
  "apps/workers",
  "@vcp/frontend",
  "@prisma",
  "PrismaClient"
];
const forbiddenRuntimeCallFragments = [
  "objectStorage.",
  "storageClient.",
  "fileSystem.",
  "pdfParser.",
  "documentParser.",
  "embeddingProvider.",
  "vectorDatabase.",
  "qdrant.",
  "queuePayload"
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
  "vectorRef"
];

assert.equal(statSync(workerRoot).isDirectory(), true, "worker directory exists");
assert.equal(statSync(workerFile).isFile(), true, "worker handoff file exists");

for (const file of collectFiles(workerRoot).filter((path) => path.endsWith(".ts"))) {
  const source = readFileSync(file, "utf8");

  for (const fragment of forbiddenImportFragments) {
    assert.equal(
      source.includes(fragment),
      false,
      `${file} must not import frontend, Prisma, worker app runtime, or private modules`
    );
  }

  for (const fragment of forbiddenRuntimeCallFragments) {
    assert.equal(
      source.includes(fragment),
      false,
      `${file} must not call storage, parser, embedding, vector, or queue internals`
    );
  }

  assert.equal(
    source.includes("/api/knowledge-base/"),
    false,
    `${file} must not introduce the deprecated KB/RAG API route shape`
  );
}

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";
const actorId = "user-a";
const baseDocument = {
  documentId: "document-a",
  workspaceId: workspaceA,
  uploadedByUserId: actorId,
  displayName: "Employee handbook",
  fileName: "employee-handbook.txt",
  mimeType: "text/plain",
  fileType: "txt",
  sizeBytes: 1024,
  sourceType: "upload",
  storageKey: "private/object/key",
  status: "pending",
  ingestionStatus: "pending",
  indexingStatus: "pending",
  chunkCount: 0,
  indexedChunkCount: 0,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z"
};
const baseJob = {
  jobId: "job-a",
  workspaceId: workspaceA,
  documentId: "document-a",
  status: "pending",
  progress: 0,
  queuedAt: "2026-06-26T00:01:00.000Z",
  requestedByUserId: actorId,
  createdAt: "2026-06-26T00:01:00.000Z",
  updatedAt: "2026-06-26T00:01:00.000Z"
};

await testSuccessPath();
await testFailurePath();
await testWorkspaceAndLifecycleGuards();

console.log("knowledge-base-rag worker ingestion handoff checks passed");

async function testSuccessPath() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const publishedEvents = [];
  let processorCalls = 0;

  await documentRepository.saveDocument(baseDocument);
  await ingestionJobRepository.saveIngestionJob(baseJob);

  const handoff = new KnowledgeIngestionHandoff({
    documentRepository,
    ingestionJobRepository,
    now: createClock([
      "2026-06-26T00:02:00.000Z",
      "2026-06-26T00:03:00.000Z"
    ]),
    generateEventId: createEventIds(["event-started", "event-completed"]),
    eventPublisher: {
      async publish(event) {
        publishedEvents.push(event);
      }
    },
    async processor(input) {
      processorCalls += 1;
      assert.equal(input.workspaceId, workspaceA);
      assert.equal(input.job.status, "ingesting");
      assert.equal(input.document.ingestionStatus, "ingesting");
      assert.equal(input.document.indexingStatus, "pending");
    }
  });

  const result = await handoff.processIngestionJob({
    workspaceId: workspaceA,
    jobId: "job-a"
  });

  assert.equal(processorCalls, 1, "handoff should call the skeleton processor once");
  assert.equal(result.job.status, "ready");
  assert.equal(result.job.progress, 100);
  assert.equal(result.job.startedAt, "2026-06-26T00:02:00.000Z");
  assert.equal(result.job.completedAt, "2026-06-26T00:03:00.000Z");
  assert.equal(result.document.ingestionStatus, "ready");
  assert.equal(result.document.indexingStatus, "ready");
  assert.deepEqual(
    result.events.map((event) => event.name),
    [
      "knowledge.document.ingestionStarted",
      "knowledge.document.ingestionCompleted"
    ]
  );
  assert.deepEqual(
    publishedEvents.map((event) => event.name),
    result.events.map((event) => event.name),
    "events should be publishable through an injected event publisher"
  );
  assertSafePublicShape(result.events);

  const persistedJob = await ingestionJobRepository.getIngestionJobById(workspaceA, "job-a");
  const persistedDocument = await documentRepository.getDocumentById(
    workspaceA,
    "document-a"
  );
  assert.equal(persistedJob.status, "ready");
  assert.equal(persistedDocument.indexingStatus, "ready");
}

async function testFailurePath() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();

  await documentRepository.saveDocument({ ...baseDocument, documentId: "document-fail" });
  await ingestionJobRepository.saveIngestionJob({
    ...baseJob,
    jobId: "job-fail",
    documentId: "document-fail"
  });

  const handoff = new KnowledgeIngestionHandoff({
    documentRepository,
    ingestionJobRepository,
    now: createClock([
      "2026-06-26T00:04:00.000Z",
      "2026-06-26T00:05:00.000Z"
    ]),
    generateEventId: createEventIds(["event-fail-started", "event-failed"]),
    async processor() {
      throw new Error("raw secret token should not be persisted");
    }
  });

  const result = await handoff.processIngestionJob({
    workspaceId: workspaceA,
    jobId: "job-fail"
  });

  assert.equal(result.job.status, "failed");
  assert.equal(result.job.failedAt, "2026-06-26T00:05:00.000Z");
  assert.equal(result.job.errorCode, "knowledge.ingestion_failed");
  assert.equal(
    result.job.errorMessage,
    "Knowledge ingestion failed during worker handoff."
  );
  assert.equal(result.document.ingestionStatus, "failed");
  assert.equal(result.document.indexingStatus, "failed");
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["knowledge.document.ingestionStarted", "knowledge.document.ingestionFailed"]
  );
  assert.equal(
    JSON.stringify(result).includes("raw secret token"),
    false,
    "generic processor errors must not leak raw messages"
  );
  assertSafePublicShape(result.events);
}

async function testWorkspaceAndLifecycleGuards() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();

  await documentRepository.saveDocument(baseDocument);
  await ingestionJobRepository.saveIngestionJob(baseJob);
  await ingestionJobRepository.saveIngestionJob({
    ...baseJob,
    jobId: "job-ready",
    status: "ready"
  });

  const handoff = new KnowledgeIngestionHandoff({
    documentRepository,
    ingestionJobRepository,
    now: createClock(["2026-06-26T00:06:00.000Z"]),
    generateEventId: createEventIds(["event-unused"])
  });

  await assert.rejects(
    () => handoff.processIngestionJob({ workspaceId: workspaceB, jobId: "job-a" }),
    KnowledgeIngestionWorkerError,
    "handoff should enforce workspace scope before lifecycle updates"
  );
  await assert.rejects(
    () => handoff.processIngestionJob({ workspaceId: workspaceA, jobId: "job-ready" }),
    KnowledgeIngestionWorkerError,
    "handoff should process only queued/pending ingestion jobs"
  );
}

function createClock(timestamps) {
  const values = [...timestamps];
  return () => values.shift() ?? timestamps[timestamps.length - 1];
}

function createEventIds(ids) {
  const values = [...ids];
  return () => values.shift() ?? ids[ids.length - 1];
}

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
