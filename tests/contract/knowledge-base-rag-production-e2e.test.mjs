import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KnowledgeIngestionUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-ingestion-use-cases.ts";
import { KnowledgeRagAnswerUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-rag-answer-use-case.ts";
import { KnowledgeRetrievalSearchUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import { KnowledgeUploadUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import {
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { RuntimeKnowledgeDocumentTextExtractor } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/knowledge-document-text-extractor.ts";
import { createKnowledgeIngestionWorkerRuntime } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/knowledge-ingestion-worker-runtime.ts";
import { LocalKnowledgeFileStorage } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";
import { KnowledgeDocumentIndexingPipeline } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-indexing-pipeline.ts";

const workspaceId = "workspace-production-e2e";
const actorId = "user-production-e2e";
const documentId = "document-production-e2e";
const jobId = "job-production-e2e";
const storageRoot = await mkdtemp(join(tmpdir(), "kb-rag-production-e2e-"));

try {
  await verifyUploadToGroundedAnswer();
  console.log("knowledge-base-rag production end-to-end checks passed");
} finally {
  await rm(storageRoot, { recursive: true, force: true });
}

async function verifyUploadToGroundedAnswer() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const fileStorage = new LocalKnowledgeFileStorage(storageRoot);
  const clock = createClock();
  const uploadUseCases = new KnowledgeUploadUseCases({
    documentRepository,
    ingestionJobRepository,
    fileStorage,
    now: clock,
    generateDocumentId: () => documentId,
    generateJobId: () => jobId
  });

  const upload = await uploadUseCases.uploadDocuments(workspaceId, actorId, [
    {
      clientFileId: "file-production-e2e",
      fileName: "Escalation Policy.txt",
      mediaType: "text/plain",
      content: new TextEncoder().encode(
        [
          "Customer-impacting incidents must be reported to the support lead.",
          "",
          "Record the incident timeline before escalating to engineering."
        ].join("\r\n")
      )
    }
  ]);

  assert.equal(upload.documents.length, 1);
  assert.equal(upload.documents[0].documentId, documentId);
  assert.equal(upload.documents[0].status, "pending");
  assert.equal(upload.ingestionJobs[0].jobId, jobId);
  assert.equal(upload.ingestionJobs[0].status, "pending");
  assertSafePublicValue(upload);

  let eventSequence = 0;
  const worker = createKnowledgeIngestionWorkerRuntime({
    documentRepository,
    ingestionJobRepository,
    fileStorage,
    textExtractor: new RuntimeKnowledgeDocumentTextExtractor(),
    now: clock,
    generateEventId: () => `event-production-${eventSequence++}`,
    generateChunkId: ({ chunkIndex }) => `${documentId}-chunk-${chunkIndex}`,
    chunkerOptions: { maxCharactersPerChunk: 90 }
  });
  const ingestion = await worker.processNextQueuedJob(workspaceId);
  const chunksAfterIngestion = await documentRepository.listDocumentChunks(
    workspaceId,
    documentId
  );

  assert.ok(ingestion);
  assert.equal(ingestion.job.status, "ready");
  assert.equal(ingestion.document.ingestionStatus, "ready");
  assert.equal(ingestion.document.indexingStatus, "pending");
  assert.equal(chunksAfterIngestion.total, 2);
  assert.ok(
    chunksAfterIngestion.items.some((chunk) =>
      chunk.contentText.includes("support lead")
    )
  );

  const vectorRecords = new Map();
  const embeddingAdapter = createDeterministicEmbeddingAdapter();
  const vectorAdapter = createInMemoryVectorAdapter(vectorRecords);
  const indexing = await new KnowledgeDocumentIndexingPipeline({
    documentRepository,
    embeddingAdapter,
    vectorIndexAdapter: vectorAdapter,
    now: clock
  }).processDocument({ workspaceId, documentId });

  assert.equal(indexing.failure, undefined);
  assert.equal(indexing.document.indexingStatus, "ready");
  assert.equal(indexing.indexedChunkCount, chunksAfterIngestion.total);
  assert.equal(vectorRecords.size, chunksAfterIngestion.total);

  const retrieval = new KnowledgeRetrievalSearchUseCase({
    documentRepository,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        return {
          workspaceId: input.workspaceId,
          embedding: deterministicEmbedding(input.query)
        };
      }
    },
    vectorQueryAdapter: vectorAdapter
  });
  const evidence = await retrieval.search(workspaceId, {
    query: "Who receives customer incident escalations?",
    topK: 3,
    filters: { documentIds: [documentId], statuses: ["ready"] }
  });

  assert.ok(evidence.total >= 1);
  assert.equal(evidence.results[0].documentId, documentId);
  assert.match(evidence.results[0].snippet, /support lead/i);
  assertSafePublicValue(evidence);

  const answerCalls = [];
  const rag = new KnowledgeRagAnswerUseCase({
    retrievalSearchUseCase: retrieval,
    answerProvider: {
      async generateAnswer(input) {
        answerCalls.push(input);
        assert.match(input.evidence[0].snippet, /support lead/i);
        return {
          answer: "Customer-impacting incidents go to the support lead. [E1]",
          citationIds: ["E1"]
        };
      }
    },
    generateAnswerId: () => "answer-production-e2e"
  });
  const answer = await rag.answer(workspaceId, {
    query: "Who receives customer incident escalations?",
    topK: 3,
    filters: { documentIds: [documentId], statuses: ["ready"] }
  });

  assert.equal(answer.status, "answered");
  assert.equal(answerCalls.length, 1);
  assert.equal(answer.citations.length, 1);
  assert.equal(answer.citations[0].documentId, documentId);
  assert.equal(answer.citations[0].evidenceId, answer.evidence[0].evidenceId);
  assertSafePublicValue(answer);

  const status = await new KnowledgeIngestionUseCases({
    ingestionJobRepository
  }).listIngestionJobs(workspaceId);
  assert.equal(status.total, 1);
  assert.equal(status.items[0].status, "ready");
  assert.equal(status.items[0].progressPercent, 100);
  assertSafePublicValue(status);
}

function createDeterministicEmbeddingAdapter() {
  return {
    async generateEmbedding(input) {
      return {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        chunkId: input.chunkId,
        chunkIndex: input.chunkIndex,
        embedding: deterministicEmbedding(input.chunkText)
      };
    }
  };
}

function createInMemoryVectorAdapter(records) {
  return {
    async upsertChunkEmbedding(input) {
      records.set(input.chunkId, {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        chunkId: input.chunkId,
        chunkIndex: input.chunkIndex,
        embedding: [...input.embedding],
        sourceLocator: input.metadata.sourceLocator
      });
      return {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        chunkId: input.chunkId,
        chunkIndex: input.chunkIndex,
        vectorRef: `internal:${input.workspaceId}:${input.chunkId}`
      };
    },
    async query(input) {
      return [...records.values()]
        .filter((record) => record.workspaceId === input.workspaceId)
        .filter(
          (record) =>
            !input.documentIds || input.documentIds.includes(record.documentId)
        )
        .map((record) => ({
          workspaceId: record.workspaceId,
          documentId: record.documentId,
          chunkId: record.chunkId,
          chunkIndex: record.chunkIndex,
          score: record.chunkIndex === 0 ? 0.96 : 0.85,
          metadata: { sourceLocator: record.sourceLocator }
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, input.topK);
    }
  };
}

function deterministicEmbedding(text) {
  const normalized = text.toLowerCase();
  return [
    normalized.length / 1_000,
    normalized.includes("incident") ? 1 : 0,
    normalized.includes("support lead") ? 1 : 0
  ];
}

function createClock() {
  let sequence = 0;
  return () =>
    `2026-07-04T00:${String(sequence++).padStart(2, "0")}:00.000Z`;
}

function assertSafePublicValue(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|queuePayload|workerPayload|runtimeInternals|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|apiKey|Bearer|credential|secret|stackTrace/i
  );
}
