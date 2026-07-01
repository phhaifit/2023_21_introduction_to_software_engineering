import assert from "node:assert/strict";

import { KnowledgeDocumentParserError } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-document-text-extractor.ts";
import {
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { createKnowledgeIngestionWorkerRuntime } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/knowledge-ingestion-worker-runtime.ts";
import { KnowledgeIngestionWorkerError } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-ingestion-handoff.ts";

await testQueuedJobProcessing();
await testFifoSelectionAndEmptyQueue();
await testNonPendingJobsAreNotReprocessed();
await testStorageReadFailure();
await testParserFailure();
await testEmptyExtractionFailure();
await testChunkPersistenceFailure();
await testCrossWorkspaceRejection();

console.log("knowledge-base-rag ingestion worker runtime checks passed");

async function testQueuedJobProcessing() {
  const fixture = await createFixture();
  const storageReads = [];
  const extractionInputs = [];
  const jobStatuses = [];
  const documentStatuses = [];
  const publishedEvents = [];

  observeSaves(fixture, jobStatuses, documentStatuses);
  const runner = createRunner(fixture, {
    fileStorage: {
      async read(storageKey) {
        storageReads.push(storageKey);
        return Buffer.from("stored bytes");
      }
    },
    textExtractor: {
      async extract(input) {
        extractionInputs.push(input);
        return {
          text:
            "First paragraph contains employee policy details.\n\n" +
            "Second paragraph contains escalation instructions.",
          characterCount: 108,
          attribution: input.attribution
        };
      }
    },
    eventPublisher: {
      async publish(event) {
        publishedEvents.push(event);
      }
    }
  });

  const result = await runner.processNextQueuedJob("workspace-a");
  const chunks = await fixture.documentRepository.listDocumentChunks(
    "workspace-a",
    "document-a"
  );

  assert.ok(result);
  assert.deepEqual(storageReads, ["private/workspace-a/document-a.txt"]);
  assert.equal(extractionInputs.length, 1);
  assert.deepEqual(extractionInputs[0].attribution, {
    workspaceId: "workspace-a",
    documentId: "document-a",
    fileName: "document.txt",
    mediaType: "text/plain"
  });
  assert.ok(jobStatuses.includes("ingesting"));
  assert.equal(jobStatuses.at(-1), "ready");
  assert.ok(documentStatuses.includes("ingesting"));
  assert.equal(documentStatuses.at(-1), "ready");
  assert.equal(result.job.progress, 100);
  assert.equal(result.document.ingestionStatus, "ready");
  assert.equal(result.document.indexingStatus, "pending");
  assert.equal(chunks.total, 2);
  assert.deepEqual(
    chunks.items.map((chunk) => [
      chunk.workspaceId,
      chunk.documentId,
      chunk.chunkIndex,
      chunk.embeddingStatus,
      chunk.sourceLocator
    ]),
    [
      ["workspace-a", "document-a", 0, "pending", "text:0"],
      ["workspace-a", "document-a", 1, "pending", "text:1"]
    ]
  );
  assert.deepEqual(
    publishedEvents.map((event) => event.name),
    [
      "knowledge.document.ingestionStarted",
      "knowledge.document.ingestionCompleted"
    ]
  );
  assertSafeResult(result);

  await assert.rejects(
    () => runner.processJob("workspace-a", "job-a"),
    (error) =>
      error instanceof KnowledgeIngestionWorkerError &&
      error.errorCode === "knowledge.ingestion_job_not_queued"
  );
  const chunksAfterRepeatedCall =
    await fixture.documentRepository.listDocumentChunks("workspace-a", "document-a");
  assert.equal(storageReads.length, 1);
  assert.equal(extractionInputs.length, 1);
  assert.equal(chunksAfterRepeatedCall.total, chunks.total);
}

async function testFifoSelectionAndEmptyQueue() {
  const fixture = await createFixture();
  await fixture.documentRepository.saveDocument(
    createDocument({
      documentId: "document-0",
      storageKey: "private/document-0.txt"
    })
  );
  await fixture.ingestionJobRepository.saveIngestionJob(
    createJob({
      jobId: "job-0",
      documentId: "document-0"
    })
  );
  await fixture.documentRepository.saveDocument(
    createDocument({ documentId: "document-b", storageKey: "private/document-b.txt" })
  );
  await fixture.ingestionJobRepository.saveIngestionJob(
    createJob({
      jobId: "job-b",
      documentId: "document-b",
      queuedAt: "2026-07-01T00:02:00.000Z"
    })
  );
  const processedStorageKeys = [];
  const runner = createRunner(fixture, {
    fileStorage: {
      async read(storageKey) {
        processedStorageKeys.push(storageKey);
        return Buffer.from("bytes");
      }
    }
  });

  const first = await runner.processNextQueuedJob("workspace-a");
  const second = await runner.processNextQueuedJob("workspace-a");
  const third = await runner.processNextQueuedJob("workspace-a");
  const none = await runner.processNextQueuedJob("workspace-a");

  assert.equal(first.job.jobId, "job-0");
  assert.equal(second.job.jobId, "job-a");
  assert.equal(third.job.jobId, "job-b");
  assert.equal(none, null);
  assert.deepEqual(processedStorageKeys, [
    "private/document-0.txt",
    "private/workspace-a/document-a.txt",
    "private/document-b.txt"
  ]);
}

async function testNonPendingJobsAreNotReprocessed() {
  for (const status of ["ingesting", "failed"]) {
    const fixture = await createFixture();
    await fixture.ingestionJobRepository.saveIngestionJob(
      createJob({
        status,
        startedAt: "2026-07-01T00:02:00.000Z",
        ...(status === "failed"
          ? {
              failedAt: "2026-07-01T00:03:00.000Z",
              errorCode: "knowledge.ingestion_failed",
              errorMessage: "Knowledge ingestion failed during worker handoff."
            }
          : {})
      })
    );
    let storageReads = 0;
    let extractions = 0;
    let chunkWrites = 0;
    const saveChunk = fixture.documentRepository.saveDocumentChunk.bind(
      fixture.documentRepository
    );
    fixture.documentRepository.saveDocumentChunk = async (chunk) => {
      chunkWrites += 1;
      return saveChunk(chunk);
    };
    const runner = createRunner(fixture, {
      fileStorage: {
        async read() {
          storageReads += 1;
          return Buffer.from("stored bytes");
        }
      },
      textExtractor: {
        async extract(input) {
          extractions += 1;
          return {
            text: "This content must not be processed.",
            characterCount: 35,
            attribution: input.attribution
          };
        }
      }
    });

    await assert.rejects(
      () => runner.processJob("workspace-a", "job-a"),
      (error) =>
        error instanceof KnowledgeIngestionWorkerError &&
        error.errorCode === "knowledge.ingestion_job_not_queued"
    );
    assert.equal(storageReads, 0);
    assert.equal(extractions, 0);
    assert.equal(chunkWrites, 0);
    const persistedJob = await fixture.ingestionJobRepository.getIngestionJobById(
      "workspace-a",
      "job-a"
    );
    assert.equal(persistedJob.status, status);
  }
}

async function testStorageReadFailure() {
  const fixture = await createFixture();
  const runner = createRunner(fixture, {
    fileStorage: {
      async read() {
        throw new Error("/private/storage/path secret token");
      }
    }
  });

  const result = await runner.processNextQueuedJob("workspace-a");
  assertFailed(
    result,
    "knowledge.document_storage_read_failed",
    "Knowledge document content is unavailable."
  );
}

async function testParserFailure() {
  const fixture = await createFixture();
  const runner = createRunner(fixture, {
    textExtractor: {
      async extract() {
        throw new KnowledgeDocumentParserError(
          "knowledge.document_extraction_failed",
          "Knowledge document text could not be extracted."
        );
      }
    }
  });

  const result = await runner.processNextQueuedJob("workspace-a");
  assertFailed(
    result,
    "knowledge.document_extraction_failed",
    "Knowledge document text could not be extracted."
  );
}

async function testEmptyExtractionFailure() {
  const fixture = await createFixture();
  const runner = createRunner(fixture, {
    textExtractor: {
      async extract(input) {
        return { text: " \n\t ", characterCount: 0, attribution: input.attribution };
      }
    }
  });

  const result = await runner.processNextQueuedJob("workspace-a");
  assertFailed(
    result,
    "knowledge.document_content_empty",
    "Knowledge document content is empty after normalization."
  );
}

async function testChunkPersistenceFailure() {
  const fixture = await createFixture();
  const saveChunk = fixture.documentRepository.saveDocumentChunk.bind(
    fixture.documentRepository
  );
  let chunkWrites = 0;
  fixture.documentRepository.saveDocumentChunk = async (chunk) => {
    chunkWrites += 1;
    if (chunkWrites === 2) {
      throw new Error("database internals queuePayload workerPayload secret");
    }
    return saveChunk(chunk);
  };
  const runner = createRunner(fixture, {
    textExtractor: {
      async extract(input) {
        return {
          text:
            "First paragraph is long enough to become a chunk.\n\n" +
            "Second paragraph must fail while being persisted.",
          characterCount: 102,
          attribution: input.attribution
        };
      }
    },
    chunkerOptions: { maxCharactersPerChunk: 55 }
  });

  const result = await runner.processNextQueuedJob("workspace-a");
  assertFailed(
    result,
    "knowledge.ingestion_failed",
    "Knowledge ingestion failed during worker handoff."
  );
  const chunks = await fixture.documentRepository.listDocumentChunks(
    "workspace-a",
    "document-a"
  );
  assert.equal(chunkWrites, 2);
  assert.equal(chunks.total, 1);
  assert.equal(result.document.chunkCount, 0);
  assert.notEqual(result.document.status, "ready");
}

async function testCrossWorkspaceRejection() {
  const fixture = await createFixture();
  const runner = createRunner(fixture);

  await assert.rejects(
    () => runner.processJob("workspace-b", "job-a"),
    (error) =>
      error instanceof KnowledgeIngestionWorkerError &&
      error.errorCode === "knowledge.ingestion_job_not_found" &&
      !error.message.includes("workspace-a")
  );
  const job = await fixture.ingestionJobRepository.getIngestionJobById(
    "workspace-a",
    "job-a"
  );
  assert.equal(job.status, "pending");
}

async function createFixture() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  await documentRepository.saveDocument(createDocument());
  await ingestionJobRepository.saveIngestionJob(createJob());
  return { documentRepository, ingestionJobRepository };
}

