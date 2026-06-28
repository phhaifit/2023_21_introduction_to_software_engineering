import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import {
  createKnowledgeBaseRagLocalFlowRunner,
  KnowledgeBaseRagLocalFlowRunner
} from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-base-rag-local-flow-runner.ts";
import { KnowledgeDocumentIndexingError } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-indexing-errors.ts";
import { KnowledgeIngestionHandoff } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-ingestion-handoff.ts";

const root = process.cwd();
const workerRoot = join(root, "apps/backend/src/modules/knowledge-base-rag/worker");
const packageJsonPath = join(root, "package.json");
const prismaSchemaPath = join(root, "packages/database/prisma/schema.prisma");
const forbiddenImportFragments = [
  "apps/frontend",
  "@vcp/frontend",
  "api/knowledge-base-rag-router",
  "knowledge-base-rag-router",
  "modules/agent-management",
  "modules/workflow-management",
  "modules/task-orchestration",
  "modules/authentication",
  "modules/subscription-payment",
  "modules/workspace-management",
  "modules/workspace-user-management",
  "modules/tools-integration",
  "@prisma",
  "PrismaClient"
];
const forbiddenRuntimeFragments = [
  "openai",
  "@huggingface",
  "huggingface",
  "bge",
  "qdrant",
  "pinecone",
  "weaviate",
  "faiss",
  "elasticsearch",
  "/api/knowledge-base/"
];
const forbiddenPackageNames = [
  "openai",
  "@huggingface/inference",
  "@qdrant/js-client-rest",
  "@pinecone-database/pinecone",
  "weaviate-ts-client",
  "faiss-node",
  "@elastic/elasticsearch"
];
const unsafeLeakFragments = [
  "raw document content",
  "raw embedding",
  "embeddingVector",
  "storageKey",
  "private/object/key",
  "provider payload",
  "vector database config",
  "internal vector id",
  "secret token",
  "credential",
  "queue payload"
];

assert.ok(
  existsSync(join(workerRoot, "knowledge-base-rag-local-flow-runner.ts")),
  "local flow runner must exist under the KB/RAG worker boundary"
);
assertWorkerBoundarySafety();
assertPackageAndSchemaSafety();

await assertSuccessfulLocalFlow();
await assertContentReaderFailureIsSafe();
await assertEmbeddingFailureIsSafe();
await assertVectorIndexFailureIsSafe();
await assertUnknownIndexingFailureIsSafe();

console.log("knowledge-base-rag end-to-end local flow checks passed");

