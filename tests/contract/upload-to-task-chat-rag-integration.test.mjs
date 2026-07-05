import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import express from "express";

import { AgentKnowledgeAssignmentUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-assignment-use-case.ts";
import {
  AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
  AgentKnowledgeOrchestrationUseCase
} from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-orchestration-use-case.ts";
import { AgentKnowledgeRetrievalTool } from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-retrieval-tool.ts";
import { KnowledgeBaseRagAccessPolicy } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-access-policy.ts";
import { KnowledgeRetrievalSearchUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import { KnowledgeUploadUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import {
  InMemoryKnowledgeAccessGrantRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { RuntimeKnowledgeDocumentTextExtractor } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/knowledge-document-text-extractor.ts";
import { LocalKnowledgeFileStorage } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";
import { StoredKnowledgeDocumentContentReader } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/stored-knowledge-document-content-reader.ts";
import { createKnowledgeBaseRagLocalFlowRunner } from "@vcp/backend/modules/knowledge-base-rag/worker/knowledge-base-rag-local-flow-runner.ts";
import { createTaskOrchestrationRouter } from "@vcp/backend/modules/task-orchestration/api/task-orchestration-router.ts";

const storageRoot = await mkdtemp(join(tmpdir(), "kb-rag-task-chat-"));

try {
  await verifyUploadToTaskChatRagFlow();
  console.log("upload-to-task-chat RAG integration checks passed");
} finally {
  await rm(storageRoot, { recursive: true, force: true });
}

async function verifyUploadToTaskChatRagFlow() {
  const runtime = createRuntime();
  const policyDocumentId = await uploadPolicyDocument(runtime);
  const unassignedDocumentId = await uploadDocument(runtime, {
    workspaceId: "workspace-a",
    clientFileId: "unassigned-policy",
    fileName: "unassigned-policy.txt",
    content:
      "Private travel policy: executive airfare rules are not assigned to this agent."
  });
  const workspaceBDocumentId = await uploadDocument(runtime, {
    workspaceId: "workspace-b",
    clientFileId: "workspace-b-policy",
    fileName: "workspace-b-policy.txt",
    content:
      "Workspace B policy: private records must not answer workspace A requests."
  });

  assert.notEqual(policyDocumentId, unassignedDocumentId);
  assert.notEqual(policyDocumentId, workspaceBDocumentId);
  assert.ok(runtime.embeddingCalls.length >= 3);
  assert.ok(runtime.vectorRecords.length >= 3);
  assert.equal(runtime.vectorRecords.length, runtime.vectorUpsertCalls.length);

  const policyChunks = await runtime.documentRepository.listDocumentChunks(
    "workspace-a",
    policyDocumentId
  );
  assert.ok(policyChunks.total >= 1);
  assert.ok(policyChunks.items.every((chunk) => chunk.embeddingStatus === "ready"));

  const assigned = await runtime.assignmentUseCase.assignDocument(
    "workspace-a",
    "agent-a",
    policyDocumentId,
    "admin"
  );
  assert.equal(assigned.grantStatus, "active");
  assert.equal(assigned.document.documentId, policyDocumentId);
  assertSafe(assigned);

  await withTaskChatApi(runtime, async (post) => {
    const answered = await post("workspace-a", {
      agentId: "agent-a",
      message: "What approval is required for equipment purchases over 500 USD?",
      topK: 5
    });
    assert.equal(answered.status, 200);
    assert.equal(answered.body.data.status, "answered");
    assert.match(answered.body.data.answer, /manager approval/i);
    assert.ok(answered.body.data.citations.length > 0);
    assert.equal(answered.body.data.citations[0].documentId, policyDocumentId);
    assert.equal(
      answered.body.data.citations[0].documentTitle,
      "equipment-approval-policy.txt"
    );
    assert.equal(answered.body.data.citations[0].sourceType, "upload");
    assert.match(answered.body.data.citations[0].snippet, /over 500 USD/i);
    assert.ok(answered.body.data.citations[0].snippet.length <= 400);
    assertSafe(answered.body);
    assert.ok(runtime.composerCalls.length >= 1);

    const callsAfterAnswered = callCounts(runtime);
    const unassigned = await post("workspace-a", {
      agentId: "agent-unassigned",
      message:
        "What approval is required for equipment purchases over 500 USD?",
      topK: 5
    });
    assertFallback(unassigned);
    assert.deepEqual(callCounts(runtime), callsAfterAnswered);

    const crossWorkspace = await post("workspace-b", {
      agentId: "agent-a",
      message:
        "What approval is required for equipment purchases over 500 USD?",
      topK: 5
    });
    assert.equal(crossWorkspace.status, 200);
    assert.equal(crossWorkspace.body.data.status, "unauthorized");
    assert.equal(crossWorkspace.body.data.answer, "");
    assert.deepEqual(crossWorkspace.body.data.citations, []);
    assertSafe(crossWorkspace.body);
    assert.deepEqual(callCounts(runtime), callsAfterAnswered);

    await runtime.assignmentUseCase.revokeDocument(
      "workspace-a",
      "agent-a",
      policyDocumentId,
      "admin"
    );
    const revoked = await post("workspace-a", {
      agentId: "agent-a",
      message:
        "What approval is required for equipment purchases over 500 USD?",
      topK: 5
    });
    assertFallback(revoked);
    assert.deepEqual(callCounts(runtime), callsAfterAnswered);
  });
}

async function uploadPolicyDocument(runtime) {
  return uploadDocument(runtime, {
    workspaceId: "workspace-a",
    clientFileId: "equipment-approval",
    fileName: "equipment-approval-policy.txt",
    content:
      "Equipment approval policy: All equipment purchases over 500 USD require manager approval. Emergency replacement requests must include the incident ticket ID."
  });
}

async function uploadDocument(runtime, { workspaceId, clientFileId, fileName, content }) {
  const upload = await runtime.uploadUseCases.uploadDocuments(
    workspaceId,
    "user-a",
    [
      {
        clientFileId,
        fileName,
        mediaType: "text/plain",
        content: new TextEncoder().encode(content)
      }
    ]
  );

  assert.equal(upload.documents[0].status, "ready");
  assert.equal(upload.ingestionJobs[0].status, "ready");
  assertSafe(upload);
  return upload.documents[0].documentId;
}

function createRuntime() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const accessGrantRepository = new InMemoryKnowledgeAccessGrantRepository();
  const accessPolicy = new KnowledgeBaseRagAccessPolicy(accessGrantRepository);
  const fileStorage = new LocalKnowledgeFileStorage(storageRoot);
  const agents = new Set([
    "workspace-a:agent-a",
    "workspace-a:agent-unassigned",
    "workspace-b:agent-b"
  ]);
  const embeddingCalls = [];
  const queryEmbeddingCalls = [];
  const vectorUpsertCalls = [];
  const vectorQueryCalls = [];
  const vectorRecords = [];
  const composerCalls = [];
  let sequence = 0;
  let documentSequence = 0;
  let jobSequence = 0;
  let grantSequence = 0;
  const now = () =>
    new Date(Date.UTC(2026, 6, 4, 0, 0, sequence++)).toISOString();
  const agentLookup = {
    async existsInWorkspace(workspaceId, agentId) {
      return agents.has(`${workspaceId}:${agentId}`);
    }
  };

  const runner = createKnowledgeBaseRagLocalFlowRunner({
    documentRepository,
    ingestionJobRepository,
    contentReader: new StoredKnowledgeDocumentContentReader(
      fileStorage,
      new RuntimeKnowledgeDocumentTextExtractor()
    ),
    embeddingAdapter: {
      async generateEmbedding(input) {
        embeddingCalls.push(input);
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          embedding: [1, 0, 0]
        };
      }
    },
    vectorIndexAdapter: {
      async upsertChunkEmbedding(input) {
        vectorUpsertCalls.push(input);
        const vectorRef = `internal-vector-${input.workspaceId}-${input.chunkId}`;
        const record = { ...input, vectorRef };
        vectorRecords.push(record);
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef
        };
      }
    },
    now,
    generateChunkId: ({ documentId, chunkIndex }) =>
      `${documentId}:chunk:${chunkIndex}`,
    generateEventId: () => `event-${sequence}`
  });

  const uploadUseCases = new KnowledgeUploadUseCases({
    documentRepository,
    ingestionJobRepository,
    fileStorage,
    now,
    generateDocumentId: () => `document-${++documentSequence}`,
    generateJobId: () => `job-${++jobSequence}`,
    postUploadProcessor: {
      async process(input) {
        const result = await runner.run(input);
        return { document: result.document, job: result.job };
      }
    }
  });

  const retrievalSearchUseCase = new KnowledgeRetrievalSearchUseCase({
    documentRepository,
    accessPolicy,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        queryEmbeddingCalls.push(input);
        return { workspaceId: input.workspaceId, embedding: [1, 0, 0] };
      }
    },
    vectorQueryAdapter: {
      async query(input) {
        vectorQueryCalls.push(input);
        return vectorRecords
          .filter((record) => record.workspaceId === input.workspaceId)
          .filter(
            (record) =>
              !input.documentIds || input.documentIds.includes(record.documentId)
          )
          .filter(
            (record) =>
              !input.sourceTypes ||
              input.sourceTypes.includes(record.metadata?.sourceType)
          )
          .slice(0, input.topK)
          .map((record, index) => ({
            workspaceId: record.workspaceId,
            documentId: record.documentId,
            chunkId: record.chunkId,
            chunkIndex: record.chunkIndex,
            score: 0.99 - index * 0.01,
            metadata: { sourceLocator: record.metadata?.sourceLocator }
          }));
      }
    }
  });

  const knowledgeRetrievalTool = new AgentKnowledgeRetrievalTool({
    retrievalSearchUseCase,
    agentLookup
  });
  const orchestrationUseCase = new AgentKnowledgeOrchestrationUseCase({
    knowledgeRetrievalTool,
    responseComposer: {
      async compose(input) {
        composerCalls.push(input);
        return input.evidence[0]?.snippet.split(".")[0] ?? "";
      }
    }
  });
  const assignmentUseCase = new AgentKnowledgeAssignmentUseCase({
    accessGrantRepository,
    documentRepository,
    agentLookup,
    accessPolicy,
    now,
    generateGrantId: () => `grant-${++grantSequence}`
  });

  return {
    assignmentUseCase,
    composerCalls,
    documentRepository,
    embeddingCalls,
    queryEmbeddingCalls,
    uploadUseCases,
    vectorQueryCalls,
    vectorRecords,
    vectorUpsertCalls,
    agentKnowledgeAskPort: orchestrationUseCase
  };
}

