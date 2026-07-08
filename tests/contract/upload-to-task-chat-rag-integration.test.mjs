import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import express from "express";

import { createKnowledgeBaseRagRouter } from "@vcp/backend/modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import { AgentKnowledgeAssignmentUseCase } from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-assignment-use-case.ts";
import {
  AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
  AgentKnowledgeOrchestrationUseCase
} from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-orchestration-use-case.ts";
import { AgentKnowledgeRetrievalTool } from "@vcp/backend/modules/knowledge-base-rag/application/agent-knowledge-retrieval-tool.ts";
import { isKnowledgeEvidenceAnswerable } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-answerability.ts";
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
  const hrDocumentId = await uploadDocument(runtime, {
    workspaceId: "workspace-a",
    clientFileId: "hr-policy",
    fileName: "01_hr_policy.txt",
    content:
      "Chinh sach nhan su noi bo - Workspace Demo.\n\nNhan vien duoc nghi phep nam toi da 12 ngay lam viec moi nam.\nNeu muon nghi phep, nhan vien phai gui yeu cau truoc it nhat 3 ngay lam viec.\nTu khoa kiem thu: HR-POLICY-ALPHA."
  });
  const salesDocumentId = await uploadDocument(runtime, {
    workspaceId: "workspace-a",
    clientFileId: "sales-guide",
    fileName: "02_sales_guide.md",
    mediaType: "text/markdown",
    content:
      "# Sales Guide - Workspace Demo\n\nKhach hang doanh nghiep duoc ap dung muc chiet khau tieu chuan la 8%.\n\nNeu muc chiet khau de xuat vuot qua 12%, Sales Agent phai xin phe duyet tu Sales Manager.\n\nTu khoa kiem thu: SALES-GUIDE-BETA."
  });
  const productDocumentId = await uploadDocument(runtime, {
    workspaceId: "workspace-a",
    clientFileId: "product-catalog",
    fileName: "03_product_catalog.csv",
    mediaType: "text/csv",
    content:
      "product_code,product_name,category,monthly_price_vnd,warranty_months,note\nVCP-STD,Virtual Company Standard,Subscription,990000,0,Goi tieu chuan cho nhom nho\nVCP-PRO,Virtual Company Pro,Subscription,2490000,0,Goi nang cao cho team can nhieu agent\nAGENT-ADDON,Additional Agent Add-on,Add-on,300000,0,Them mot agent hoat dong trong workspace"
  });
  const financeDocumentId = await uploadDocument(runtime, {
    workspaceId: "workspace-a",
    clientFileId: "finance-approval",
    fileName: "04_finance_approval_policy.docx",
    mediaType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    content: createDocx([
      "Finance Approval Policy - Workspace Demo.",
      "Tai lieu nay mo ta quy tac phe duyet chi phi noi bo.",
      "Cac khoan chi tren 500 USD can phe duyet boi Finance Manager.",
      "Cac khoan chi tren 2000 USD can them phe duyet cua Workspace Admin.",
      "Tu khoa kiem thu: FINANCE-APPROVAL-GAMMA."
    ])
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

  await withTaskChatApi(runtime, async (api) => {
    const assigned = await api.assign("workspace-a", "agent-a", policyDocumentId);
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.grantStatus, "active");
    assert.equal(assigned.body.data.document.documentId, policyDocumentId);
    assertSafe(assigned.body);

    const answered = await api.ask("workspace-a", {
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

    const callsAfterAnswered = callCounts(runtime);
    const unassigned = await api.ask("workspace-a", {
      agentId: "agent-unassigned",
      message:
        "What approval is required for equipment purchases over 500 USD?",
      topK: 5
    });
    assertFallback(unassigned);
    assert.deepEqual(callCounts(runtime), callsAfterAnswered);

    const crossWorkspace = await api.ask("workspace-b", {
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

    const policyRevoke = await api.revoke("workspace-a", "agent-a", policyDocumentId);
    assert.equal(policyRevoke.status, 200);
    assert.equal(policyRevoke.body.data.grantStatus, "revoked");
    const revoked = await api.ask("workspace-a", {
      agentId: "agent-a",
      message:
        "What approval is required for equipment purchases over 500 USD?",
      topK: 5
    });
    assertFallback(revoked);
    assert.deepEqual(callCounts(runtime), callsAfterAnswered);

    await assignOnlyViaApi(api, "agent-a", [hrDocumentId]);
    const hrAnswer = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Nhan vien muon nghi phep phai bao truoc bao nhieu ngay?",
      topK: 5
    });
    assert.equal(hrAnswer.status, 200);
    assert.equal(
      hrAnswer.body.data.status,
      "answered",
      await diagnosticMessage(
        runtime,
        "agent-a",
        "Nhan vien muon nghi phep phai bao truoc bao nhieu ngay?"
      )
    );
    assert.match(hrAnswer.body.data.answer, /3 ngay lam viec/i);
    assert.deepEqual(citationTitles(hrAnswer), ["01_hr_policy.txt"]);

    const hrOnlySalesQuestion = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?",
      topK: 5
    });
    assertFallback(hrOnlySalesQuestion);
    const hrOnlyDebug = await api.debugAsk("workspace-a", {
      agentId: "agent-a",
      message: "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?",
      topK: 5
    });
    assertDebugTrace(hrOnlyDebug, ["01_hr_policy.txt"], [], []);

    await assignOnlyViaApi(api, "agent-a", [salesDocumentId]);
    const salesAnswer = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?",
      topK: 5
    });
    assert.equal(salesAnswer.status, 200);
    assert.equal(
      salesAnswer.body.data.status,
      "answered",
      await diagnosticMessage(
        runtime,
        "agent-a",
        "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?"
      )
    );
    assert.match(salesAnswer.body.data.answer, /8%/);
    assert.deepEqual(citationTitles(salesAnswer), ["02_sales_guide.md"]);
    assert.doesNotMatch(salesAnswer.body.data.answer, /nghi phep|3 ngay/i);

    await assignOnlyViaApi(api, "agent-a", [productDocumentId]);
    const productOnlyHr = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Nhan vien muon nghi phep phai bao truoc bao nhieu ngay?",
      topK: 5
    });
    assertFallback(productOnlyHr);

    const productAnswer = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Goi Virtual Company Pro co gia bao nhieu moi thang?",
      topK: 5
    });
    assert.equal(productAnswer.status, 200);
    assert.equal(
      productAnswer.body.data.status,
      "answered",
      await diagnosticMessage(
        runtime,
        "agent-a",
        "Goi Virtual Company Pro co gia bao nhieu moi thang?"
      )
    );
    assert.match(productAnswer.body.data.answer, /2\.490\.000 VND|2490000/);
    assert.deepEqual(citationTitles(productAnswer), ["03_product_catalog.csv"]);
    assert.doesNotMatch(
      productAnswer.body.data.answer,
      /monthly_price_vnd|VCP-STD|AGENT-ADDON|product_code/i
    );

    await assignOnlyViaApi(api, "agent-a", [financeDocumentId]);
    const financeAnswer = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Cac khoan chi tren 500 USD can ai phe duyet?",
      topK: 5
    });
    assert.equal(financeAnswer.status, 200);
    assert.equal(
      financeAnswer.body.data.status,
      "answered",
      await diagnosticMessage(
        runtime,
        "agent-a",
        "Cac khoan chi tren 500 USD can ai phe duyet?"
      )
    );
    assert.match(financeAnswer.body.data.answer, /Finance Manager/i);
    assert.deepEqual(citationTitles(financeAnswer), [
      "04_finance_approval_policy.docx"
    ]);

    await assignOnlyViaApi(api, "agent-a", [
      hrDocumentId,
      salesDocumentId,
      productDocumentId,
      financeDocumentId
    ]);
    const mixedSalesAnswer = await api.ask("workspace-a", {
      agentId: "agent-a",
      message: "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?",
      topK: 5
    });
    assert.equal(mixedSalesAnswer.status, 200);
    assert.equal(
      mixedSalesAnswer.body.data.status,
      "answered",
      await diagnosticMessage(
        runtime,
        "agent-a",
        "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?"
      )
    );
    assert.match(mixedSalesAnswer.body.data.answer, /8%/);
    assert.deepEqual(citationTitles(mixedSalesAnswer), ["02_sales_guide.md"]);
    assert.doesNotMatch(
      mixedSalesAnswer.body.data.answer,
      /monthly_price_vnd|VCP-STD|VCP-PRO|nghi phep|Finance Manager/i
    );
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

