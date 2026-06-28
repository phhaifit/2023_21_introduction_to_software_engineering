import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { InMemoryKnowledgeDocumentRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { KnowledgeDocumentIndexingPipeline } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-document-indexing-pipeline.ts";
import { KnowledgeDocumentIndexingError } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-indexing-errors.ts";

const root = process.cwd();
const workerRoot = join(root, "apps/backend/src/modules/knowledge-base-rag/worker");
const packageJsonPath = join(root, "package.json");
const prismaSchemaPath = join(root, "packages/database/prisma/schema.prisma");

const requiredWorkerFiles = [
  "knowledge-embedding-adapter.ts",
  "knowledge-vector-index-adapter.ts",
  "knowledge-document-indexing-pipeline.ts",
  "knowledge-indexing-errors.ts"
];
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
  "/api/knowledge-base/",
  "/api/workspaces/:workspaceId/knowledge"
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
  "raw embedding",
  "embeddingVector",
  "storageKey",
  "private/object/key",
  "provider payload",
  "vector database config",
  "secret token",
  "credential"
];

for (const fileName of requiredWorkerFiles) {
  assert.ok(
    existsSync(join(workerRoot, fileName)),
    `${fileName} must exist under the KB/RAG worker boundary`
  );
}

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

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const declaredPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {})
]);
for (const packageName of forbiddenPackageNames) {
  assert.equal(
    declaredPackages.has(packageName),
    false,
    `${packageName} must not be added for this adapter-boundary slice`
  );
}

const prismaSchemaBefore = readFileSync(prismaSchemaPath, "utf8");
assert.doesNotMatch(
  prismaSchemaBefore,
  /embeddingVector|rawVector|vectorConfig|providerPayload|credential|secret|refreshToken/i,
  "Prisma schema must not store raw embeddings, vector config, provider payloads, or credentials"
);

assertPortsAreDefined();
await assertSuccessfulIndexingUsesInjectedAdapters();
await assertNoChunksFailureIsSafe();
await assertEmbeddingFailureIsSafe();
await assertVectorIndexFailureIsSafe();
await assertUnsupportedChunkStateFailureIsSafe();

console.log("knowledge-base-rag embedding/indexing adapter boundary checks passed");

function assertPortsAreDefined() {
  const embeddingSource = readFileSync(
    join(workerRoot, "knowledge-embedding-adapter.ts"),
    "utf8"
  );
  const vectorSource = readFileSync(
    join(workerRoot, "knowledge-vector-index-adapter.ts"),
    "utf8"
  );
  const pipelineSource = readFileSync(
    join(workerRoot, "knowledge-document-indexing-pipeline.ts"),
    "utf8"
  );

  assert.match(embeddingSource, /export type KnowledgeEmbeddingAdapter/);
  assert.match(embeddingSource, /generateEmbedding/);
  assert.match(vectorSource, /export type KnowledgeVectorIndexAdapter/);
  assert.match(vectorSource, /upsertChunkEmbedding/);
  assert.match(pipelineSource, /export class KnowledgeDocumentIndexingPipeline/);
  assert.match(pipelineSource, /embeddingAdapter: KnowledgeEmbeddingAdapter/);
  assert.match(pipelineSource, /vectorIndexAdapter: KnowledgeVectorIndexAdapter/);
}

async function assertSuccessfulIndexingUsesInjectedAdapters() {
  const documentRepository = await createRepositoryWithDocumentAndChunks();
  const embeddingCalls = [];
  const vectorCalls = [];
  const pipeline = new KnowledgeDocumentIndexingPipeline({
    documentRepository,
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
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef: `opaque-vector-${input.chunkId}`
        };
      }
    },
    now: createClock([
      "2026-06-27T01:00:00.000Z",
      "2026-06-27T01:00:01.000Z",
      "2026-06-27T01:00:02.000Z",
      "2026-06-27T01:00:03.000Z",
      "2026-06-27T01:00:04.000Z",
      "2026-06-27T01:00:05.000Z"
    ])
  });

  const result = await pipeline.processDocument({
    workspaceId: "workspace-a",
    documentId: "document-a"
  });
  const savedDocument = await documentRepository.getDocumentById(
    "workspace-a",
    "document-a"
  );
  const savedChunks = await documentRepository.listDocumentChunks(
    "workspace-a",
    "document-a"
  );

  assert.equal(result.failure, undefined);
  assert.equal(result.document.indexingStatus, "ready");
  assert.equal(savedDocument.indexingStatus, "ready");
  assert.equal(savedDocument.ingestionStatus, "ready");
  assert.equal(savedDocument.indexedChunkCount, 2);
  assert.equal(embeddingCalls.length, 2);
  assert.equal(vectorCalls.length, 2);
  assert.deepEqual(
    embeddingCalls.map((call) => [
      call.workspaceId,
      call.documentId,
      call.chunkId,
      call.chunkIndex,
      call.chunkText
    ]),
    [
      [
        "workspace-a",
        "document-a",
        "chunk-a-0",
        0,
        "Escalate priority incidents through the support lead."
      ],
      [
        "workspace-a",
        "document-a",
        "chunk-a-1",
        1,
        "Record customer impact and timeline notes before handoff."
      ]
    ]
  );
  assert.deepEqual(
    vectorCalls.map((call) => [call.chunkId, call.chunkIndex, call.embedding]),
    [
      ["chunk-a-0", 0, deterministicEmbedding(embeddingCalls[0].chunkText, 0)],
      ["chunk-a-1", 1, deterministicEmbedding(embeddingCalls[1].chunkText, 1)]
    ]
  );
  assert.deepEqual(
    savedChunks.items.map((chunk) => [
      chunk.chunkId,
      chunk.embeddingStatus,
      chunk.vectorRef
    ]),
    [
      ["chunk-a-0", "ready", "opaque-vector-chunk-a-0"],
      ["chunk-a-1", "ready", "opaque-vector-chunk-a-1"]
    ]
  );
}

