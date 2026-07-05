import assert from "node:assert/strict";

if (process.env.KNOWLEDGE_PGVECTOR_SMOKE !== "1") {
  console.log(
    "KNOWLEDGE_PGVECTOR_SMOKE not set — skipping KB/RAG pgvector smoke test"
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required when KNOWLEDGE_PGVECTOR_SMOKE=1."
  );
}

const { PrismaClient, PrismaPg } = await import("@vcp/database");
const pg = await import("pg");
const { PrismaKnowledgeDocumentRepository } = await import(
  "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-document-repository.ts"
);
const {
  PgvectorKnowledgeVectorIndexAdapter,
  readKnowledgeVectorConfig
} = await import(
  "@vcp/backend/modules/knowledge-base-rag/infrastructure/pgvector-knowledge-vector-index-adapter.ts"
);
const { KnowledgeRetrievalSearchUseCase } = await import(
  "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts"
);

const Pool = pg.default ? pg.default.Pool : pg.Pool;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const vectorConfig = readKnowledgeVectorConfig({
  KNOWLEDGE_VECTOR_PROVIDER: process.env.KNOWLEDGE_VECTOR_PROVIDER,
  KNOWLEDGE_VECTOR_DIMENSIONS: process.env.KNOWLEDGE_VECTOR_DIMENSIONS,
  KNOWLEDGE_VECTOR_DISTANCE: process.env.KNOWLEDGE_VECTOR_DISTANCE,
  KNOWLEDGE_VECTOR_BATCH_SIZE: process.env.KNOWLEDGE_VECTOR_BATCH_SIZE
});

if (vectorConfig.dimensions !== 3) {
  throw new Error(
    "KB/RAG pgvector smoke test expects KNOWLEDGE_VECTOR_DIMENSIONS=3."
  );
}

const repository = new PrismaKnowledgeDocumentRepository(prisma);
const vectorAdapter = new PgvectorKnowledgeVectorIndexAdapter(
  prisma,
  vectorConfig
);
const prefix = `kb-rag-pgvector-smoke-${Date.now()}`;
const workspaceA = `${prefix}-workspace-a`;
const workspaceB = `${prefix}-workspace-b`;
const documentA = `${prefix}-document-a`;
const documentB = `${prefix}-document-b`;
const chunkA = `${prefix}-chunk-a`;
const chunkB = `${prefix}-chunk-b`;

try {
  await cleanupSmokeRecords(prefix);
  await vectorAdapter.ensureIndex();
  await seedReadyDocument(workspaceA, documentA, chunkA, {
    text: "Smoke policy: equipment approval takes three business days.",
    sourceLocator: "smoke:workspace-a"
  });
  await seedReadyDocument(workspaceB, documentB, chunkB, {
    text: "Other workspace policy: this chunk must not leak into workspace A.",
    sourceLocator: "smoke:workspace-b"
  });

  const upserted = await vectorAdapter.upsertChunkEmbeddings([
    createIndexInput(workspaceA, documentA, chunkA, [1, 0, 0]),
    createIndexInput(workspaceB, documentB, chunkB, [1, 0, 0])
  ]);
  assert.equal(upserted.length, 2);

  const retrieval = new KnowledgeRetrievalSearchUseCase({
    documentRepository: repository,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        return { workspaceId: input.workspaceId, embedding: [1, 0, 0] };
      }
    },
    vectorQueryAdapter: vectorAdapter
  });

  const evidence = await retrieval.search(workspaceA, {
    query: "How long does equipment approval take?",
    topK: 5,
    filters: { statuses: ["ready"] }
  });

  assert.equal(evidence.total, 1);
  assert.equal(evidence.results[0].documentId, documentA);
  assert.equal(evidence.results[0].chunkId, chunkA);
  assert.match(evidence.results[0].snippet, /three business days/i);
  assert.equal(
    evidence.results.some((item) => item.documentId === documentB),
    false
  );
  assertSafePublicResult(evidence);

  const isolated = await retrieval.search(workspaceB, {
    query: "Can workspace B retrieve its own evidence?",
    topK: 5,
    filters: { statuses: ["ready"] }
  });
  assert.equal(isolated.total, 1);
  assert.equal(isolated.results[0].documentId, documentB);
  assertSafePublicResult(isolated);

  console.log("knowledge-base-rag pgvector smoke checks passed");
} finally {
  await cleanupSmokeRecords(prefix);
  await prisma.$disconnect();
  await pool.end();
}

async function seedReadyDocument(workspaceId, documentId, chunkId, input) {
  const timestamp = "2026-07-04T00:00:00.000Z";
  await repository.saveDocument({
    documentId,
    workspaceId,
    uploadedByUserId: `${prefix}-user`,
    displayName: `${documentId}.txt`,
    fileName: `${documentId}.txt`,
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: input.text.length,
    sourceType: "upload",
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repository.saveDocumentChunk({
    chunkId,
    workspaceId,
    documentId,
    chunkIndex: 0,
    contentText: input.text,
    contentHash: `${chunkId}-hash`,
    tokenCount: 8,
    embeddingStatus: "ready",
    sourceLocator: input.sourceLocator,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function createIndexInput(workspaceId, documentId, chunkId, embedding) {
  return {
    workspaceId,
    documentId,
    chunkId,
    chunkIndex: 0,
    embedding,
    metadata: {
      sourceLocator: `smoke:${workspaceId}`
    }
  };
}

async function cleanupSmokeRecords(recordPrefix) {
  await prisma.knowledgeDocumentChunk.deleteMany({
    where: { chunkId: { startsWith: recordPrefix } }
  });
  await prisma.knowledgeIngestionJob.deleteMany({
    where: { jobId: { startsWith: recordPrefix } }
  });
  await prisma.knowledgeIndex.deleteMany({
    where: { knowledgeIndexId: { startsWith: recordPrefix } }
  });
  await prisma.knowledgeAccessGrant.deleteMany({
    where: { knowledgeAccessGrantId: { startsWith: recordPrefix } }
  });
  await prisma.document.deleteMany({
    where: { documentId: { startsWith: recordPrefix } }
  });
}

function assertSafePublicResult(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|stackTrace|apiKey|Bearer|credential|secret|DATABASE_URL/i
  );
}