async function uploadDocument(
  runtime,
  { workspaceId, clientFileId, fileName, content, mediaType = "text/plain" }
) {
  const upload = await runtime.uploadUseCases.uploadDocuments(
    workspaceId,
    "user-a",
    [
      {
        clientFileId,
        fileName,
        mediaType,
        content:
          content instanceof Uint8Array
            ? content
            : new TextEncoder().encode(content)
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
    diagnostics: {
      async listAssignedDocuments(workspaceId, agentId) {
        const documentIds = await accessPolicy.listAgentDocumentIds(
          workspaceId,
          agentId
        );
        const documents = await Promise.all(
          documentIds.map((documentId) =>
            documentRepository.getDocumentById(workspaceId, documentId)
          )
        );
        return documents
          .filter((document) => document && !document.deletedAt)
          .map((document) => ({
            documentId: document.documentId,
            documentTitle: document.displayName || document.fileName
          }));
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
    accessPolicy,
    assignmentUseCase,
    documentRepository,
    embeddingCalls,
    knowledgeRetrievalTool,
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
    createKnowledgeBaseRagRouter({
      documentUseCases: {},
      uploadUseCases: {},
      ingestionUseCases: {},
      dataSourceUseCases: {},
      syncUseCases: {},
      retrievalSearchUseCase: {},
      ragAnswerUseCase: {},
      agentKnowledgeAssignmentUseCase: runtime.assignmentUseCase,
      accessPolicy: runtime.accessPolicy
    })
  );
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
    await callback({
      ask: (workspaceId, body) =>
        requestJson(
          baseUrl,
          workspaceId,
          "POST",
          `/api/workspaces/${workspaceId}/tasks/agent-knowledge/ask`,
          body
        ),
      debugAsk: (workspaceId, body) =>
        requestDebugJson(baseUrl, workspaceId, body),
      assign: (workspaceId, agentId, documentId) =>
        requestJson(
          baseUrl,
          workspaceId,
          "POST",
          `/api/workspaces/${workspaceId}/knowledge/agents/${agentId}/documents/${documentId}`
        ),
      revoke: (workspaceId, agentId, documentId) =>
        requestJson(
          baseUrl,
          workspaceId,
          "DELETE",
          `/api/workspaces/${workspaceId}/knowledge/agents/${agentId}/documents/${documentId}`
        ),
      listAssigned: (workspaceId, agentId) =>
        requestJson(
          baseUrl,
          workspaceId,
          "GET",
          `/api/workspaces/${workspaceId}/knowledge/agents/${agentId}/documents`
        )
    });
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function requestDebugJson(baseUrl, workspaceId, body) {
  const previousTrace = process.env.KB_RAG_TRACE;
  process.env.KB_RAG_TRACE = "1";
  try {
    return await requestJson(
      baseUrl,
      workspaceId,
      "POST",
      `/api/workspaces/${workspaceId}/tasks/agent-knowledge/debug-ask`,
      body
    );
  } finally {
    if (previousTrace === undefined) {
      delete process.env.KB_RAG_TRACE;
    } else {
      process.env.KB_RAG_TRACE = previousTrace;
    }
  }
}

async function requestJson(baseUrl, workspaceId, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-workspace": workspaceId
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
}

function callCounts(runtime) {
  return {
    queryEmbeddingCalls: runtime.queryEmbeddingCalls.length,
    vectorQueryCalls: runtime.vectorQueryCalls.length
  };
}

function citationTitles(response) {
  return response.body.data.citations.map((citation) => citation.documentTitle);
}

async function assignOnlyViaApi(api, agentId, documentIds) {
  const current = await api.listAssigned("workspace-a", agentId);
  assert.equal(current.status, 200);
  for (const assignment of current.body.data) {
    if (!documentIds.includes(assignment.document.documentId)) {
      const revoked = await api.revoke(
        "workspace-a",
        agentId,
        assignment.document.documentId
      );
      assert.equal(revoked.status, 200);
      assert.equal(revoked.body.data.grantStatus, "revoked");
    }
  }

  for (const documentId of documentIds) {
    const assigned = await api.assign("workspace-a", agentId, documentId);
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.grantStatus, "active");
    assert.equal(assigned.body.data.document.documentId, documentId);
  }

  const next = await api.listAssigned("workspace-a", agentId);
  assert.equal(next.status, 200);
  assert.deepEqual(
    next.body.data.map((assignment) => assignment.document.documentId),
    documentIds
  );
}

function assertDebugTrace(response, assignedTitles, filteredTitles, citationTitles) {
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.assignedDocuments.map((document) => document.documentTitle),
    assignedTitles
  );
  assert.deepEqual(
    response.body.data.filteredEvidence.map((evidence) => evidence.documentTitle),
    filteredTitles
  );
  assert.deepEqual(
    response.body.data.citations.map((citation) => citation.documentTitle),
    citationTitles
  );
  assert.ok(
    response.body.data.answerability.every(
      (item) => typeof item.reason === "string" && item.reason.length > 0
    )
  );
}

async function diagnosticMessage(runtime, agentId, message) {
  const assignments = await runtime.assignmentUseCase.listAssignedDocuments(
    "workspace-a",
    agentId,
    "admin"
  );
  const retrieval = await runtime.knowledgeRetrievalTool.execute({
    workspaceId: "workspace-a",
    agentId,
    query: message,
    topK: 5
  });
  return JSON.stringify(
    {
      assignedDocumentTitles: assignments.map((assignment) => assignment.document.name),
      retrievalStatus: retrieval.status,
      retrievedEvidence:
        retrieval.status === "found"
          ? retrieval.evidence.map((item) => ({
              documentTitle: item.documentTitle,
              score: item.score,
              answerable: isKnowledgeEvidenceAnswerable({
                query: message,
                evidenceTitle: item.documentTitle,
                evidenceText: item.snippet,
                score: item.score
              }),
              snippet: item.snippet
            }))
          : []
    },
    null,
    2
  );
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

function createDocx(paragraphs) {
  const documentXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    "<w:body>",
    ...paragraphs.map(
      (text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`
    ),
    "</w:body></w:document>"
  ].join("");
  return createZip([
    {
      name: "[Content_Types].xml",
      data:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>"
    },
    {
      name: "_rels/.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>"
    },
    { name: "word/document.xml", data: documentXml }
  ]);
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function assertSafe(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|systemPrompt|developerPrompt|queuePayload|workerPayload|toolPayload|toolRuntime|runtimeInternals|stackTrace|apiKey|Bearer|credential|secret/i
  );
}
