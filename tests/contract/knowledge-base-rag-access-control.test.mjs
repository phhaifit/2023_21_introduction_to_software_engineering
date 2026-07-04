import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { createKnowledgeBaseRagRouter } from "@vcp/backend/modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import { KnowledgeBaseRagAccessPolicy } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-access-policy.ts";
import { KnowledgeAccessDeniedError } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-errors.ts";
import { KnowledgeRagAnswerUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-rag-answer-use-case.ts";
import { KnowledgeRetrievalSearchUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import {
  InMemoryKnowledgeAccessGrantRepository,
  InMemoryKnowledgeDocumentRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { PrismaKnowledgeAccessGrantRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-access-grant-repository.ts";
import { StoredKnowledgeDocumentContentReader } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/stored-knowledge-document-content-reader.ts";

const grantRepository = new InMemoryKnowledgeAccessGrantRepository();
const accessPolicy = new KnowledgeBaseRagAccessPolicy(grantRepository);

testGrantPersistenceArtifacts();
await testUserPolicy();
await testAgentGrantPolicy();
await testAgentScopedRetrievalAndRag();
await testStoredContentWorkspaceGuard();
await testPrismaGrantScoping();
await testHttpAccessControl();

console.log("knowledge-base-rag access control checks passed");

function testGrantPersistenceArtifacts() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const schema = readFileSync(
    join(root, "packages/database/prisma/schema.prisma"),
    "utf8"
  );
  const foundationMigration = readFileSync(
    join(
      root,
      "packages/database/prisma/migrations/0002_establish_platform_data_model_boundaries/migration.sql"
    ),
    "utf8"
  );
  const integrityMigration = readFileSync(
    join(
      root,
      "packages/database/prisma/migrations/0003_harden_platform_data_integrity/migration.sql"
    ),
    "utf8"
  );
  const kbMigration = readFileSync(
    join(
      root,
      "packages/database/prisma/migrations/20260625130000_add_kb_rag_persistence_boundary/migration.sql"
    ),
    "utf8"
  );

  assert.match(schema, /model KnowledgeAccessGrant \{/);
  assert.match(schema, /status\s+String @default\("active"\)/);
  assert.match(
    schema,
    /@@unique\(\[workspaceId, documentId, agentId\]\)/
  );
  assert.match(
    foundationMigration,
    /CREATE TABLE "knowledge_access_grants"/
  );
  assert.match(
    foundationMigration,
    /CREATE INDEX "knowledge_access_grants_workspaceId_status_idx"/
  );
  assert.match(
    integrityMigration,
    /CREATE UNIQUE INDEX "knowledge_access_grants_workspaceId_documentId_agentId_key"/
  );
  assert.match(
    kbMigration,
    /ADD CONSTRAINT "knowledge_access_grants_documentId_fkey"/
  );
}

async function testUserPolicy() {
  for (const role of ["admin", "editor"]) {
    for (const action of [
      "document:upload",
      "document:delete",
      "source:manage",
      "sync-scope:manage",
      "sync:trigger"
    ]) {
      assert.doesNotThrow(() => accessPolicy.assertUserCan(role, action));
    }
  }

  for (const action of [
    "document:read",
    "ingestion:read",
    "source:read",
    "sync-scope:read",
    "sync:read",
    "retrieval:search",
    "rag:answer"
  ]) {
    assert.doesNotThrow(() => accessPolicy.assertUserCan("viewer", action));
  }

  for (const action of [
    "document:upload",
    "document:delete",
    "source:manage",
    "sync-scope:manage",
    "sync:trigger"
  ]) {
    assert.throws(
      () => accessPolicy.assertUserCan("viewer", action),
      KnowledgeAccessDeniedError
    );
  }
}

async function testAgentGrantPolicy() {
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-active",
      documentId: "document-a"
    })
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-revoked",
      documentId: "document-revoked",
      status: "revoked"
    })
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-other-workspace",
      workspaceId: "workspace-b",
      documentId: "document-b"
    })
  );

  assert.deepEqual(
    await accessPolicy.listAgentDocumentIds("workspace-a", "agent-a"),
    ["document-a"]
  );
  await accessPolicy.assertAgentCanAccessDocument(
    "workspace-a",
    "agent-a",
    "document-a"
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-active-revoked",
      documentId: "document-a",
      status: "revoked"
    })
  );
  assert.deepEqual(
    await accessPolicy.listAgentDocumentIds("workspace-a", "agent-a"),
    []
  );
  await assert.rejects(
    () =>
      accessPolicy.assertAgentCanAccessDocument(
        "workspace-a",
        "agent-a",
        "document-a"
      ),
    KnowledgeAccessDeniedError
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-active-restored",
      documentId: "document-a"
    })
  );
  await accessPolicy.assertAgentCanAccessDocument(
    "workspace-a",
    "agent-a",
    "document-a"
  );
  await assert.rejects(
    () =>
      accessPolicy.assertAgentCanAccessDocument(
        "workspace-a",
        "agent-a",
        "document-revoked"
      ),
    KnowledgeAccessDeniedError
  );
  await assert.rejects(
    () =>
      accessPolicy.assertAgentCanAccessDocument(
        "workspace-a",
        "agent-a",
        "document-b"
      ),
    KnowledgeAccessDeniedError
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-other-agent",
      documentId: "document-other",
      agentId: "agent-other"
    })
  );
  await assert.rejects(
    () =>
      accessPolicy.assertAgentCanAccessDocument(
        "workspace-a",
        "agent-a",
        "document-other"
      ),
    KnowledgeAccessDeniedError
  );

  const skillReference = {
    requestedKnowledge: [
      {
        documentId: "document-ungranted",
        sourceLocator: "notion:restricted-page"
      }
    ]
  };
  assert.equal(skillReference.requestedKnowledge.length, 1);
  await assert.rejects(
    () =>
      accessPolicy.assertAgentCanAccessDocument(
        "workspace-a",
        "agent-a",
        "document-ungranted"
      ),
    KnowledgeAccessDeniedError,
    "skill/configuration references must not create grants"
  );
}

