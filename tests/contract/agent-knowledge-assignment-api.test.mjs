import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";

import { createKnowledgeBaseRagRouter } from "@vcp/backend/modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import { AgentKnowledgeAssignmentUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-assignment-use-case.ts";
import { KnowledgeBaseRagAccessPolicy } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-access-policy.ts";
import { KnowledgeRetrievalSearchUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import {
  InMemoryKnowledgeAccessGrantRepository,
  InMemoryKnowledgeDocumentRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

const documentRepository = new InMemoryKnowledgeDocumentRepository();
const accessGrantRepository = new InMemoryKnowledgeAccessGrantRepository();
const accessPolicy = new KnowledgeBaseRagAccessPolicy(accessGrantRepository);
const agents = new Set([
  "workspace-a:agent-a",
  "workspace-a:agent-retrieval",
  "workspace-b:agent-b"
]);
let grantSequence = 0;
let clockSequence = 0;

for (const [workspaceId, documentId] of [
  ["workspace-a", "document-a"],
  ["workspace-a", "document-b"],
  ["workspace-a", "document-c"],
  ["workspace-b", "document-other-workspace"]
]) {
  await documentRepository.saveDocument(createDocument(workspaceId, documentId));
}

const assignmentUseCase = new AgentKnowledgeAssignmentUseCase({
  accessGrantRepository,
  documentRepository,
  agentLookup: {
    async existsInWorkspace(workspaceId, agentId) {
      return agents.has(`${workspaceId}:${agentId}`);
    }
  },
  accessPolicy,
  now: () => `2026-07-04T00:00:${String(clockSequence++).padStart(2, "0")}.000Z`,
  generateGrantId: () => `grant-${++grantSequence}`
});

await withApi(async (baseUrl) => {
  const agentPath = "/knowledge/agents/agent-a/documents";

  const assigned = await request(baseUrl, "POST", `${agentPath}/document-a`);
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.data.agentId, "agent-a");
  assert.equal(assigned.body.data.document.documentId, "document-a");
  assert.equal(assigned.body.data.grantStatus, "active");

  const assignedAgain = await request(baseUrl, "POST", `${agentPath}/document-a`);
  assert.equal(assignedAgain.status, 200);
  assert.equal(grantSequence, 1, "active assignment must be idempotent");
  assert.equal(
    (await accessGrantRepository.findAccessGrant(
      "workspace-a",
      "agent-a",
      "document-a"
    )).knowledgeAccessGrantId,
    "grant-1"
  );

  const revoked = await request(baseUrl, "DELETE", `${agentPath}/document-a`);
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.data.grantStatus, "revoked");

  const afterRevoke = await request(baseUrl, "GET", agentPath);
  assert.equal(afterRevoke.status, 200);
  assert.deepEqual(afterRevoke.body.data, []);

  const reactivated = await request(baseUrl, "POST", `${agentPath}/document-a`);
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.body.data.grantStatus, "active");
  assert.equal(
    (await accessGrantRepository.findAccessGrant(
      "workspace-a",
      "agent-a",
      "document-a"
    )).knowledgeAccessGrantId,
    "grant-1",
    "reactivation must preserve the composite grant identity"
  );

  await request(baseUrl, "POST", `${agentPath}/document-b`);
  await request(baseUrl, "POST", `${agentPath}/document-c`);
  await request(baseUrl, "DELETE", `${agentPath}/document-c`);
  const activeOnly = await request(baseUrl, "GET", agentPath);
  assert.equal(activeOnly.status, 200);
  assert.deepEqual(
    activeOnly.body.data.map((item) => item.document.documentId),
    ["document-a", "document-b"]
  );
  assert.ok(activeOnly.body.data.every((item) => item.grantStatus === "active"));

  const revokeTwice = await request(baseUrl, "DELETE", `${agentPath}/document-c`);
  assert.equal(revokeTwice.status, 200);
  assert.equal(revokeTwice.body.data.grantStatus, "revoked");

  const crossWorkspaceDocument = await request(
    baseUrl,
    "POST",
    `${agentPath}/document-other-workspace`
  );
  assert.equal(crossWorkspaceDocument.status, 403);
  assert.equal(crossWorkspaceDocument.body.error.code, "auth.forbidden");

  const crossWorkspaceAgent = await request(
    baseUrl,
    "POST",
    "/knowledge/agents/agent-b/documents/document-a"
  );
  assert.equal(crossWorkspaceAgent.status, 403);
  assert.equal(crossWorkspaceAgent.body.error.code, "auth.forbidden");
  assert.equal(
    crossWorkspaceAgent.body.error.message,
    crossWorkspaceDocument.body.error.message,
    "cross-workspace agent/document failures must not disclose existence"
  );

  for (const [method, path] of [
    ["POST", `${agentPath}/document-a`],
    ["DELETE", `${agentPath}/document-a`]
  ]) {
    const forbidden = await request(baseUrl, method, path, { role: "viewer" });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, "auth.forbidden");
  }

  const viewerList = await request(baseUrl, "GET", agentPath, { role: "viewer" });
  assert.equal(viewerList.status, 200, "workspace readers may list assignments");

  const unauthenticatedList = await request(baseUrl, "GET", agentPath, {
    authenticated: false
  });
  assert.equal(unauthenticatedList.status, 401);
  assert.equal(unauthenticatedList.body.error.code, "auth.unauthorized");

  assert.doesNotMatch(
    JSON.stringify([
      assigned.body,
      activeOnly.body,
      revoked.body,
      crossWorkspaceDocument.body
    ]),
    /storageKey|privateUrl|filePath|absolutePath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|apiKey|Bearer|queuePayload|stackTrace|accessGrantId/i
  );

  await request(
    baseUrl,
    "POST",
    "/knowledge/agents/agent-retrieval/documents/document-a"
  );
  await request(
    baseUrl,
    "DELETE",
    "/knowledge/agents/agent-retrieval/documents/document-a"
  );
  let embeddingCalls = 0;
  let vectorCalls = 0;
  const retrieval = new KnowledgeRetrievalSearchUseCase({
    documentRepository,
    accessPolicy,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        embeddingCalls += 1;
        return { workspaceId: input.workspaceId, embedding: [0.1] };
      }
    },
    vectorQueryAdapter: {
      async query() {
        vectorCalls += 1;
        return [];
      }
    }
  });
  const retrievalAfterRevoke = await retrieval.search(
    "workspace-a",
    { query: "company policy" },
    { agentId: "agent-retrieval" }
  );
  assert.deepEqual(retrievalAfterRevoke, { results: [], total: 0 });
  assert.equal(embeddingCalls, 0);
  assert.equal(vectorCalls, 0);
});

