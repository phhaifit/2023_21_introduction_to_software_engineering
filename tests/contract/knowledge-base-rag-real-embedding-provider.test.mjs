import assert from "node:assert/strict";

import { InMemoryKnowledgeDocumentRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import {
  KnowledgeEmbeddingProviderError,
  OpenAICompatibleKnowledgeEmbeddingAdapter,
  readKnowledgeEmbeddingConfig
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/openai-compatible-knowledge-embedding-adapter.ts";
import { KnowledgeDocumentIndexingPipeline } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-indexing-pipeline.ts";

const secret = "test-secret-api-key";
const baseConfig = {
  provider: "openai-compatible",
  baseUrl: "https://embedding.example.test/v1",
  apiKey: secret,
  model: "configurable-embedding-model",
  dimensions: 3,
  batchSize: 2,
  timeoutMs: 1000
};

testConfigurationValidation();
await testBatchingAndOrder();
await testProviderFailures();
await testResponseValidation();
await testEmptyInputs();
await testIndexingPipelineIntegration();

console.log("knowledge-base-rag real embedding provider checks passed");

function testConfigurationValidation() {
  const valid = readKnowledgeEmbeddingConfig({
    KNOWLEDGE_EMBEDDING_PROVIDER: "openai-compatible",
    KNOWLEDGE_EMBEDDING_BASE_URL: "https://embedding.example.test/v1",
    KNOWLEDGE_EMBEDDING_API_KEY: secret,
    KNOWLEDGE_EMBEDDING_MODEL: "model-a",
    KNOWLEDGE_EMBEDDING_DIMENSIONS: "3",
    KNOWLEDGE_EMBEDDING_BATCH_SIZE: "2"
  });
  assert.equal(valid.model, "model-a");
  assert.equal(valid.timeoutMs, 30000);

  for (const environment of [
    {},
    {
      KNOWLEDGE_EMBEDDING_PROVIDER: "openai-compatible",
      KNOWLEDGE_EMBEDDING_BASE_URL: "not-a-url",
      KNOWLEDGE_EMBEDDING_API_KEY: secret,
      KNOWLEDGE_EMBEDDING_MODEL: "model-a",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "3"
    },
    {
      KNOWLEDGE_EMBEDDING_PROVIDER: "openai-compatible",
      KNOWLEDGE_EMBEDDING_BASE_URL: "https://embedding.example.test/v1",
      KNOWLEDGE_EMBEDDING_API_KEY: secret,
      KNOWLEDGE_EMBEDDING_MODEL: "model-a",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "0"
    },
    {
      KNOWLEDGE_EMBEDDING_PROVIDER: "openai-compatible",
      KNOWLEDGE_EMBEDDING_BASE_URL: "https://embedding.example.test/v1",
      KNOWLEDGE_EMBEDDING_API_KEY: "",
      KNOWLEDGE_EMBEDDING_MODEL: "model-a",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "3"
    }
  ]) {
    assert.throws(
      () => readKnowledgeEmbeddingConfig(environment),
      (error) =>
        error instanceof KnowledgeEmbeddingProviderError &&
        error.errorCode === "knowledge.embedding_config_invalid" &&
        !error.message.includes(secret)
    );
  }
}

async function testBatchingAndOrder() {
  const requests = [];
  const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    baseConfig,
    async (url, init) => {
      requests.push({ url: String(url), init });
      const body = JSON.parse(init.body);
      const data = body.input.map((text, index) => ({
        index,
        embedding: [text.length, requests.length, index]
      }));
      return jsonResponse({ data: data.reverse() });
    }
  );
  const inputs = ["one", "second", "third"].map((text, index) =>
    createInput(text, index)
  );

  const results = await adapter.generateEmbeddings(inputs);

  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((request) => JSON.parse(request.init.body).input),
    [["one", "second"], ["third"]]
  );
  assert.equal(requests[0].url, "https://embedding.example.test/v1/embeddings");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, `Bearer ${secret}`);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    model: baseConfig.model,
    input: ["one", "second"],
    dimensions: 3
  });
  assert.deepEqual(
    results.map((result) => [result.chunkId, result.embedding]),
    [
      ["chunk-0", [3, 1, 0]],
      ["chunk-1", [6, 1, 1]],
      ["chunk-2", [5, 2, 0]]
    ]
  );
}

async function testProviderFailures() {
  const httpAdapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    baseConfig,
    async () =>
      new Response(`raw provider payload ${secret}`, {
        status: 429,
        headers: { "content-type": "text/plain" }
      })
  );
  await assertSafeRejection(
    () => httpAdapter.generateEmbedding(createInput("text", 0)),
    "knowledge.embedding_provider_failed"
  );

  const networkAdapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    baseConfig,
    async () => {
      throw new Error(`Authorization: Bearer ${secret}`);
    }
  );
  await assertSafeRejection(
    () => networkAdapter.generateEmbedding(createInput("text", 0)),
    "knowledge.embedding_provider_unavailable"
  );

  const timeoutAdapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    { ...baseConfig, timeoutMs: 1 },
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
  );
  await assertSafeRejection(
    () => timeoutAdapter.generateEmbedding(createInput("text", 0)),
    "knowledge.embedding_provider_unavailable"
  );

  let batchCall = 0;
  const partialFailureAdapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    { ...baseConfig, batchSize: 1 },
    async () => {
      batchCall += 1;
      return batchCall === 1
        ? jsonResponse({ data: [{ index: 0, embedding: [1, 2, 3] }] })
        : new Response("raw failure", { status: 500 });
    }
  );
  await assertSafeRejection(
    () =>
      partialFailureAdapter.generateEmbeddings([
        createInput("first", 0),
        createInput("second", 1)
      ]),
    "knowledge.embedding_provider_failed"
  );
}

