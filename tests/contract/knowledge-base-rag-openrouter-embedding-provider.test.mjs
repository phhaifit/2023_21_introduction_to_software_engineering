import assert from "node:assert/strict";

import {
  KnowledgeEmbeddingProviderError,
  OpenAICompatibleKnowledgeEmbeddingAdapter,
  readKnowledgeEmbeddingConfig
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/openai-compatible-knowledge-embedding-adapter.ts";

const openRouterKey = "test-openrouter-key";
const defaultOpenRouterModel = "openai/text-embedding-3-small";
const defaultOpenRouterBaseUrl = "https://openrouter.ai/api/v1";

testOpenRouterConfigurationDefaults();
await testOpenRouterRequestAndOrdering();
await testOpenRouterDimensionMismatchIsSafe();
testMissingOpenRouterKeyIsSafe();
await testOpenRouterHttpFailureIsSafe();

console.log("knowledge-base-rag OpenRouter embedding provider checks passed");

function testOpenRouterConfigurationDefaults() {
  const config = readKnowledgeEmbeddingConfig({
    KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
    KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
    OPENROUTER_API_KEY: openRouterKey
  });

  assert.deepEqual(config, {
    provider: "openrouter",
    baseUrl: defaultOpenRouterBaseUrl,
    apiKey: openRouterKey,
    model: defaultOpenRouterModel,
    dimensions: 1536,
    batchSize: 32,
    timeoutMs: 30000
  });

  const override = readKnowledgeEmbeddingConfig({
    KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
    KNOWLEDGE_EMBEDDING_BASE_URL: "https://openrouter.local/api/v1",
    KNOWLEDGE_EMBEDDING_MODEL: "custom/provider-embedding",
    KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
    KNOWLEDGE_EMBEDDING_BATCH_SIZE: "8",
    KNOWLEDGE_EMBEDDING_TIMEOUT_MS: "1000",
    OPENROUTER_API_KEY: openRouterKey
  });
  assert.equal(override.baseUrl, "https://openrouter.local/api/v1");
  assert.equal(override.model, "custom/provider-embedding");
  assert.equal(override.batchSize, 8);
  assert.equal(override.timeoutMs, 1000);

  const fallbackKey = readKnowledgeEmbeddingConfig({
    KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
    KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
    KNOWLEDGE_EMBEDDING_API_KEY: "fallback-key"
  });
  assert.equal(fallbackKey.apiKey, "fallback-key");
}

async function testOpenRouterRequestAndOrdering() {
  const requests = [];
  const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    readKnowledgeEmbeddingConfig({
      KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
      KNOWLEDGE_EMBEDDING_BATCH_SIZE: "2",
      OPENROUTER_API_KEY: openRouterKey
    }),
    async (url, init) => {
      requests.push({ url: String(url), init });
      const body = JSON.parse(init.body);
      assert.deepEqual(body, {
        model: defaultOpenRouterModel,
        input: ["first chunk", "second chunk"]
      });
      return jsonResponse({
        data: [
          { index: 1, embedding: vector1536(0.2) },
          { index: 0, embedding: vector1536(0.1) }
        ],
        model: defaultOpenRouterModel,
        usage: { prompt_tokens: 12, total_tokens: 12 }
      });
    }
  );

  const results = await adapter.generateEmbeddings([
    createInput("first chunk", 0),
    createInput("second chunk", 1)
  ]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${defaultOpenRouterBaseUrl}/embeddings`);
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, `Bearer ${openRouterKey}`);
  assert.equal(requests[0].init.headers["content-type"], "application/json");
  assert.deepEqual(
    results.map((result) => [result.chunkId, result.embedding[0], result.embedding.length]),
    [
      ["chunk-0", 0.1, 1536],
      ["chunk-1", 0.2, 1536]
    ]
  );
}

async function testOpenRouterDimensionMismatchIsSafe() {
  const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    readKnowledgeEmbeddingConfig({
      KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
      OPENROUTER_API_KEY: openRouterKey
    }),
    async () =>
      jsonResponse({
        data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }]
      })
  );

  await assertSafeRejection(
    () => adapter.generateEmbedding(createInput("chunk", 0)),
    "knowledge.embedding_dimension_mismatch"
  );
}

function testMissingOpenRouterKeyIsSafe() {
  assert.throws(
    () =>
      readKnowledgeEmbeddingConfig({
        KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
        KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536"
      }),
    (error) =>
      error instanceof KnowledgeEmbeddingProviderError &&
      error.errorCode === "knowledge.embedding_config_invalid" &&
      !JSON.stringify(error).includes(openRouterKey)
  );
}

async function testOpenRouterHttpFailureIsSafe() {
  const adapter = new OpenAICompatibleKnowledgeEmbeddingAdapter(
    readKnowledgeEmbeddingConfig({
      KNOWLEDGE_EMBEDDING_PROVIDER: "openrouter",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
      OPENROUTER_API_KEY: openRouterKey
    }),
    async () =>
      new Response(`raw provider payload ${openRouterKey}`, {
        status: 429,
        headers: { "content-type": "text/plain" }
      })
  );

  await assertSafeRejection(
    () => adapter.generateEmbedding(createInput("chunk", 0)),
    "knowledge.embedding_provider_failed"
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
    assert.equal(serialized.includes(openRouterKey), false);
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

function vector1536(seed) {
  return Array.from({ length: 1536 }, (_value, index) => seed + index / 10000);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}
