import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryKnowledgeDocumentRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import {
  KnowledgeVectorDatabaseError,
  PgvectorKnowledgeVectorIndexAdapter,
  readKnowledgeVectorConfig
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/pgvector-knowledge-vector-index-adapter.ts";
import { KnowledgeDocumentIndexingPipeline } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-indexing-pipeline.ts";

const root = process.cwd();
const baseConfig = {
  provider: "pgvector",
  dimensions: 3,
  distance: "cosine",
  batchSize: 2
};

testNoExternalVectorStoreArtifacts();
testConfigurationValidation();
await testSchemaReadiness();
await testBatchedStableUpsert();
await testScopedQuery();
await testInputValidation();
await testSafeFailures();
await testIndexingPipelineIntegration();

console.log("knowledge-base-rag pgvector index checks passed");

function testNoExternalVectorStoreArtifacts() {
  const forbiddenNames = [
    "qdrant",
    "pinecone",
    "milvus",
    "weaviate",
    "chroma"
  ];
  const productionFiles = [
    ".env.example",
    "apps/backend/src/modules/knowledge-base-rag/README.md",
    "apps/backend/src/modules/knowledge-base-rag/infrastructure/pgvector-knowledge-vector-index-adapter.ts"
  ];
  for (const path of productionFiles) {
    const source = readFileSync(join(root, path), "utf8").toLowerCase();
    for (const name of forbiddenNames) {
      assert.equal(source.includes(name), false, `${path} must not reference ${name}`);
    }
  }
  assert.equal(
    existsSync(
      join(
        root,
        "apps/backend/src/modules/knowledge-base-rag/infrastructure/qdrant-knowledge-vector-index-adapter.ts"
      )
    ),
    false
  );
}

function testConfigurationValidation() {
  assert.deepEqual(
    readKnowledgeVectorConfig({
      KNOWLEDGE_VECTOR_PROVIDER: "pgvector",
      KNOWLEDGE_VECTOR_DIMENSIONS: "1536",
      KNOWLEDGE_VECTOR_DISTANCE: "COSINE"
    }),
    {
      provider: "pgvector",
      dimensions: 1536,
      distance: "cosine",
      batchSize: 64
    }
  );

  for (const environment of [
    {},
    {
      KNOWLEDGE_VECTOR_PROVIDER: "external",
      KNOWLEDGE_VECTOR_DIMENSIONS: "3",
      KNOWLEDGE_VECTOR_DISTANCE: "cosine"
    },
    {
      KNOWLEDGE_VECTOR_PROVIDER: "pgvector",
      KNOWLEDGE_VECTOR_DIMENSIONS: "0",
      KNOWLEDGE_VECTOR_DISTANCE: "cosine"
    },
    {
      KNOWLEDGE_VECTOR_PROVIDER: "pgvector",
      KNOWLEDGE_VECTOR_DIMENSIONS: "3",
      KNOWLEDGE_VECTOR_DISTANCE: "unsupported"
    }
  ]) {
    assert.throws(
      () => readKnowledgeVectorConfig(environment),
      (error) =>
        error instanceof KnowledgeVectorDatabaseError &&
        error.errorCode === "knowledge.vector_config_invalid"
    );
  }
}

async function testSchemaReadiness() {
  const queries = [];
  const adapter = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      query: async (sql) => {
        queries.push(sql);
        return [{ extensionEnabled: true, embeddingColumnAvailable: true }];
      }
    }),
    baseConfig
  );
  await adapter.ensureIndex();
  assert.match(queries[0], /pg_extension/);
  assert.match(queries[0], /knowledge_document_chunks/);

  const unavailable = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      query: async () => [
        { extensionEnabled: false, embeddingColumnAvailable: false }
      ]
    }),
    baseConfig
  );
  await assertSafeRejection(
    () => unavailable.ensureIndex(),
    "knowledge.vector_schema_unavailable"
  );
}

async function testBatchedStableUpsert() {
  const executions = [];
  const adapter = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      execute: async (sql, values) => {
        executions.push({ sql, values });
        return values.length / 7;
      }
    }),
    baseConfig
  );
  const inputs = [
    createIndexInput("chunk-a", 0, [1, 0, 0]),
    createIndexInput("chunk-b", 1, [0, 1, 0]),
    createIndexInput("chunk-c", 2, [0, 0, 1])
  ];
  const results = await adapter.upsertChunkEmbeddings(inputs);

  assert.equal(executions.length, 2);
  assert.match(executions[0].sql, /UPDATE "knowledge_document_chunks"/);
  assert.match(executions[0].sql, /"embedding" = input\.embedding/);
  assert.match(executions[0].sql, /chunk\."workspaceId" = input\.workspace_id/);
  assert.deepEqual(executions[0].values.slice(0, 7), [
    "workspace-a",
    "document-a",
    "chunk-a",
    0,
    "[1,0,0]",
    3,
    results[0].vectorRef
  ]);
  assert.equal(results.length, 3);
  assert.match(results[0].vectorRef, /^[0-9a-f]{64}$/);

  const repeated = await adapter.upsertChunkEmbedding(inputs[0]);
  assert.equal(repeated.vectorRef, results[0].vectorRef);
  assert.equal(executions[2].values[6], results[0].vectorRef);
}