console.log("agent knowledge assignment API checks passed");

async function withApi(callback) {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    const authenticated = request.header("x-test-auth") !== "false";
    request.context = authenticated
      ? {
          requestId: "agent-knowledge-request",
          user: { userId: "user-a", email: "user@example.com" },
          workspace: {
            workspaceId: request.header("x-test-workspace") ?? "workspace-a",
            memberId: "member-a",
            role: request.header("x-test-role") ?? "admin"
          }
        }
      : { requestId: "agent-knowledge-request" };
    next();
  });
  app.use(
    createKnowledgeBaseRagRouter({
      documentUseCases: {},
      uploadUseCases: {},
      ingestionUseCases: {},
      dataSourceUseCases: {},
      syncUseCases: {},
      retrievalSearchUseCase: {},
      ragAnswerUseCase: {},
      accessPolicy,
      agentKnowledgeAssignmentUseCase: assignmentUseCase
    })
  );

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
  { authenticated = true, role = "admin", contextWorkspaceId = "workspace-a" } = {}
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-auth": String(authenticated),
      "x-test-role": role,
      "x-test-workspace": contextWorkspaceId
    }
  });
  return {
    status: response.status,
    body: await response.json()
  };
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
    storageKey: `/private/${workspaceId}/${documentId}.txt`,
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  };
}