function createRunner(fixture, overrides = {}) {
  let eventSequence = 0;
  return createKnowledgeIngestionWorkerRuntime({
    ...fixture,
    fileStorage:
      overrides.fileStorage ??
      ({ async read() { return Buffer.from("stored bytes"); } }),
    textExtractor:
      overrides.textExtractor ??
      ({
        async extract(input) {
          return {
            text: "Alpha policy paragraph.\n\nBeta escalation paragraph.",
            characterCount: 49,
            attribution: input.attribution
          };
        }
      }),
    now: createClock(),
    generateEventId: () => `event-${eventSequence++}`,
    generateChunkId: ({ documentId, chunkIndex }) =>
      `${documentId}-chunk-${chunkIndex}`,
    chunkerOptions: overrides.chunkerOptions ?? { maxCharactersPerChunk: 70 },
    eventPublisher: overrides.eventPublisher
  });
}

function observeSaves(fixture, jobStatuses, documentStatuses) {
  const saveJob = fixture.ingestionJobRepository.saveIngestionJob.bind(
    fixture.ingestionJobRepository
  );
  fixture.ingestionJobRepository.saveIngestionJob = async (job) => {
    jobStatuses.push(job.status);
    return saveJob(job);
  };
  const saveDocument = fixture.documentRepository.saveDocument.bind(
    fixture.documentRepository
  );
  fixture.documentRepository.saveDocument = async (document) => {
    documentStatuses.push(document.ingestionStatus);
    return saveDocument(document);
  };
}