async function assertSuccessfulLocalFlow() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const embeddingCalls = [];
  const vectorCalls = [];
  const vectorRecords = new Map();

  await documentRepository.saveDocument(createDocument());
  await ingestionJobRepository.saveIngestionJob(createJob());

  const runner = createKnowledgeBaseRagLocalFlowRunner({
    documentRepository,
    ingestionJobRepository,
    contentReader: {
      async readText(input) {
        assert.equal(input.workspaceId, "workspace-a");
        assert.equal(input.document.documentId, "document-a");
        return [
          "  Welcome\tto the handbook.  ",
          "This document explains support escalation.",
          "",
          "Follow the incident checklist before contacting engineering leadership.",
          "Record customer impact and timeline notes."
        ].join("\n");
      }
    },
    embeddingAdapter: {
      async generateEmbedding(input) {
        embeddingCalls.push(input);
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          embedding: deterministicEmbedding(input.chunkText, input.chunkIndex)
        };
      }
    },
    vectorIndexAdapter: {
      async upsertChunkEmbedding(input) {
        vectorCalls.push(input);
        const vectorRef = `local-vector-${input.chunkId}`;
        vectorRecords.set(vectorRef, {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          embedding: [...input.embedding]
        });
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef
        };
      }
    },
    now: createClock([
      "2026-06-28T01:00:00.000Z",
      "2026-06-28T01:00:01.000Z",
      "2026-06-28T01:00:02.000Z",
      "2026-06-28T01:00:03.000Z",
      "2026-06-28T01:00:04.000Z",
      "2026-06-28T01:00:05.000Z",
      "2026-06-28T01:00:06.000Z",
      "2026-06-28T01:00:07.000Z",
      "2026-06-28T01:00:08.000Z",
      "2026-06-28T01:00:09.000Z"
    ]),
    generateChunkId: ({ documentId, chunkIndex }) => `${documentId}-chunk-${chunkIndex}`,
    generateEventId: createEventIds(["event-start", "event-complete"]),
    chunkerOptions: { maxCharactersPerChunk: 65 }
  });

  const result = await runner.run({
    workspaceId: "workspace-a",
    jobId: "job-a"
  });
  const persistedDocument = await documentRepository.getDocumentById(
    "workspace-a",
    "document-a"
  );
  const persistedJob = await ingestionJobRepository.getIngestionJobById(
    "workspace-a",
    "job-a"
  );
  const persistedChunks = await documentRepository.listDocumentChunks(
    "workspace-a",
    "document-a"
  );

  assert.equal(result.phase, "completed");
  assert.equal(result.failure, undefined);
  assert.equal(result.ingestion.job.status, "ready");
  assert.equal(result.ingestion.document.ingestionStatus, "ready");
  assert.equal(result.ingestion.document.indexingStatus, "pending");
  assert.equal(result.document.status, "ready");
  assert.equal(result.document.ingestionStatus, "ready");
  assert.equal(result.document.indexingStatus, "ready");
  assert.equal(result.document.indexedChunkCount, persistedChunks.total);
  assert.equal(persistedDocument.indexingStatus, "ready");
  assert.equal(persistedJob.status, "ready");
  assert.equal(persistedChunks.total, 4);
  assert.equal(embeddingCalls.length, persistedChunks.total);
  assert.equal(vectorCalls.length, persistedChunks.total);
  assert.equal(vectorRecords.size, persistedChunks.total);
  assert.deepEqual(
    persistedChunks.items.map((chunk) => [
      chunk.chunkId,
      chunk.embeddingStatus,
      chunk.vectorRef
    ]),
    [
      ["document-a-chunk-0", "ready", "local-vector-document-a-chunk-0"],
      ["document-a-chunk-1", "ready", "local-vector-document-a-chunk-1"],
      ["document-a-chunk-2", "ready", "local-vector-document-a-chunk-2"],
      ["document-a-chunk-3", "ready", "local-vector-document-a-chunk-3"]
    ]
  );
  assertSafeResult(result);
}

async function assertContentReaderFailureIsSafe() {
  const { runner, documentRepository, ingestionJobRepository } = await createFailingFlow({
    documentId: "document-reader-failure",
    jobId: "job-reader-failure",
    contentReader: {
      async readText() {
        throw new Error("raw document content storageKey private/object/key secret token");
      }
    }
  });

  const result = await runner.run({
    workspaceId: "workspace-a",
    jobId: "job-reader-failure"
  });
  const document = await documentRepository.getDocumentById(
    "workspace-a",
    "document-reader-failure"
  );
  const job = await ingestionJobRepository.getIngestionJobById(
    "workspace-a",
    "job-reader-failure"
  );

  assert.equal(result.phase, "ingestion_failed");
  assert.equal(result.failure.errorCode, "knowledge.document_content_read_failed");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document content could not be read for processing."
  );
  assert.equal(document.status, "failed");
  assert.equal(document.ingestionStatus, "failed");
  assert.equal(document.indexingStatus, "failed");
  assert.equal(job.status, "failed");
  assertSafeResult(result);
}

