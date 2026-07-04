import assert from "node:assert/strict";

import {
  AGENT_KNOWLEDGE_RETRIEVAL_TOOL_NAME,
  AgentKnowledgeRetrievalTool,
  MAX_AGENT_TOOL_SNIPPET_LENGTH
} from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-retrieval-tool.ts";
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
const accessPolicy = new KnowledgeBaseRagAccessPolicy(grantRepository);
const agents = new Set([
  "workspace-a:agent-a",
  "workspace-a:agent-ungranted",
  "workspace-a:agent-skill-only",
  "workspace-b:agent-cross-workspace"
]);
const longText =
  "Equipment requests are reviewed within three business days. ".repeat(14);

await seedDocument({
  workspaceId,
  documentId: "document-a",
  chunkId: "chunk-a",
  title: "sample-company-policy.txt",
  sourceType: "upload",
  contentText: longText
});
await seedDocument({
  workspaceId,
  documentId: "document-ungranted",
  chunkId: "chunk-ungranted",
  title: "private-policy.txt",
  sourceType: "notion",
  contentText: "This document is not assigned to the agent."
});
await seedDocument({
  workspaceId: "workspace-b",
  documentId: "document-b",
  chunkId: "chunk-b",
  title: "other-workspace.txt",
  sourceType: "upload",
  contentText: "Other workspace evidence."
});

await grantRepository.saveAccessGrant(
  grant({ knowledgeAccessGrantId: "grant-a" })
);
await grantRepository.saveAccessGrant(
  grant({
    knowledgeAccessGrantId: "grant-cross-workspace",
    workspaceId: "workspace-b",
    documentId: "document-b"
  })
);

let embeddingCalls = 0;
let vectorCalls = 0;
const vectorInputs = [];
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
      vectorInputs.push(input);
      return [
        match("workspace-a", "document-ungranted", "chunk-ungranted", 0.99),
        match("workspace-b", "document-b", "chunk-b", 0.98),
        match("workspace-a", "document-a", "chunk-a", 0.9)
      ];
    }
  }
});
const tool = new AgentKnowledgeRetrievalTool({
  retrievalSearchUseCase: retrieval,
  agentLookup: {
    async existsInWorkspace(targetWorkspaceId, targetAgentId) {
      return agents.has(`${targetWorkspaceId}:${targetAgentId}`);
    }
  }
});

assert.equal(AGENT_KNOWLEDGE_RETRIEVAL_TOOL_NAME, "knowledge.retrieve");

const found = await tool.execute({
  workspaceId,
  agentId,
  query: "What is the equipment approval policy?",
  topK: 5
});
assert.equal(found.status, "found");
assert.equal(found.evidence.length, 1);
assert.deepEqual(
  {
    citationId: found.evidence[0].citationId,
    documentId: found.evidence[0].documentId,
    documentTitle: found.evidence[0].documentTitle,
    sourceType: found.evidence[0].sourceType,
    sourceLocator: found.evidence[0].sourceLocator
  },
  {
    citationId: "E1",
    documentId: "document-a",
    documentTitle: "sample-company-policy.txt",
    sourceType: "upload",
    sourceLocator: "text:0"
  }
);
assert.ok(found.evidence[0].snippet.length <= MAX_AGENT_TOOL_SNIPPET_LENGTH);
assert.ok(found.evidence[0].snippet.length > 0);
assertSafeToolOutput(found);

const beforeUngraded = calls();
const ungranted = await tool.execute({
  workspaceId,
  agentId: "agent-ungranted",
  query: "policy"
});
assert.deepEqual(ungranted, { status: "empty", evidence: [], warnings: [] });
assert.deepEqual(calls(), beforeUngraded);

await grantRepository.saveAccessGrant(
  grant({
    knowledgeAccessGrantId: "grant-a",
    status: "revoked",
    updatedAt: "2026-07-04T00:01:00.000Z"
  })
);
const beforeRevoked = calls();
const revoked = await tool.execute({ workspaceId, agentId, query: "policy" });
assert.equal(revoked.status, "empty");
assert.deepEqual(calls(), beforeRevoked);

await grantRepository.saveAccessGrant(
  grant({
    knowledgeAccessGrantId: "grant-a",
    updatedAt: "2026-07-04T00:02:00.000Z"
  })
);
const reactivated = await tool.execute({
  workspaceId,
  agentId,
  query: "policy"
});
assert.equal(reactivated.status, "found");

const filtered = await tool.execute({
  workspaceId,
  agentId,
  query: "policy",
  filters: {
    documentIds: ["document-a", "document-ungranted"]
  }
});
assert.equal(filtered.status, "found");
assert.deepEqual(vectorInputs.at(-1).documentIds, ["document-a"]);

const sourceFiltered = await tool.execute({
  workspaceId,
  agentId,
  query: "policy",
  filters: { sourceTypes: ["notion"] }
});
assert.equal(sourceFiltered.status, "empty");
assert.deepEqual(vectorInputs.at(-1).documentIds, ["document-a"]);

const beforeSkillReference = calls();
const skillReferenceOnly = {
  agentId: "agent-skill-only",
  requestedKnowledge: [{ documentId: "document-a" }]
};
const skillOnly = await tool.execute({
  workspaceId,
  agentId: skillReferenceOnly.agentId,
  query: "policy",
  filters: { documentIds: [skillReferenceOnly.requestedKnowledge[0].documentId] }
});
assert.equal(skillOnly.status, "empty");
assert.deepEqual(calls(), beforeSkillReference);

const beforeCrossWorkspace = calls();
const crossWorkspace = await tool.execute({
  workspaceId,
  agentId: "agent-cross-workspace",
  query: "policy"
});
assert.deepEqual(crossWorkspace, {
  status: "unauthorized",
  evidence: [],
  warnings: ["Agent knowledge access is unavailable."]
});
assert.deepEqual(calls(), beforeCrossWorkspace);

const invalid = await tool.execute({
  workspaceId,
  agentId,
  query: "   "
});
assert.deepEqual(invalid, {
  status: "invalid_request",
  evidence: [],
  warnings: ["Agent knowledge retrieval input is invalid."]
});
assertSafeToolOutput(invalid);

console.log("agent knowledge retrieval tool checks passed");

async function seedDocument({
  workspaceId: targetWorkspaceId,
  documentId,
  chunkId,
  title,
  sourceType,
  contentText
}) {
  await documentRepository.saveDocument({
    documentId,
    workspaceId: targetWorkspaceId,
    uploadedByUserId: "user-a",
    displayName: title,
    fileName: title,
    mimeType: "text/plain",
    fileType: "txt",
    sizeBytes: contentText.length,
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
    contentText,
    embeddingStatus: "ready",
    vectorRef: `private-vector-${chunkId}`,
    sourceLocator: "text:0",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  });
}

function grant(overrides = {}) {
  return {
    knowledgeAccessGrantId: "grant-a",
    workspaceId,
    documentId: "document-a",
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
  return { embeddingCalls, vectorCalls };
}

function assertSafeToolOutput(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|queuePayload|workerPayload|runtimeInternals|stackTrace|apiKey|Bearer|credential|secret/i
  );
  for (const item of value.evidence) {
    assert.ok(item.snippet.length <= MAX_AGENT_TOOL_SNIPPET_LENGTH);
  }
}