async function testResponseValidation() {
  const cases = [
    [{ invalid: true }, "knowledge.embedding_response_invalid"],
    [{ data: [] }, "knowledge.embedding_count_mismatch"],
    [
      { data: [{ index: 0, embedding: [1, 2] }] },
      "knowledge.embedding_dimension_mismatch"
    ],
    [
      { data: [{ index: 0, embedding: [1, "bad", 3] }] },
      "knowledge.embedding_response_invalid"
    ],
    [
      { data: [{ index: 1, embedding: [1, 2, 3] }] },
      "knowledge.embedding_response_invalid"
    ]
  ];

  for (const [payload, errorCode] of cases) {
    const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
      baseConfig,
      async () => jsonResponse(payload)
    );
    await assertSafeRejection(
      () => adapter.generateEmbedding(createInput("text", 0)),
      errorCode
    );
  }
}

async function testEmptyInputs() {
  let fetchCalls = 0;
  const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    baseConfig,
    async () => {
      fetchCalls += 1;
      return jsonResponse({ data: [] });
    }
  );
  assert.deepEqual(await adapter.generateEmbeddings([]), []);
  await assertSafeRejection(
    () => adapter.generateEmbedding(createInput("   ", 0)),
    "knowledge.embedding_input_invalid"
  );
  assert.equal(fetchCalls, 0);
}

async function testIndexingPipelineIntegration() {
  const repository = new InMemoryKnowledgeDocumentRepository();
  await repository.saveDocument(createDocument());
  await repository.saveDocumentChunk(createChunk(0, "First persisted chunk."));
  await repository.saveDocumentChunk(createChunk(1, "Second persisted chunk."));

  const providerRequests = [];
  const vectorCalls = [];
  const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    baseConfig,
    async (_url, init) => {
      const body = JSON.parse(init.body);
      providerRequests.push(body);
      return jsonResponse({
        data: body.input.map((_text, index) => ({
          index,
          embedding: [index, index + 1, index + 2]
        }))
      });
    }
  );
  const pipeline = new KnowledgeDocumentIndexingPipeline({
    documentRepository: repository,
    embeddingAdapter: adapter,
    vectorIndexAdapter: {
      async upsertChunkEmbedding(input) {
        vectorCalls.push(input);
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef: `test-vector-${input.chunkId}`
        };
      }
    },
    now: createClock()
  });

  const result = await pipeline.processDocument({
    workspaceId: "workspace-a",
    documentId: "document-a"
  });

  assert.equal(result.failure, undefined);
  assert.equal(result.document.indexingStatus, "ready");
  assert.equal(result.document.indexedChunkCount, 2);
  assert.equal(providerRequests.length, 1);
  assert.deepEqual(providerRequests[0].input, [
    "First persisted chunk.",
    "Second persisted chunk."
  ]);
  assert.deepEqual(
    vectorCalls.map((call) => [call.chunkId, call.embedding]),
    [
      ["chunk-0", [0, 1, 2]],
      ["chunk-1", [1, 2, 3]]
    ]
  );
  const savedChunks = await repository.listDocumentChunks(
    "workspace-a",
    "document-a"
  );
  assert.deepEqual(
    savedChunks.items.map((chunk) => [chunk.embeddingStatus, chunk.vectorRef]),
    [
      ["ready", "test-vector-chunk-0"],
      ["ready", "test-vector-chunk-1"]
    ]
  );
}

async function assertSafeRejection(operation, errorCode) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof KnowledgeEmbeddingProviderError);
    assert.equal(error.errorCode, errorCode);
    const serialized = JSON.stringify({
      name: error.name,
      errorCode: error.errorCode,
      message: error.message
    });
    assert.equal(serialized.includes(secret), false);
    assert.equal(/raw provider|authorization|bearer/i.test(serialized), false);
    assert.equal("cause" in error, false);
    return true;
  });
}

function createInput(chunkText, chunkIndex) {
  return {
    workspaceId: "workspace-a",
    documentId: "document-a",
    chunkId: `chunk-${chunkIndex}`,
    chunkIndex,
    chunkText,
    metadata: { sourceLocator: `text:${chunkIndex}` }
  };
}

function createDocument() {
  return {
    documentId: "document-a",
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
    displayName: "Document",
    fileName: "document.txt",
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: 100,
    sourceType: "upload",
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "pending",
    chunkCount: 2,
    indexedChunkCount: 0,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  };
}

function createChunk(chunkIndex, contentText) {
  return {
    chunkId: `chunk-${chunkIndex}`,
    workspaceId: "workspace-a",
    documentId: "document-a",
    chunkIndex,
    contentText,
    embeddingStatus: "pending",
    sourceLocator: `text:${chunkIndex}`,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  };
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function createClock() {
  let tick = 0;
  return () => `2026-07-02T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}