async function assertNoChunksFailureIsSafe() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  await documentRepository.saveDocument(createDocument({ documentId: "document-empty" }));
  const result = await createNoopPipeline(documentRepository).processDocument({
    workspaceId: "workspace-a",
    documentId: "document-empty"
  });

  assert.equal(result.document.indexingStatus, "failed");
  assert.equal(result.failure.errorCode, "knowledge.document_chunks_missing");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document has no persisted chunks available for indexing."
  );
  assertSafeFailure(result.failure);
}

async function assertEmbeddingFailureIsSafe() {
  const documentRepository = await createRepositoryWithDocumentAndChunks({
    documentId: "document-embedding-fail"
  });
  const pipeline = new KnowledgeDocumentIndexingPipeline({
    documentRepository,
    embeddingAdapter: {
      async generateEmbedding() {
        throw new Error(
          "provider payload included raw embedding and storageKey private/object/key secret token"
        );
      }
    },
    vectorIndexAdapter: {
      async upsertChunkEmbedding() {
        throw new Error("should not be called");
      }
    },
    now: createClock(["2026-06-27T02:00:00.000Z"])
  });

  const result = await pipeline.processDocument({
    workspaceId: "workspace-a",
    documentId: "document-embedding-fail"
  });

  assert.equal(result.document.indexingStatus, "failed");
  assert.equal(result.failure.errorCode, "knowledge.embedding_failed");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document chunk embedding generation failed."
  );
  assertSafeFailure(result.failure);
}

async function assertVectorIndexFailureIsSafe() {
  const documentRepository = await createRepositoryWithDocumentAndChunks({
    documentId: "document-vector-fail"
  });
  const pipeline = new KnowledgeDocumentIndexingPipeline({
    documentRepository,
    embeddingAdapter: {
      async generateEmbedding(input) {
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
      async upsertChunkEmbedding() {
        throw new Error(
          "vector database config leaked credential secret token private/object/key"
        );
      }
    },
    now: createClock(["2026-06-27T03:00:00.000Z"])
  });

  const result = await pipeline.processDocument({
    workspaceId: "workspace-a",
    documentId: "document-vector-fail"
  });

  assert.equal(result.document.indexingStatus, "failed");
  assert.equal(result.failure.errorCode, "knowledge.vector_index_failed");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document chunk vector indexing failed."
  );
  assertSafeFailure(result.failure);
}

async function assertUnsupportedChunkStateFailureIsSafe() {
  const documentRepository = await createRepositoryWithDocumentAndChunks({
    documentId: "document-bad-chunk",
    chunkOverrides: [{ embeddingStatus: "failed" }]
  });
  const result = await createNoopPipeline(documentRepository).processDocument({
    workspaceId: "workspace-a",
    documentId: "document-bad-chunk"
  });

  assert.equal(result.document.indexingStatus, "failed");
  assert.equal(result.failure.errorCode, "knowledge.document_chunk_state_unsupported");
  assert.equal(
    result.failure.errorMessage,
    "Knowledge document chunk is not in an indexable state."
  );
  assertSafeFailure(result.failure);
}

function createNoopPipeline(documentRepository) {
  return new KnowledgeDocumentIndexingPipeline({
    documentRepository,
    embeddingAdapter: {
      async generateEmbedding(input) {
        throw new KnowledgeDocumentIndexingError(
          "test.unexpected_embedding",
          `Unexpected embedding call for ${input.chunkId}`
        );
      }
    },
    vectorIndexAdapter: {
      async upsertChunkEmbedding(input) {
        throw new KnowledgeDocumentIndexingError(
          "test.unexpected_vector_index",
          `Unexpected vector index call for ${input.chunkId}`
        );
      }
    },
    now: createClock(["2026-06-27T04:00:00.000Z"])
  });
}

async function createRepositoryWithDocumentAndChunks(options = {}) {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const documentId = options.documentId ?? "document-a";
  await documentRepository.saveDocument(createDocument({ documentId }));

  const chunkOverrides = options.chunkOverrides ?? [];
  const chunks = [
    createChunk({
      documentId,
      chunkId: documentId === "document-a" ? "chunk-a-0" : `${documentId}-chunk-0`,
      chunkIndex: 0,
      contentText: "Escalate priority incidents through the support lead.",
      ...(chunkOverrides[0] ?? {})
    }),
    createChunk({
      documentId,
      chunkId: documentId === "document-a" ? "chunk-a-1" : `${documentId}-chunk-1`,
      chunkIndex: 1,
      contentText: "Record customer impact and timeline notes before handoff.",
      ...(chunkOverrides[1] ?? {})
    })
  ];

  for (const chunk of chunks) {
    await documentRepository.saveDocumentChunk(chunk);
  }

  return documentRepository;
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
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "pending",
    chunkCount: 2,
    indexedChunkCount: 0,
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
    ...overrides
  };
}

function createChunk(overrides = {}) {
  return {
    chunkId: "chunk-a-0",
    workspaceId: "workspace-a",
    documentId: "document-a",
    chunkIndex: 0,
    contentText: "Escalate priority incidents through the support lead.",
    contentHash: "safe-chunk-hash",
    tokenCount: 8,
    embeddingStatus: "pending",
    sourceLocator: "text:0",
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
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

function assertSafeFailure(failure) {
  const serialized = JSON.stringify(failure);
  for (const fragment of unsafeLeakFragments) {
    assert.equal(
      serialized.toLowerCase().includes(fragment.toLowerCase()),
      false,
      `safe failure must not leak ${fragment}`
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