async function testScopedQuery() {
  const calls = [];
  const adapter = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      query: async (sql, values) => {
        calls.push({ sql, values });
        return [
          {
            workspaceId: "workspace-a",
            documentId: "document-a",
            chunkId: "chunk-a",
            chunkIndex: 0,
            contentHash: "safe-hash",
            tokenCount: 4,
            sourceLocator: "page:1",
            distance: "0.09"
          }
        ];
      }
    }),
    baseConfig
  );
  const matches = await adapter.query({
    workspaceId: "workspace-a",
    documentId: "document-a",
    sourceLocator: "page:1",
    embedding: [1, 2, 3],
    topK: 5
  });

  assert.match(calls[0].sql, /chunk\."workspaceId" = \$3/);
  assert.match(calls[0].sql, /chunk\."documentId" = \$4/);
  assert.match(calls[0].sql, /chunk\."sourceLocator" = \$5/);
  assert.match(calls[0].sql, /<=>/);
  assert.deepEqual(calls[0].values, [
    "[1,2,3]",
    3,
    "workspace-a",
    "document-a",
    "page:1",
    5
  ]);
  assert.deepEqual(matches, [
    {
      workspaceId: "workspace-a",
      documentId: "document-a",
      chunkId: "chunk-a",
      chunkIndex: 0,
      score: 0.91,
      metadata: {
        contentHash: "safe-hash",
        tokenCount: 4,
        sourceLocator: "page:1"
      }
    }
  ]);
  assert.equal(JSON.stringify(matches).includes("[1,2,3]"), false);

  const emptyAdapter = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({ query: async () => [] }),
    baseConfig
  );
  assert.deepEqual(
    await emptyAdapter.query({
      workspaceId: "workspace-a",
      embedding: [1, 2, 3],
      topK: 3
    }),
    []
  );

  calls.length = 0;
  await adapter.query({
    workspaceId: "workspace-a",
    embedding: [1, 2, 3],
    topK: 4,
    documentIds: ["document-a", "document-b"],
    sourceLocators: ["page:1"],
    sourceTypes: ["upload"],
    statuses: ["ready"]
  });
  assert.match(calls[0].sql, /INNER JOIN "documents"/);
  assert.match(calls[0].sql, /chunk\."documentId" = ANY\(\$4::text\[\]\)/);
  assert.match(calls[0].sql, /chunk\."sourceLocator" = ANY\(\$5::text\[\]\)/);
  assert.match(calls[0].sql, /document\."sourceType" = ANY\(\$6::text\[\]\)/);
  assert.match(calls[0].sql, /document\."indexingStatus" = ANY\(\$7::text\[\]\)/);
  assert.deepEqual(calls[0].values, [
    "[1,2,3]",
    3,
    "workspace-a",
    ["document-a", "document-b"],
    ["page:1"],
    ["upload"],
    ["ready"],
    4
  ]);
}

async function testInputValidation() {
  let calls = 0;
  const adapter = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      execute: async () => {
        calls += 1;
        return 1;
      },
      query: async () => {
        calls += 1;
        return [];
      }
    }),
    baseConfig
  );
  await assertSafeRejection(
    () => adapter.upsertChunkEmbedding(createIndexInput("chunk-a", 0, [1, 2])),
    "knowledge.vector_invalid"
  );
  await assertSafeRejection(
    () =>
      adapter.upsertChunkEmbedding(
        createIndexInput("chunk-a", 0, [1, Number.POSITIVE_INFINITY, 3])
      ),
    "knowledge.vector_invalid"
  );
  await assertSafeRejection(
    () =>
      adapter.query({
        workspaceId: "",
        embedding: [1, 2, 3],
        topK: 3
      }),
    "knowledge.vector_input_invalid"
  );
  assert.equal(calls, 0);
}

