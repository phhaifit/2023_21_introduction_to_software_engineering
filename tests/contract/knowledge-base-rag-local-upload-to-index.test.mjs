import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KnowledgeRetrievalSearchUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import { KnowledgeUploadUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import {
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { RuntimeKnowledgeDocumentTextExtractor } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/knowledge-document-text-extractor.ts";
import { LocalKnowledgeFileStorage } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";
import { StoredKnowledgeDocumentContentReader } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/stored-knowledge-document-content-reader.ts";
import { createKnowledgeBaseRagLocalFlowRunner } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-base-rag-local-flow-runner.ts";

const storageRoot = await mkdtemp(join(tmpdir(), "kb-rag-inline-upload-"));

try {
  await verifySuccessfulInlineUpload();
  await verifyCsvAndMarkdownInlineUploads();
  await verifyUnsupportedUploadRejected();
  await verifySafeFailure("parser");
  await verifySafeFailure("embedding");
  await verifySafeFailure("vector");
  console.log("knowledge-base-rag local upload-to-index checks passed");
} finally {
  await rm(storageRoot, { recursive: true, force: true });
}

async function verifySuccessfulInlineUpload() {
  const runtime = createRuntime("success");
  const upload = await runtime.uploadUseCases.uploadDocuments(
    "workspace-a",
    "user-a",
    [
      {
        clientFileId: "policy-file",
        fileName: "sample-company-policy.txt",
        mediaType: "text/plain",
        content: new TextEncoder().encode(
          "Equipment requests are reviewed within three business days. Rejected requests should be sent to Operations."
        )
      }
    ]
  );

  assert.equal(upload.documents[0].status, "ready");
  assert.equal(upload.ingestionJobs[0].status, "ready");
  const persistedDocument = await runtime.documentRepository.getDocumentById(
    "workspace-a",
    "document-success"
  );
  assert.equal(persistedDocument.ingestionStatus, "ready");
  assert.equal(persistedDocument.indexingStatus, "ready");
  const chunks = await runtime.documentRepository.listDocumentChunks(
    "workspace-a",
    "document-success"
  );
  assert.ok(chunks.total >= 1);
  assert.ok(chunks.items.every((chunk) => chunk.embeddingStatus === "ready"));
  assert.equal(runtime.embeddingCalls.length, chunks.total);
  assert.equal(runtime.vectorCalls.length, chunks.total);
  assertSafe(upload);

  const retrieval = new KnowledgeRetrievalSearchUseCase({
    documentRepository: runtime.documentRepository,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        return { workspaceId: input.workspaceId, embedding: [1, 0] };
      }
    },
    vectorQueryAdapter: {
      async query(input) {
        return runtime.vectorCalls
          .filter((item) => item.workspaceId === input.workspaceId)
          .map((item, index) => ({
            workspaceId: item.workspaceId,
            documentId: item.documentId,
            chunkId: item.chunkId,
            chunkIndex: item.chunkIndex,
            score: 0.9 - index * 0.01,
            metadata: item.metadata
          }));
      }
    }
  });
  const evidence = await retrieval.search("workspace-a", {
    query: "How long does equipment approval take?",
    topK: 3,
    filters: { documentIds: ["document-success"], statuses: ["ready"] }
  });
  assert.ok(evidence.total >= 1);
  assert.equal(evidence.results[0].documentId, "document-success");
  assert.match(evidence.results[0].snippet, /three business days/i);
  assertSafe(evidence);

  await assert.rejects(
    runtime.runner.run({
      workspaceId: "workspace-a",
      jobId: "job-success"
    }),
    /not queued/i
  );
  await assert.rejects(
    runtime.runner.run({
      workspaceId: "workspace-b",
      jobId: "job-success"
    })
  );
  assert.equal(runtime.embeddingCalls.length, chunks.total);
  assert.equal(runtime.vectorCalls.length, chunks.total);
}

