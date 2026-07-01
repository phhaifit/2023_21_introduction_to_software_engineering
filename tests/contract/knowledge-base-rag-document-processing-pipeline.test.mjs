import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { KnowledgeDocumentParserError } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-document-text-extractor.ts";
import { KnowledgeDocumentProcessingPipeline } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-processing-pipeline.ts";
import { chunkKnowledgeDocumentText } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-text-chunker.ts";
import { normalizeKnowledgeDocumentText } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-text-normalizer.ts";
import { KnowledgeIngestionHandoff } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-ingestion-handoff.ts";

const workerRoot = "apps/backend/src/modules/knowledge-base-rag/worker";
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
  "@vcp/frontend",
  "@prisma",
  "PrismaClient"
];
const forbiddenRuntimeFragments = [
  "embeddingProvider.",
  "vectorDatabase.",
  "qdrant.",
  "objectStorage.",
  "storageClient.",
  "pdfParser.",
  "docxParser.",
  "ocr.",
  "/api/knowledge-base/"
];
const unsafePayloadKeys = [
  "credential",
  "secret",
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

for (const file of collectFiles(workerRoot).filter((path) => path.endsWith(".ts"))) {
  const source = readFileSync(file, "utf8");

  for (const fragment of forbiddenImportFragments) {
    assert.equal(
      source.includes(fragment),
      false,
      `${file} must not import frontend, Prisma, or private modules`
    );
  }

  for (const fragment of forbiddenRuntimeFragments) {
    assert.equal(
      source.includes(fragment),
      false,
      `${file} must not call storage, parser, embedding, vector, HTTP route, or OCR runtime`
    );
  }
}

assertNormalizerAndChunker();
await assertSuccessfulProcessing();
await assertEmptyContentFailure();
await assertUnsupportedContentFailure();
await assertReaderFailureIsSafe();
await assertParserFailureIsSafe();

console.log("knowledge-base-rag document processing pipeline checks passed");

function assertNormalizerAndChunker() {
  const normalized = normalizeKnowledgeDocumentText(
    "  First\tsection line.  \r\nSecond    line.\n\n\nThird   paragraph.  "
  );
  assert.equal(
    normalized,
    "First section line.\nSecond line.\n\nThird paragraph.",
    "normalizer should collapse whitespace and preserve paragraph boundaries"
  );

  const chunks = chunkKnowledgeDocumentText(
    "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.",
    { maxCharactersPerChunk: 30 }
  );
  assert.deepEqual(
    chunks.map((chunk) => [chunk.chunkIndex, chunk.contentText]),
    [
      [0, "Alpha beta gamma delta epsilon"],
      [1, "zeta eta theta iota kappa"],
      [2, "lambda mu."]
    ],
    "chunker should split text deterministically by stable chunk index"
  );
}

async function assertSuccessfulProcessing() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const document = createDocument();
  const job = createJob();

  await documentRepository.saveDocument(document);
  await ingestionJobRepository.saveIngestionJob(job);

  const pipeline = new KnowledgeDocumentProcessingPipeline({
    documentRepository,
    ingestionJobRepository,
    contentReader: {
      async readText(input) {
        assert.equal(input.workspaceId, "workspace-a");
        assert.equal(input.document.documentId, "document-a");
        return [
          "  Welcome\tto the handbook.  ",
          "This  document explains support escalation.",
          "",
          "Follow the incident checklist before contacting engineering leadership.",
          "Record customer impact and timeline notes."
        ].join("\n");
      }
    },
    now: createClock(["2026-06-26T00:02:30.000Z"]),
    generateChunkId: ({ documentId, chunkIndex }) => `${documentId}-chunk-${chunkIndex}`,
    chunkerOptions: { maxCharactersPerChunk: 65 }
  });
  const handoff = new KnowledgeIngestionHandoff({
    documentRepository,
    ingestionJobRepository,
    now: createClock([
      "2026-06-26T00:02:00.000Z",
      "2026-06-26T00:03:00.000Z"
    ]),
    generateEventId: createEventIds(["event-start", "event-complete"]),
    processor: pipeline.asHandoffProcessor()
  });

  const result = await handoff.processIngestionJob({
    workspaceId: "workspace-a",
    jobId: "job-a"
  });
  const savedChunks = await documentRepository.listDocumentChunks(
    "workspace-a",
    "document-a"
  );
  const savedDocument = await documentRepository.getDocumentById(
    "workspace-a",
    "document-a"
  );
  const savedJob = await ingestionJobRepository.getIngestionJobById(
    "workspace-a",
    "job-a"
  );

  assert.equal(result.job.status, "ready");
  assert.equal(result.job.progress, 100);
  assert.equal(savedJob.status, "ready");
  assert.equal(savedDocument.ingestionStatus, "ready");
  assert.equal(
    savedDocument.indexingStatus,
    "pending",
    "processing chunks must not mark embedding/vector indexing as complete"
  );
  assert.equal(savedDocument.chunkCount, savedChunks.total);
  assert.equal(savedDocument.indexedChunkCount, 0);
  assert.equal(savedChunks.total, 4);
  assert.deepEqual(
    savedChunks.items.map((chunk) => [
      chunk.chunkId,
      chunk.chunkIndex,
      chunk.contentText,
      chunk.embeddingStatus,
      chunk.vectorRef
    ]),
    [
      [
        "document-a-chunk-0",
        0,
        "Welcome to the handbook. This document explains support",
        "pending",
        undefined
      ],
      [
        "document-a-chunk-1",
        1,
        "escalation.",
        "pending",
        undefined
      ],
      [
        "document-a-chunk-2",
        2,
        "Follow the incident checklist before contacting engineering",
        "pending",
        undefined
      ],
      [
        "document-a-chunk-3",
        3,
        "leadership. Record customer impact and timeline notes.",
        "pending",
        undefined
      ]
    ]
  );
  assert.equal(result.events[1].payload.chunkCount, 4);
  assert.equal(result.events[1].payload.indexedChunkCount, 0);
  assertSafePublicPayload(result.events);
}