async function assertEmbeddingFailureIsSafe() {
  const { runner, documentRepository, ingestionJobRepository } = await createFailingFlow({
    documentId: "document-embedding-failure",
    jobId: "job-embedding-failure",
    embeddingAdapter: {
      async generateEmbedding() {
        throw new Error(
          "provider payload raw embedding embeddingVector storageKey private/object/key secret token"
        );
      }
    }
  });

  const result = await runner.run({
    workspaceId: "workspace-a",
    jobId: "job-embedding-failure"
  });
  const document = await documentRepository.getDocumentById(
    "workspace-a",
    "document-embedding-failure"
  );
  const job = await ingestionJobRepository.getIngestionJobById(
    "workspace-a",
    "job-embedding-failure"
  );

  assert.equal(result.phase, "indexing_failed");
  assert.equal(result.failure.errorCode, "knowledge.embedding_failed");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document chunk embedding generation failed."
  );
  assert.equal(document.ingestionStatus, "ready");
  assert.equal(document.indexingStatus, "failed");
  assert.equal(job.status, "ready");
  assertSafeResult(result);
}

async function assertVectorIndexFailureIsSafe() {
  const { runner, documentRepository, ingestionJobRepository } = await createFailingFlow({
    documentId: "document-vector-failure",
    jobId: "job-vector-failure",
    vectorIndexAdapter: {
      async upsertChunkEmbedding() {
        throw new Error(
          "vector database config internal vector id credential secret token"
        );
      }
    }
  });

  const result = await runner.run({
    workspaceId: "workspace-a",
    jobId: "job-vector-failure"
  });
  const document = await documentRepository.getDocumentById(
    "workspace-a",
    "document-vector-failure"
  );
  const job = await ingestionJobRepository.getIngestionJobById(
    "workspace-a",
    "job-vector-failure"
  );

  assert.equal(result.phase, "indexing_failed");
  assert.equal(result.failure.errorCode, "knowledge.vector_index_failed");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document chunk vector indexing failed."
  );
  assert.equal(document.ingestionStatus, "ready");
  assert.equal(document.indexingStatus, "failed");
  assert.equal(job.status, "ready");
  assertSafeResult(result);
}

async function assertUnknownIndexingFailureIsSafe() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const document = createDocument({ documentId: "document-unknown-failure" });
  const job = createJob({
    jobId: "job-unknown-failure",
    documentId: "document-unknown-failure"
  });

  await documentRepository.saveDocument(document);
  await ingestionJobRepository.saveIngestionJob(job);

  const handoff = new KnowledgeIngestionHandoff({
    documentRepository,
    ingestionJobRepository,
    now: createClock([
      "2026-06-28T05:00:00.000Z",
      "2026-06-28T05:00:01.000Z"
    ]),
    generateEventId: createEventIds(["event-unknown-start", "event-unknown-complete"])
  });
  const runner = new KnowledgeBaseRagLocalFlowRunner({
    documentRepository,
    ingestionJobRepository,
    ingestionHandoff: handoff,
    indexingPipeline: {
      async processDocument() {
        throw new Error(
          "unknown provider payload embeddingVector vector database config secret token"
        );
      }
    },
    now: createClock(["2026-06-28T05:00:02.000Z"])
  });

  const result = await runner.run({
    workspaceId: "workspace-a",
    jobId: "job-unknown-failure"
  });

  assert.equal(result.phase, "indexing_failed");
  assert.equal(result.failure.errorCode, "knowledge.indexing_failed");
  assert.equal(result.failure.errorMessage, "Knowledge document indexing failed.");
  assert.equal(result.document.indexingStatus, "failed");
  assertSafeResult(result);
}

async function createFailingFlow({
  documentId,
  jobId,
  contentReader = defaultContentReader(),
  embeddingAdapter = defaultEmbeddingAdapter(),
  vectorIndexAdapter = defaultVectorIndexAdapter()
}) {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();

  await documentRepository.saveDocument(createDocument({ documentId }));
  await ingestionJobRepository.saveIngestionJob(createJob({ jobId, documentId }));

  return {
    documentRepository,
    ingestionJobRepository,
    runner: createKnowledgeBaseRagLocalFlowRunner({
      documentRepository,
      ingestionJobRepository,
      contentReader,
      embeddingAdapter,
      vectorIndexAdapter,
      now: createClock([
        "2026-06-28T02:00:00.000Z",
        "2026-06-28T02:00:01.000Z",
        "2026-06-28T02:00:02.000Z",
        "2026-06-28T02:00:03.000Z",
        "2026-06-28T02:00:04.000Z",
        "2026-06-28T02:00:05.000Z"
      ]),
      generateChunkId: ({ documentId: chunkDocumentId, chunkIndex }) =>
        `${chunkDocumentId}-chunk-${chunkIndex}`,
      generateEventId: createEventIds(["event-fail-start", "event-fail-complete"]),
      chunkerOptions: { maxCharactersPerChunk: 80 }
    })
  };
}