async function testAgentScopedRetrievalAndRag() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  await seedDocument(documentRepository, "workspace-a", "document-a", "chunk-a");
  await seedDocument(documentRepository, "workspace-a", "document-c", "chunk-c");
  await seedDocument(documentRepository, "workspace-a", "document-ungranted", "chunk-u");
  await seedDocument(documentRepository, "workspace-b", "document-b", "chunk-b");
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-multi-a",
      agentId: "agent-multi",
      documentId: "document-a"
    })
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-multi-c",
      agentId: "agent-multi",
      documentId: "document-c"
    })
  );
  await grantRepository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-multi-revoked",
      agentId: "agent-multi",
      documentId: "document-ungranted",
      status: "revoked"
    })
  );

  let embeddingCalls = 0;
  let vectorCalls = 0;
  const retrieval = new KnowledgeRetrievalSearchUseCase({
    documentRepository,
    accessPolicy,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        embeddingCalls += 1;
        return { workspaceId: input.workspaceId, embedding: [0.1, 0.2] };
      }
    },
    vectorQueryAdapter: {
      async query(input) {
        vectorCalls += 1;
        assert.deepEqual(input.documentIds, ["document-a", "document-c"]);
        return [
          createMatch("workspace-a", "document-ungranted", "chunk-u", 0.99),
          createMatch("workspace-b", "document-b", "chunk-b", 0.98),
          createMatch("workspace-a", "document-a", "chunk-a", 0.9),
          createMatch("workspace-a", "document-c", "chunk-c", 0.88)
        ];
      }
    }
  });

  const result = await retrieval.search(
    "workspace-a",
    { query: "policy" },
    { agentId: "agent-multi" }
  );
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.results.map((item) => item.documentId),
    ["document-a", "document-c"]
  );
  assertSafePublicValue(result);

  const callsBeforeDenied = { embeddingCalls, vectorCalls };
  const denied = await retrieval.search(
    "workspace-a",
    { query: "policy" },
    { agentId: "agent-without-grants" }
  );
  assert.deepEqual(denied, { results: [], total: 0 });
  assert.deepEqual(
    { embeddingCalls, vectorCalls },
    callsBeforeDenied,
    "denied agent retrieval must stop before embedding/vector calls"
  );

  let providerEvidence;
  const answerUseCase = new KnowledgeRagAnswerUseCase({
    retrievalSearchUseCase: retrieval,
    answerProvider: {
      async generateAnswer(input) {
        providerEvidence = input.evidence;
        return { answer: "Use the granted policy. [E1]", citationIds: ["E1"] };
      }
    },
    generateAnswerId: () => "answer-access"
  });
  const answer = await answerUseCase.answer(
    "workspace-a",
    { query: "policy" },
    { agentId: "agent-multi" }
  );
  assert.equal(answer.status, "answered");
  assert.equal(answer.evidence.length, 2);
  assert.deepEqual(
    answer.evidence.map((item) => item.documentId),
    ["document-a", "document-c"]
  );
  assert.equal(providerEvidence.length, 2);
  assert.equal(providerEvidence[0].evidenceId, answer.evidence[0].evidenceId);
  assertSafePublicValue(answer);

  providerEvidence = undefined;
  const deniedAnswer = await answerUseCase.answer(
    "workspace-a",
    { query: "policy" },
    { agentId: "agent-without-grants" }
  );
  assert.equal(deniedAnswer.status, "insufficient_evidence");
  assert.equal(providerEvidence, undefined);

  const skillOnlyConfiguration = {
    agentId: "agent-skill-only",
    requestedKnowledge: [
      {
        documentId: "document-a",
        sourceLocator: "text:0"
      }
    ]
  };
  const callsBeforeSkillOnly = { embeddingCalls, vectorCalls };
  const skillOnlyRetrieval = await retrieval.search(
    "workspace-a",
    {
      query: "policy",
      filters: {
        documentIds: [skillOnlyConfiguration.requestedKnowledge[0].documentId],
        sourceLocators: [
          skillOnlyConfiguration.requestedKnowledge[0].sourceLocator
        ]
      }
    },
    { agentId: skillOnlyConfiguration.agentId }
  );
  assert.deepEqual(skillOnlyRetrieval, { results: [], total: 0 });
  assert.deepEqual(
    { embeddingCalls, vectorCalls },
    callsBeforeSkillOnly,
    "skill-only references must not trigger embedding/vector calls"
  );

  providerEvidence = undefined;
  const skillOnlyAnswer = await answerUseCase.answer(
    "workspace-a",
    { query: "policy" },
    { agentId: skillOnlyConfiguration.agentId }
  );
  assert.equal(skillOnlyAnswer.status, "insufficient_evidence");
  assert.equal(providerEvidence, undefined);
}

