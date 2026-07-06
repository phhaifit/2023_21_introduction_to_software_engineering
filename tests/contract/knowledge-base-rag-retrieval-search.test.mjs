import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";

import { createKnowledgeBaseRagRouter } from "@vcp/backend/modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import {
  DEFAULT_RETRIEVAL_TOP_K,
  KnowledgeRetrievalSearchUseCase,
  MAX_EVIDENCE_SNIPPET_LENGTH,
  MAX_RETRIEVAL_QUERY_LENGTH
} from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeRetrievalError
} from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-errors.ts";
import { InMemoryKnowledgeDocumentRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

const repository = new InMemoryKnowledgeDocumentRepository();
await seedKnowledge(repository);

const embeddingCalls = [];
const vectorCalls = [];
let vectorMatches = createVectorMatches();
const useCase = new KnowledgeRetrievalSearchUseCase({
  documentRepository: repository,
  queryEmbeddingAdapter: {
    async generateQueryEmbedding(input) {
      embeddingCalls.push(input);
      return {
        workspaceId: input.workspaceId,
        embedding: [0.1, 0.2, 0.3]
      };
    }
  },
  vectorQueryAdapter: {
    async query(input) {
      vectorCalls.push(input);
      return vectorMatches;
    }
  }
});

await testSuccessfulRetrieval();
await testEmptyRetrieval();
await testValidation();
await testSafeFailures();
await testHttpRoute();

console.log("knowledge-base-rag retrieval/search checks passed");

async function testSuccessfulRetrieval() {
  vectorMatches = createVectorMatches();
  const response = await useCase.search("workspace-a", {
    query: "  escalation policy  ",
    topK: 3,
    filters: {
      documentIds: ["document-a"],
      sourceTypes: ["upload"],
      sourceLocators: ["text:0"],
      statuses: ["ready"]
    }
  });

  assert.deepEqual(embeddingCalls.at(-1), {
    workspaceId: "workspace-a",
    query: "escalation policy"
  });
  assert.deepEqual(vectorCalls.at(-1), {
    workspaceId: "workspace-a",
    embedding: [0.1, 0.2, 0.3],
    topK: 3,
    documentIds: ["document-a"],
    sourceLocators: ["text:0"],
    sourceTypes: ["upload"],
    statuses: ["ready"]
  });
  assert.equal(response.total, 1);
  assert.equal(response.results[0].rank, 1);
  assert.equal(response.results[0].score, 0.92);
  assert.equal(response.results[0].documentId, "document-a");
  assert.equal(response.results[0].chunkId, "chunk-a");
  assert.equal(response.results[0].documentTitle, "Escalation Policy.txt");
  assert.equal(response.results[0].source.type, "upload");
  assert.equal(response.results[0].source.locator, "text:0");
  assert.equal(response.results[0].metadata.chunkIndex, 0);
  assert.ok(response.results[0].snippet.length <= MAX_EVIDENCE_SNIPPET_LENGTH);
  assertSafePublicValue(response);

  const defaultResponse = await useCase.search("workspace-a", {
    query: "policy"
  });
  assert.equal(vectorCalls.at(-1).topK, DEFAULT_RETRIEVAL_TOP_K);
  assert.ok(defaultResponse.results.every((item) => item.rank >= 1));
}

async function testEmptyRetrieval() {
  vectorMatches = [];
  const response = await useCase.search("workspace-a", { query: "no match" });
  assert.deepEqual(response, { results: [], total: 0 });
}

async function testValidation() {
  for (const request of [
    { query: "" },
    { query: " ".repeat(3) },
    { query: "x".repeat(MAX_RETRIEVAL_QUERY_LENGTH + 1) },
    { query: "valid", topK: 0 },
    { query: "valid", topK: 21 },
    { query: "valid", topK: 1.5 },
    { query: "valid", filters: { sourceTypes: ["unsupported"] } },
    { query: "valid", filters: { statuses: ["failed"] } },
    { query: "valid", filters: { sourceLocators: ["/private/path"] } }
  ]) {
    await assert.rejects(
      () => useCase.search("workspace-a", request),
      KnowledgeBaseRagValidationError
    );
  }
}

async function testSafeFailures() {
  const embeddingFailure = new KnowledgeRetrievalSearchUseCase({
    documentRepository: repository,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding() {
        throw new Error("providerPayload secret token rawEmbedding");
      }
    },
    vectorQueryAdapter: {
      async query() {
        throw new Error("must not run");
      }
    }
  });
  await assertSafeUseCaseFailure(
    () => embeddingFailure.search("workspace-a", { query: "policy" }),
    "knowledge.retrieval_embedding_failed"
  );

  const vectorFailure = new KnowledgeRetrievalSearchUseCase({
    documentRepository: repository,
    queryEmbeddingAdapter: createQueryEmbeddingAdapter(),
    vectorQueryAdapter: {
      async query() {
        throw new Error("pgvector SQL DATABASE_URL rawVector vectorRef");
      }
    }
  });
  await assertSafeUseCaseFailure(
    () => vectorFailure.search("workspace-a", { query: "policy" }),
    "knowledge.retrieval_vector_failed"
  );

  const hydrationFailure = new KnowledgeRetrievalSearchUseCase({
    documentRepository: {
      ...repository,
      async getDocumentById() {
        throw new Error("storageKey /private/path stackTrace");
      }
    },
    queryEmbeddingAdapter: createQueryEmbeddingAdapter(),
    vectorQueryAdapter: {
      async query() {
        return [createVectorMatches()[0]];
      }
    }
  });
  await assertSafeUseCaseFailure(
    () => hydrationFailure.search("workspace-a", { query: "policy" }),
    "knowledge.retrieval_hydration_failed"
  );
}