async function verifyCsvAndMarkdownInlineUploads() {
  for (const candidate of [
    {
      mode: "csv",
      fileName: "equipment.csv",
      mediaType: "application/csv",
      content: "name,status\nLaptop,approved",
      expectedMediaType: "text/csv",
      expectedText: /Laptop,approved/
    },
    {
      mode: "markdown",
      fileName: "handbook.md",
      mediaType: "application/octet-stream",
      content: "# Handbook\n\nUse approved equipment.",
      expectedMediaType: "text/markdown",
      expectedText: /approved equipment/
    }
  ]) {
    const runtime = createRuntime(candidate.mode);
    const upload = await runtime.uploadUseCases.uploadDocuments(
      "workspace-a",
      "user-a",
      [
        {
          clientFileId: `${candidate.mode}-file`,
          fileName: candidate.fileName,
          mediaType: candidate.mediaType,
          content: new TextEncoder().encode(candidate.content)
        }
      ]
    );

    assert.equal(
      upload.documents[0].status,
      "ready",
      JSON.stringify({
        document: upload.documents[0],
        ingestionJob: upload.ingestionJobs[0]
      })
    );
    assert.equal(upload.documents[0].mediaType, candidate.expectedMediaType);
    const chunks = await runtime.documentRepository.listDocumentChunks(
      "workspace-a",
      `document-${candidate.mode}`
    );
    assert.ok(chunks.total >= 1);
    assert.match(chunks.items[0].contentText, candidate.expectedText);
    assert.ok(chunks.items.every((chunk) => chunk.embeddingStatus === "ready"));
    assert.equal(runtime.vectorCalls.length, chunks.total);
    assertSafe(upload);
  }
}

async function verifyUnsupportedUploadRejected() {
  const runtime = createRuntime("unsupported");
  await assert.rejects(
    runtime.uploadUseCases.uploadDocuments("workspace-a", "user-a", [
      {
        clientFileId: "unsupported",
        fileName: "payload.exe",
        mediaType: "application/x-msdownload",
        content: new Uint8Array([1, 2, 3])
      }
    ]),
    /unsupported_media_type/
  );
  assert.equal(runtime.embeddingCalls.length, 0);
  assert.equal(runtime.vectorCalls.length, 0);
}

async function verifySafeFailure(mode) {
  const runtime = createRuntime(mode);
  const content =
    mode === "parser"
      ? new TextEncoder().encode("   \n\t ")
      : new TextEncoder().encode("A valid policy sentence for indexing.");
  const upload = await runtime.uploadUseCases.uploadDocuments(
    "workspace-a",
    "user-a",
    [
      {
        clientFileId: `file-${mode}`,
        fileName: `${mode}.txt`,
        mediaType: "text/plain",
        content
      }
    ]
  );

  assert.equal(upload.documents[0].status, "failed");
  assert.equal(upload.ingestionJobs[0].status, "failed");
  const persistedDocument = await runtime.documentRepository.getDocumentById(
    "workspace-a",
    `document-${mode}`
  );
  if (mode === "parser") {
    assert.equal(persistedDocument.ingestionStatus, "failed");
    assert.equal(runtime.embeddingCalls.length, 0);
    assert.equal(runtime.vectorCalls.length, 0);
  } else {
    assert.equal(persistedDocument.indexingStatus, "failed");
    if (mode === "embedding") {
      assert.equal(runtime.vectorCalls.length, 0);
    } else {
      assert.ok(runtime.vectorCalls.length >= 1);
    }
  }
  assertSafe(upload);
}

function createRuntime(mode) {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const fileStorage = new LocalKnowledgeFileStorage(join(storageRoot, mode));
  const embeddingCalls = [];
  const vectorCalls = [];
  let tick = 0;
  const now = () =>
    new Date(Date.UTC(2026, 6, 4, 0, 0, tick++)).toISOString();
  const runner = createKnowledgeBaseRagLocalFlowRunner({
    documentRepository,
    ingestionJobRepository,
    contentReader: new StoredKnowledgeDocumentContentReader(
      fileStorage,
      new RuntimeKnowledgeDocumentTextExtractor()
    ),
    embeddingAdapter: {
      async generateEmbedding(input) {
        embeddingCalls.push(input);
        if (mode === "embedding") {
          throw new Error("providerPayload rawEmbedding secret");
        }
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          embedding: [1, 0]
        };
      }
    },
    vectorIndexAdapter: {
      async upsertChunkEmbedding(input) {
        vectorCalls.push(input);
        if (mode === "vector") {
          throw new Error("rawVector vectorRef stackTrace");
        }
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef: `internal-vector-${input.chunkId}`
        };
      }
    },
    now,
    generateChunkId: ({ documentId, chunkIndex }) =>
      `${documentId}:chunk:${chunkIndex}`,
    generateEventId: () => `event-${mode}-${tick}`
  });
  const uploadUseCases = new KnowledgeUploadUseCases({
    documentRepository,
    ingestionJobRepository,
    fileStorage,
    now,
    generateDocumentId: () => `document-${mode}`,
    generateJobId: () => `job-${mode}`,
    postUploadProcessor: {
      async process(input) {
        const result = await runner.run(input);
        return { document: result.document, job: result.job };
      }
    }
  });
  return {
    documentRepository,
    ingestionJobRepository,
    embeddingCalls,
    vectorCalls,
    runner,
    uploadUseCases
  };
}

function assertSafe(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|queuePayload|workerPayload|runtimeInternals|stackTrace|apiKey|Bearer|credential|secret/i
  );
}