async function testStoredContentWorkspaceGuard() {
  let reads = 0;
  const reader = new StoredKnowledgeDocumentContentReader(
    {
      async read() {
        reads += 1;
        return new TextEncoder().encode("private content");
      }
    },
    {
      async extract() {
        throw new Error("extractor must not run");
      }
    }
  );

  await assert.rejects(
    () =>
      reader.readText({
        workspaceId: "workspace-a",
        document: createDocument("workspace-b", "document-b")
      }),
    (error) => {
      assert.equal(error.errorCode, "knowledge.document_access_denied");
      assertSafePublicValue(error);
      return true;
    }
  );
  assert.equal(reads, 0);
}

async function testPrismaGrantScoping() {
  const calls = [];
  const repository = new PrismaKnowledgeAccessGrantRepository({
    knowledgeAccessGrant: {
      async findMany(args) {
        calls.push(["findMany", args]);
        return [{ documentId: "document-a" }];
      },
      async findFirst(args) {
        calls.push(["findFirst", args]);
        return { knowledgeAccessGrantId: "grant-active" };
      },
      async upsert(args) {
        calls.push(["upsert", args]);
        return {
          ...args.create,
          ...args.update
        };
      }
    }
  });

  assert.deepEqual(
    await repository.listActiveDocumentIds("workspace-a", "agent-a"),
    ["document-a"]
  );
  assert.equal(
    await repository.hasActiveDocumentGrant(
      "workspace-a",
      "agent-a",
      "document-a"
    ),
    true
  );
  assert.deepEqual(calls[0][1].where, {
    workspaceId: "workspace-a",
    agentId: "agent-a",
    status: "active"
  });
  assert.deepEqual(calls[1][1].where, {
    workspaceId: "workspace-a",
    agentId: "agent-a",
    documentId: "document-a",
    status: "active"
  });

  const active = await repository.saveAccessGrant(
    createGrant({ knowledgeAccessGrantId: "grant-persisted" })
  );
  assert.equal(active.status, "active");
  const revoked = await repository.saveAccessGrant(
    createGrant({
      knowledgeAccessGrantId: "grant-persisted",
      status: "revoked"
    })
  );
  assert.equal(revoked.status, "revoked");
  assert.deepEqual(calls[2][1].where, {
    workspaceId_documentId_agentId: {
      workspaceId: "workspace-a",
      documentId: "document-a",
      agentId: "agent-a"
    }
  });
  assert.equal(calls[3][1].update.status, "revoked");
}