async function testSafeFailures() {
  const databaseFailure = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      execute: async () => {
        throw new Error("DATABASE_URL=private raw SQL embedding [1,2,3]");
      }
    }),
    baseConfig
  );
  await assertSafeRejection(
    () => databaseFailure.upsertChunkEmbedding(createIndexInput("chunk-a", 0)),
    "knowledge.vector_database_unavailable"
  );

  const countMismatch = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({ execute: async () => 0 }),
    baseConfig
  );
  await assertSafeRejection(
    () => countMismatch.upsertChunkEmbedding(createIndexInput("chunk-a", 0)),
    "knowledge.vector_upsert_failed"
  );

  const malformed = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      query: async () => [{ workspaceId: "workspace-a", distance: "invalid" }]
    }),
    baseConfig
  );
  await assertSafeRejection(
    () =>
      malformed.query({
        workspaceId: "workspace-a",
        embedding: [1, 2, 3],
        topK: 3
      }),
    "knowledge.vector_database_result_invalid"
  );

  const crossWorkspace = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      query: async () => [
        {
          workspaceId: "workspace-b",
          documentId: "document-b",
          chunkId: "chunk-b",
          chunkIndex: 0,
          contentHash: null,
          tokenCount: null,
          sourceLocator: null,
          distance: 0.1
        }
      ]
    }),
    baseConfig
  );
  await assertSafeRejection(
    () =>
      crossWorkspace.query({
        workspaceId: "workspace-a",
        embedding: [1, 2, 3],
        topK: 3
      }),
    "knowledge.vector_database_result_invalid"
  );
}

async function testIndexingPipelineIntegration() {
  const repository = new InMemoryKnowledgeDocumentRepository();
  await repository.saveDocument(createDocument());
  await repository.saveDocumentChunk(createChunk(0));
  await repository.saveDocumentChunk(createChunk(1));

  const executions = [];
  const vectorAdapter = new PgvectorKnowledgeVectorIndexAdapter(
    createDatabase({
      execute: async (sql, values) => {
        executions.push({ sql, values });
        return values.length / 7;
      }
    }),
    baseConfig
  );
  const pipeline = new KnowledgeDocumentIndexingPipeline({
    documentRepository: repository,
    embeddingAdapter: {
      async generateEmbedding(input) {
        return createEmbeddingResult(input);
      },
      async generateEmbeddings(inputs) {
        return inputs.map(createEmbeddingResult);
      }
    },
    vectorIndexAdapter: vectorAdapter,
    now: createClock()
  });
  const result = await pipeline.processDocument({
    workspaceId: "workspace-a",
    documentId: "document-a"
  });

  assert.equal(result.failure, undefined);
  assert.equal(result.document.indexingStatus, "ready");
  assert.equal(result.indexedChunkCount, 2);
  assert.equal(executions.length, 1);
  assert.deepEqual(
    [executions[0].values[2], executions[0].values[9]],
    ["chunk-0", "chunk-1"]
  );
}

function createDatabase(overrides = {}) {
  return {
    async $executeRawUnsafe(sql, ...values) {
      return overrides.execute ? overrides.execute(sql, values) : values.length / 7;
    },
    async $queryRawUnsafe(sql, ...values) {
      return overrides.query ? overrides.query(sql, values) : [];
    }
  };
}

async function assertSafeRejection(operation, errorCode) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof KnowledgeVectorDatabaseError);
    assert.equal(error.errorCode, errorCode);
    const serialized = JSON.stringify({
      name: error.name,
      errorCode: error.errorCode,
      message: error.message
    });
    assert.equal(
      /database_url|raw sql|\[1,2,3\]|password|credential|secret|token/i.test(
        serialized
      ),
      false
    );
    assert.equal("cause" in error, false);
    return true;
  });
}

function createIndexInput(chunkId, chunkIndex, embedding = [1, 2, 3]) {
  return {
    workspaceId: "workspace-a",
    documentId: "document-a",
    chunkId,
    chunkIndex,
    embedding,
    metadata: {
      contentHash: `hash-${chunkId}`,
      tokenCount: 4,
      sourceLocator: "page:1"
    }
  };
}

function createEmbeddingResult(input) {
  return {
    workspaceId: input.workspaceId,
    documentId: input.documentId,
    chunkId: input.chunkId,
    chunkIndex: input.chunkIndex,
    embedding: [input.chunkIndex, 1, 2]
  };
}

function createDocument() {
  return {
    documentId: "document-a",
    workspaceId: "workspace-a",
    uploadedByUserId: "user-a",
    displayName: "Document A",
    fileName: "document-a.txt",
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: 100,
    sourceType: "upload",
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "pending",
    chunkCount: 2,
    indexedChunkCount: 0,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  };
}

function createChunk(chunkIndex) {
  return {
    chunkId: `chunk-${chunkIndex}`,
    workspaceId: "workspace-a",
    documentId: "document-a",
    chunkIndex,
    contentText: `Persisted chunk ${chunkIndex}`,
    contentHash: `hash-chunk-${chunkIndex}`,
    tokenCount: 3,
    embeddingStatus: "pending",
    sourceLocator: `text:${chunkIndex}`,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  };
}

function createClock() {
  let tick = 0;
  return () => `2026-07-03T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}