async function withTaskChatApi(runtime, callback) {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    const workspaceId = request.header("x-test-workspace") ?? "workspace-a";
    request.context = {
      requestId: "upload-to-task-chat-rag-test",
      user: { userId: "user-a", email: "user@example.com" },
      workspace: {
        workspaceId,
        memberId: `member-${workspaceId}`,
        role: "admin"
      }
    };
    next();
  });
  app.use(
    "/api/workspaces/:workspaceId",
    createTaskOrchestrationRouter({
      orchestrator: {},
      adapter: {},
      conversationRepository: {},
      createTaskUseCase: {},
      agentKnowledgeAskPort: runtime.agentKnowledgeAskPort
    })
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(async (workspaceId, body) => {
      const response = await fetch(
        `${baseUrl}/api/workspaces/${workspaceId}/tasks/agent-knowledge/ask`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-workspace": workspaceId
          },
          body: JSON.stringify(body)
        }
      );
      return { status: response.status, body: await response.json() };
    });
  } finally {
    server.close();
    await once(server, "close");
  }
}

function callCounts(runtime) {
  return {
    composerCalls: runtime.composerCalls.length,
    queryEmbeddingCalls: runtime.queryEmbeddingCalls.length,
    vectorQueryCalls: runtime.vectorQueryCalls.length
  };
}

function assertFallback(response) {
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    status: "insufficient_evidence",
    answer: AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
    citations: [],
    warnings: ["insufficient_evidence"]
  });
  assertSafe(response.body);
}

function assertSafe(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|systemPrompt|developerPrompt|queuePayload|workerPayload|toolPayload|toolRuntime|runtimeInternals|stackTrace|apiKey|Bearer|credential|secret/i
  );
}