function assertFailed(result, errorCode, errorMessage) {
  assert.ok(result);
  assert.equal(result.job.status, "failed");
  assert.equal(result.document.ingestionStatus, "failed");
  assert.equal(result.document.indexingStatus, "failed");
  assert.equal(result.job.errorCode, errorCode);
  assert.equal(result.job.errorMessage, errorMessage);
  assertSafeResult(result);
}

function assertSafeResult(result) {
  const serialized = JSON.stringify({
    job: result.job,
    events: result.events
  });
  for (const forbidden of [
    "storageKey",
    "privateUrl",
    "filesystem",
    "queuePayload",
    "workerPayload",
    "runtimeInternals",
    "secret",
    "token",
    "rawEmbedding",
    "embeddingVector",
    "vectorRef"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
}

function createDocument(overrides = {}) {
  return {
    documentId: "document-a",
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
    displayName: "Document",
    fileName: "document.txt",
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: 12,
    sourceType: "upload",
    storageKey: "private/workspace-a/document-a.txt",
    status: "pending",
    ingestionStatus: "pending",
    indexingStatus: "pending",
    chunkCount: 0,
    indexedChunkCount: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides
  };
}

function createJob(overrides = {}) {
  return {
    jobId: "job-a",
    workspaceId: "workspace-a",
    documentId: "document-a",
    status: "pending",
    progress: 0,
    queuedAt: "2026-07-01T00:01:00.000Z",
    requestedByUserId: "user-a",
    createdAt: "2026-07-01T00:01:00.000Z",
    updatedAt: "2026-07-01T00:01:00.000Z",
    ...overrides
  };
}

function createClock() {
  let index = 0;
  return () => `2026-07-01T00:${String(index++).padStart(2, "0")}:00.000Z`;
}