function defaultContentReader() {
  return {
    async readText() {
      return "Escalate incidents through support leadership. Record impact notes.";
    }
  };
}

function defaultEmbeddingAdapter() {
  return {
    async generateEmbedding(input) {
      return {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        chunkId: input.chunkId,
        chunkIndex: input.chunkIndex,
        embedding: deterministicEmbedding(input.chunkText, input.chunkIndex)
      };
    }
  };
}

function defaultVectorIndexAdapter() {
  return {
    async upsertChunkEmbedding(input) {
      return {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        chunkId: input.chunkId,
        chunkIndex: input.chunkIndex,
        vectorRef: `local-vector-${input.chunkId}`
      };
    }
  };
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
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
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
    queuedAt: "2026-06-28T00:01:00.000Z",
    requestedByUserId: "user-a",
    createdAt: "2026-06-28T00:01:00.000Z",
    updatedAt: "2026-06-28T00:01:00.000Z",
    ...overrides
  };
}

function deterministicEmbedding(text, chunkIndex) {
  const checksum = [...text].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  return [chunkIndex, text.length / 100, checksum / 1000];
}

function createClock(timestamps) {
  const values = [...timestamps];
  return () => values.shift() ?? timestamps[timestamps.length - 1];
}

function createEventIds(ids) {
  const values = [...ids];
  return () => values.shift() ?? ids[ids.length - 1];
}

function assertWorkerBoundarySafety() {
  for (const file of collectFiles(workerRoot).filter((path) => path.endsWith(".ts"))) {
    const source = readFileSync(file, "utf8");

    for (const fragment of forbiddenImportFragments) {
      assert.equal(
        source.includes(fragment),
        false,
        `${file} must not import frontend, HTTP router, Prisma client, or private modules`
      );
    }

    for (const fragment of forbiddenRuntimeFragments) {
      assert.equal(
        source.toLowerCase().includes(fragment.toLowerCase()),
        false,
        `${file} must not call real embedding providers, vector DB clients, or HTTP routes`
      );
    }
  }
}

function assertPackageAndSchemaSafety() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const declaredPackages = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {})
  ]);
  for (const packageName of forbiddenPackageNames) {
    assert.equal(
      declaredPackages.has(packageName),
      false,
      `${packageName} must not be added for the local flow slice`
    );
  }

  assert.doesNotMatch(
    readFileSync(prismaSchemaPath, "utf8"),
    /embeddingVector|rawVector|vectorConfig|providerPayload|credential|secret|refreshToken/i,
    "Prisma schema must not store raw embeddings, vector config, provider payloads, or credentials"
  );
}

function assertSafeResult(result) {
  const serialized = JSON.stringify({
    phase: result.phase,
    document: {
      documentId: result.document.documentId,
      workspaceId: result.document.workspaceId,
      status: result.document.status,
      ingestionStatus: result.document.ingestionStatus,
      indexingStatus: result.document.indexingStatus,
      chunkCount: result.document.chunkCount,
      indexedChunkCount: result.document.indexedChunkCount
    },
    job: {
      jobId: result.job.jobId,
      status: result.job.status,
      errorCode: result.job.errorCode,
      errorMessage: result.job.errorMessage
    },
    failure: result.failure
  });

  for (const fragment of unsafeLeakFragments) {
    assert.equal(
      serialized.toLowerCase().includes(fragment.toLowerCase()),
      false,
      `local flow result must not leak ${fragment}`
    );
  }
}

function collectFiles(rootPath) {
  const entries = readdirSync(rootPath);
  const files = [];

  for (const entry of entries) {
    const path = join(rootPath, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}
