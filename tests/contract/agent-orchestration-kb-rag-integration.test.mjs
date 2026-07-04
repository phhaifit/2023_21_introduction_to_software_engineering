import assert from "node:assert/strict";

import {
  AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
  AgentKnowledgeOrchestrationUseCase
} from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-orchestration-use-case.ts";
import { AgentKnowledgeRetrievalTool } from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-retrieval-tool.ts";
import { KnowledgeBaseRagAccessPolicy } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-access-policy.ts";
import { KnowledgeRetrievalSearchUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import {
  InMemoryKnowledgeAccessGrantRepository,
  InMemoryKnowledgeDocumentRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

const workspaceId = "workspace-a";
const agentId = "agent-a";
const documentRepository = new InMemoryKnowledgeDocumentRepository();
const grantRepository = new InMemoryKnowledgeAccessGrantRepository();
const agents = new Set([
  "workspace-a:agent-a",
  "workspace-a:agent-ungranted",
  "workspace-a:agent-skill-only",
  "workspace-b:agent-cross"
]);

await seedDocument({
  workspaceId,
  documentId: "document-policy",
  chunkId: "chunk-policy",
  title: "sample-company-policy.txt",
  sourceType: "upload",
  text: "Equipment requests are reviewed within three business days. Contact Operations if a request is rejected."
});
await seedDocument({
  workspaceId,
  documentId: "document-private",
  chunkId: "chunk-private",
  title: "unassigned-policy.txt",
  sourceType: "notion",
  text: "Unassigned evidence must never ground an answer."
});
await seedDocument({
  workspaceId: "workspace-b",
  documentId: "document-other-workspace",
  chunkId: "chunk-other-workspace",
  title: "other-workspace.txt",
  sourceType: "upload",
  text: "Other workspace private evidence."
});

await grantRepository.saveAccessGrant(grant());
await grantRepository.saveAccessGrant(
  grant({
    knowledgeAccessGrantId: "grant-other-workspace",
    workspaceId: "workspace-b",
    documentId: "document-other-workspace"
  })
);

let embeddingCalls = 0;
let vectorCalls = 0;
let composerCalls = 0;
const vectorInputs = [];
const retrievalSearchUseCase = new KnowledgeRetrievalSearchUseCase({
  documentRepository,
  accessPolicy: new KnowledgeBaseRagAccessPolicy(grantRepository),
  queryEmbeddingAdapter: {
    async generateQueryEmbedding(input) {
      embeddingCalls += 1;
      return { workspaceId: input.workspaceId, embedding: [0.2, 0.4] };
    }
  },
  vectorQueryAdapter: {
    async query(input) {
      vectorCalls += 1;
      vectorInputs.push(input);
      return [
        match(workspaceId, "document-private", "chunk-private", 0.99),
        match("workspace-b", "document-other-workspace", "chunk-other-workspace", 0.98),
        match(workspaceId, "document-policy", "chunk-policy", 0.91)
      ];
    }
  }
});
const retrievalTool = new AgentKnowledgeRetrievalTool({
  retrievalSearchUseCase,
  agentLookup: {
    async existsInWorkspace(targetWorkspaceId, targetAgentId) {
      return agents.has(`${targetWorkspaceId}:${targetAgentId}`);
    }
  }
});
const orchestration = new AgentKnowledgeOrchestrationUseCase({
  knowledgeRetrievalTool: retrievalTool,
  responseComposer: {
    async compose({ evidence }) {
      composerCalls += 1;
      return evidence[0].snippet.split(".")[0] + ".";
    }
  }
});

const answered = await orchestration.ask(workspaceId, agentId, {
  message: "What is the equipment approval policy?",
  topK: 5
});
assert.equal(answered.status, "answered");
assert.equal(
  answered.answer,
  "Equipment requests are reviewed within three business days."
);
assert.equal(answered.citations.length, 1);
assert.deepEqual(
  {
    citationId: answered.citations[0].citationId,
    documentId: answered.citations[0].documentId,
    documentTitle: answered.citations[0].documentTitle,
    sourceType: answered.citations[0].sourceType
  },
  {
    citationId: "E1",
    documentId: "document-policy",
    documentTitle: "sample-company-policy.txt",
    sourceType: "upload"
  }
);
assertSafeResponse(answered);

const beforeNoGrant = calls();
const noGrant = await orchestration.ask(workspaceId, "agent-ungranted", {
  message: "What is the equipment policy?"
});
assertFallback(noGrant);
assert.deepEqual(calls(), beforeNoGrant);

await grantRepository.saveAccessGrant(
  grant({ status: "revoked", updatedAt: "2026-07-04T00:01:00.000Z" })
);
const beforeRevoked = calls();
const revoked = await orchestration.ask(workspaceId, agentId, {
  message: "What is the equipment policy?"
});
assertFallback(revoked);
assert.deepEqual(calls(), beforeRevoked);

await grantRepository.saveAccessGrant(
  grant({ updatedAt: "2026-07-04T00:02:00.000Z" })
);
const filtered = await orchestration.ask(workspaceId, agentId, {
  message: "policy",
  filters: {
    documentIds: ["document-policy", "document-private"]
  }
});
assert.equal(filtered.status, "answered");
assert.deepEqual(vectorInputs.at(-1).documentIds, ["document-policy"]);

const beforeSkillOnly = calls();
const skillReference = { requestedKnowledge: ["document-policy"] };
const skillOnly = await orchestration.ask(workspaceId, "agent-skill-only", {
  message: "policy",
  filters: { documentIds: skillReference.requestedKnowledge }
});
assertFallback(skillOnly);
assert.deepEqual(calls(), beforeSkillOnly);

const beforeCrossWorkspace = calls();
const crossWorkspace = await orchestration.ask(
  workspaceId,
  "agent-cross",
  { message: "policy" }
);
assert.deepEqual(crossWorkspace, {
  status: "unauthorized",
  answer: "",
  citations: [],
  warnings: ["Agent knowledge access is unavailable."]
});
assert.deepEqual(calls(), beforeCrossWorkspace);

const beforeInvalid = calls();
const invalid = await orchestration.ask(workspaceId, agentId, {
  message: "   "
});
assert.equal(invalid.status, "invalid_request");
assert.equal(invalid.answer, "");
assert.deepEqual(calls(), beforeInvalid);
assertSafeResponse(invalid);

assert.equal(composerCalls, 2);
assert.ok(answered.citations[0].snippet.length <= 400);
console.log("agent orchestration KB/RAG integration checks passed");

async function seedDocument({
  workspaceId: targetWorkspaceId,
  documentId,
  chunkId,
  title,
  sourceType,
  text
}) {
  await documentRepository.saveDocument({
    documentId,
    workspaceId: targetWorkspaceId,
    uploadedByUserId: "user-a",
    displayName: title,
    fileName: title,
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: text.length,
    sourceType,
    storageKey: `/private/${targetWorkspaceId}/${documentId}.txt`,
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  });
  await documentRepository.saveDocumentChunk({
    chunkId,
    workspaceId: targetWorkspaceId,
    documentId,
    chunkIndex: 0,
    contentText: text,
    embeddingStatus: "ready",
    vectorRef: `private-vector-${chunkId}`,
    sourceLocator: "text:0",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  });
}

function grant(overrides = {}) {
  return {
    knowledgeAccessGrantId: "grant-policy",
    workspaceId,
    documentId: "document-policy",
    agentId,
    status: "active",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...overrides
  };
}

function match(targetWorkspaceId, documentId, chunkId, score) {
  return {
    workspaceId: targetWorkspaceId,
    documentId,
    chunkId,
    chunkIndex: 0,
    score,
    metadata: { sourceLocator: "text:0" }
  };
}

function calls() {
  return { embeddingCalls, vectorCalls, composerCalls };
}

function assertFallback(value) {
  assert.deepEqual(value, {
    status: "insufficient_evidence",
    answer: AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
    citations: [],
    warnings: ["insufficient_evidence"]
  });
  assertSafeResponse(value);
}

function assertSafeResponse(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|systemPrompt|queuePayload|workerPayload|toolPayload|toolRuntime|runtimeInternals|stackTrace|apiKey|Bearer|credential|secret/i
  );
  for (const citation of value.citations) {
    assert.ok(citation.snippet.length <= 400);
  }
}