async function testHttpRoute() {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    const authenticated = request.header("x-test-auth") !== "false";
    request.context = authenticated
      ? {
          requestId: "retrieval-request",
          user: { userId: "user-a", email: "user@example.com" },
          workspace: {
            workspaceId: "workspace-a",
            memberId: "member-a",
            role: "viewer"
          }
        }
      : { requestId: "retrieval-request" };
    next();
  });
  app.use(
    createKnowledgeBaseRagRouter({
      documentUseCases: {},
      uploadUseCases: {},
      ingestionUseCases: {},
      dataSourceUseCases: {},
      syncUseCases: {},
      retrievalSearchUseCase: useCase
    })
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    vectorMatches = [createVectorMatches()[0]];
    const success = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/knowledge/retrieval/search",
      { query: "policy", topK: 2 }
    );
    assert.equal(success.status, 200);
    assert.equal(success.body.ok, true);
    assert.equal(success.body.data.total, 1);
    assertSafePublicValue(success.body.data);

    const invalid = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/knowledge/retrieval/search",
      { query: "", unexpected: true }
    );
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "validation.invalid_input");

    const unauthenticated = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/knowledge/retrieval/search",
      { query: "policy" },
      { "x-test-auth": "false" }
    );
    assert.equal(unauthenticated.status, 401);

    const crossWorkspace = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-b/knowledge/retrieval/search",
      { query: "policy" }
    );
    assert.equal(crossWorkspace.status, 403);
    assert.equal(crossWorkspace.body.error.code, "auth.forbidden");
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function seedKnowledge(target) {
  await target.saveDocument(createDocument());
  await target.saveDocument({
    ...createDocument(),
    documentId: "document-b",
    workspaceId: "workspace-b",
    displayName: "Private Other Workspace.txt"
  });
  await target.saveDocument({
    ...createDocument(),
    documentId: "document-pending",
    displayName: "Pending.txt",
    indexingStatus: "pending"
  });
  await target.saveDocumentChunk({
    chunkId: "chunk-a",
    workspaceId: "workspace-a",
    documentId: "document-a",
    chunkIndex: 0,
    contentText: `${"Escalation guidance ".repeat(40)}contact the support lead.`,
    embeddingStatus: "ready",
    sourceLocator: "text:0",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  });
  await target.saveDocumentChunk({
    chunkId: "chunk-b",
    workspaceId: "workspace-b",
    documentId: "document-b",
    chunkIndex: 0,
    contentText: "Other workspace private evidence.",
    embeddingStatus: "ready",
    sourceLocator: "text:0",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  });
  await target.saveDocumentChunk({
    chunkId: "chunk-pending",
    workspaceId: "workspace-a",
    documentId: "document-pending",
    chunkIndex: 0,
    contentText: "Pending evidence must not be returned.",
    embeddingStatus: "pending",
    sourceLocator: "text:1",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  });
}

function createVectorMatches() {
  return [
    {
      workspaceId: "workspace-a",
      documentId: "document-a",
      chunkId: "chunk-a",
      chunkIndex: 0,
      score: 0.92,
      metadata: { sourceLocator: "text:0" }
    },
    {
      workspaceId: "workspace-b",
      documentId: "document-b",
      chunkId: "chunk-b",
      chunkIndex: 0,
      score: 0.99,
      metadata: { sourceLocator: "text:0" }
    },
    {
      workspaceId: "workspace-a",
      documentId: "document-pending",
      chunkId: "chunk-pending",
      chunkIndex: 0,
      score: 0.95,
      metadata: { sourceLocator: "text:1" }
    }
  ];
}

function createDocument() {
  return {
    documentId: "document-a",
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
    displayName: "Escalation Policy.txt",
    fileName: "escalation-policy.txt",
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: 500,
    sourceType: "upload",
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  };
}

function createQueryEmbeddingAdapter() {
  return {
    async generateQueryEmbedding(input) {
      return { workspaceId: input.workspaceId, embedding: [0.1, 0.2, 0.3] };
    }
  };
}

async function assertSafeUseCaseFailure(operation, errorCode) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof KnowledgeRetrievalError);
    assert.equal(error.errorCode, errorCode);
    assert.doesNotMatch(
      JSON.stringify(error),
      /providerPayload|secret|token|rawEmbedding|rawVector|vectorRef|storageKey|private\/path|stackTrace|DATABASE_URL/i
    );
    return true;
  });
}

function assertSafePublicValue(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /rawEmbedding|rawVector|vectorRef|storageKey|privateUrl|providerPayload|secret-token|queuePayload|stackTrace/i
  );
}

async function requestJson(baseUrl, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}