async function assertEmptyContentFailure() {
  const result = await runFailingPipeline({
    document: createDocument({ documentId: "document-empty" }),
    job: createJob({ jobId: "job-empty", documentId: "document-empty" }),
    reader: async () => " \n\t \n "
  });

  assert.equal(result.job.status, "failed");
  assert.equal(result.job.errorCode, "knowledge.document_content_empty");
  assert.equal(
    result.job.errorMessage,
    "Knowledge document content is empty after normalization."
  );
  assert.equal(result.document.ingestionStatus, "failed");
  assert.equal(result.document.indexingStatus, "failed");
  assertSafePublicPayload(result.events);
}

async function assertUnsupportedContentFailure() {
  const result = await runFailingPipeline({
    document: createDocument({
      documentId: "document-csv",
      mimeType: "text/csv",
      fileType: "csv"
    }),
    job: createJob({ jobId: "job-csv", documentId: "document-csv" }),
    reader: async () => "Unsupported content."
  });

  assert.equal(result.job.status, "failed");
  assert.equal(result.job.errorCode, "knowledge.document_type_unsupported");
  assert.equal(
    result.job.errorMessage,
    "Knowledge document type is not supported by the text processing pipeline."
  );
  assertSafePublicPayload(result.events);
}

async function assertReaderFailureIsSafe() {
  const result = await runFailingPipeline({
    document: createDocument({ documentId: "document-reader-failure" }),
    job: createJob({
      jobId: "job-reader-failure",
      documentId: "document-reader-failure"
    }),
    reader: async () => {
      throw new Error("raw storageKey private/object/key secret token");
    }
  });

  assert.equal(result.job.status, "failed");
  assert.equal(result.job.errorCode, "knowledge.document_content_read_failed");
  assert.equal(
    result.job.errorMessage,
    "Knowledge document content could not be read for processing."
  );
  assert.equal(
    JSON.stringify(result).includes("raw storageKey private/object/key secret token"),
    false,
    "reader failure should not leak raw content or private adapter details"
  );
  assertSafePublicPayload(result.events);
}

async function assertParserFailureIsSafe() {
  const result = await runFailingPipeline({
    document: createDocument({ documentId: "document-parser-failure" }),
    job: createJob({
      jobId: "job-parser-failure",
      documentId: "document-parser-failure"
    }),
    reader: async () => {
      throw new KnowledgeDocumentParserError(
        "knowledge.document_extraction_failed",
        "Knowledge document text could not be extracted."
      );
    }
  });

  assert.equal(result.job.status, "failed");
  assert.equal(result.job.errorCode, "knowledge.document_extraction_failed");
  assert.equal(
    result.job.errorMessage,
    "Knowledge document text could not be extracted."
  );
  assertSafePublicPayload(result.events);
}

async function runFailingPipeline({ document, job, reader }) {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();

  await documentRepository.saveDocument(document);
  await ingestionJobRepository.saveIngestionJob(job);

  const pipeline = new KnowledgeDocumentProcessingPipeline({
    documentRepository,
    ingestionJobRepository,
    contentReader: {
      readText: reader
    },
    now: createClock(["2026-06-26T00:12:30.000Z"]),
    generateChunkId: ({ documentId, chunkIndex }) => `${documentId}-chunk-${chunkIndex}`,
    chunkerOptions: { maxCharactersPerChunk: 65 }
  });
  const handoff = new KnowledgeIngestionHandoff({
    documentRepository,
    ingestionJobRepository,
    now: createClock([
      "2026-06-26T00:12:00.000Z",
      "2026-06-26T00:13:00.000Z"
    ]),
    generateEventId: createEventIds(["event-fail-start", "event-fail"]),
    processor: pipeline.asHandoffProcessor()
  });

  return handoff.processIngestionJob({
    workspaceId: document.workspaceId,
    jobId: job.jobId
  });
}

function createDocument(overrides = {}) {
  return {
    documentId: "document-a",
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
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
    updatedAt: "2026-06-26T00:00:00.000Z",
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
    queuedAt: "2026-06-26T00:01:00.000Z",
    requestedByUserId: "user-a",
    createdAt: "2026-06-26T00:01:00.000Z",
    updatedAt: "2026-06-26T00:01:00.000Z",
    ...overrides
  };
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

function assertSafePublicPayload(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePublicPayload(item, [...path, String(index)]));
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      unsafePayloadKeys.some((unsafeKey) => key.toLowerCase() === unsafeKey.toLowerCase()),
      false,
      `public payload must not expose unsafe field ${[...path, key].join(".")}`
    );
    assertSafePublicPayload(child, [...path, key]);
  }
}