async function testHttpAccessControl() {
  const calls = [];
  const useCases = {
    documentUseCases: {
      async listDocuments() {
        calls.push("document:read");
        return { items: [], total: 0 };
      }
    },
    uploadUseCases: {
      async uploadDocuments() {
        calls.push("document:upload");
      },
      async validateUploadCandidates() {
        calls.push("document:upload");
      },
      async prepareUpload() {
        calls.push("document:upload");
      }
    },
    ingestionUseCases: {
      async listIngestionJobs() {
        calls.push("ingestion:read");
        return { items: [], total: 0 };
      }
    },
    dataSourceUseCases: {
      async listDataSources() {
        calls.push("source:read");
        return [];
      },
      async connectDataSourcePlaceholder() {
        calls.push("source:manage");
      }
    },
    syncUseCases: {
      async getSyncScope() {
        calls.push("sync-scope:read");
        return [];
      },
      async updateSyncScope() {
        calls.push("sync-scope:manage");
      },
      async requestManualSync() {
        calls.push("sync:trigger");
      },
      async listSyncJobs() {
        calls.push("sync:read");
        return { items: [], total: 0 };
      }
    },
    retrievalSearchUseCase: {
      async search() {
        calls.push("retrieval:search");
        return { results: [], total: 0 };
      }
    },
    ragAnswerUseCase: {
      async answer() {
        calls.push("rag:answer");
        return {
          answerId: "answer-route",
          status: "insufficient_evidence",
          answer: "Insufficient evidence.",
          citations: [],
          evidence: [],
          warnings: ["insufficient_evidence"]
        };
      }
    },
    accessPolicy
  };

  await withApi(useCases, async (baseUrl) => {
    const viewerRead = await request(baseUrl, "GET", "/knowledge/documents", {
      role: "viewer"
    });
    assert.equal(viewerRead.status, 200);

    for (const [method, path, body] of [
      ["POST", "/knowledge/uploads/validate", { files: [] }],
      ["POST", "/knowledge/data-sources/source-a/connect", {}],
      ["PUT", "/knowledge/sync-scope", { selectedScopeNodeIds: [] }],
      ["POST", "/knowledge/sync-jobs", {}]
    ]) {
      const before = calls.length;
      const response = await request(baseUrl, method, path, {
        role: "viewer",
        body
      });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, "auth.forbidden");
      assert.equal(calls.length, before, `${method} ${path} must stop at policy`);
    }

    for (const path of [
      "/knowledge/retrieval/search",
      "/knowledge/rag/answer"
    ]) {
      const unauthenticated = await request(baseUrl, "POST", path, {
        authenticated: false,
        body: { query: "policy" }
      });
      assert.equal(unauthenticated.status, 401);

      const crossWorkspace = await request(baseUrl, "POST", path, {
        contextWorkspaceId: "workspace-b",
        body: { query: "policy" }
      });
      assert.equal(crossWorkspace.status, 403);
      assertSafePublicValue(crossWorkspace.body);
    }

    const retrieval = await request(
      baseUrl,
      "POST",
      "/knowledge/retrieval/search",
      { role: "viewer", body: { query: "policy" } }
    );
    assert.equal(retrieval.status, 200);
    const answer = await request(baseUrl, "POST", "/knowledge/rag/answer", {
      role: "viewer",
      body: { query: "policy" }
    });
    assert.equal(answer.status, 200);
  });
}

async function seedDocument(repository, workspaceId, documentId, chunkId) {
  await repository.saveDocument(createDocument(workspaceId, documentId));
  await repository.saveDocumentChunk({
    chunkId,
    workspaceId,
    documentId,
    chunkIndex: 0,
    contentText: `Evidence for ${documentId}.`,
    embeddingStatus: "ready",
    sourceLocator: "text:0",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  });
}

function createDocument(workspaceId, documentId) {
  return {
    documentId,
    workspaceId,
    uploadedByUserId: "user-a",
    displayName: `${documentId}.txt`,
    fileName: `${documentId}.txt`,
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: 100,
    sourceType: "upload",
    storageKey: `private/${workspaceId}/${documentId}`,
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  };
}

function createGrant(overrides = {}) {
  return {
    knowledgeAccessGrantId: "grant-a",
    workspaceId: "workspace-a",
    documentId: "document-a",
    agentId: "agent-a",
    status: "active",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    ...overrides
  };
}

function createMatch(workspaceId, documentId, chunkId, score) {
  return {
    workspaceId,
    documentId,
    chunkId,
    chunkIndex: 0,
    score,
    metadata: { sourceLocator: "text:0" }
  };
}

async function withApi(useCases, callback) {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    const authenticated = request.header("x-test-auth") !== "false";
    request.context = authenticated
      ? {
          requestId: "access-request",
          user: { userId: "user-a", email: "user@example.com" },
          workspace: {
            workspaceId:
              request.header("x-test-workspace") ?? "workspace-a",
            memberId: "member-a",
            role: request.header("x-test-role") ?? "admin"
          }
        }
      : { requestId: "access-request" };
    next();
  });
  app.use(createKnowledgeBaseRagRouter(useCases));

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/workspaces/workspace-a`;
  try {
    await callback(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function request(
  baseUrl,
  method,
  path,
  {
    authenticated = true,
    role = "admin",
    contextWorkspaceId = "workspace-a",
    body
  } = {}
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-auth": String(authenticated),
      "x-test-role": role,
      "x-test-workspace": contextWorkspaceId
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

function assertSafePublicValue(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|apiKey|Bearer|queuePayload|stackTrace|accessGrant/i
  );
}
