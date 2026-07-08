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
const leaveQuestion = "Nhan vien muon nghi phep phai bao truoc bao nhieu ngay?";
const discountQuestion =
  "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?";

async function testRelevantHrDocumentAnswers() {
  const runtime = await createRuntime(["hr"]);
  const response = await runtime.ask(leaveQuestion);

  assert.equal(response.status, "answered");
  assert.match(response.answer, /3 ngay lam viec/i);
  assert.deepEqual(citationTitles(response), ["01_hr_policy.txt"]);
  assert.doesNotMatch(response.answer, /8%|chiet khau/i);
}

async function testIrrelevantHrDocumentFallsBack() {
  const runtime = await createRuntime(["hr"]);
  const beforeComposer = runtime.composerCalls.length;
  const response = await runtime.ask(discountQuestion);

  assertFallback(response);
  assert.equal(runtime.composerCalls.length, beforeComposer);
  assert.doesNotMatch(JSON.stringify(response), /01_hr_policy\.txt|nghi phep|3 ngay/i);
}

async function testManyIrrelevantDocumentsStillFallback() {
  const runtime = await createRuntime(["hr", "product", "finance", "onboarding"]);
  const beforeComposer = runtime.composerCalls.length;
  const response = await runtime.ask(discountQuestion);

  assertFallback(response);
  assert.equal(runtime.composerCalls.length, beforeComposer);
  assert.doesNotMatch(
    JSON.stringify(response),
    /nghi phep|phe duyet|onboarding|990000|2490000|01_hr_policy|03_product_catalog|04_finance|05_onboarding/i
  );
}

async function testRelevantSalesDocumentAnswers() {
  const runtime = await createRuntime(["sales"]);
  const response = await runtime.ask(discountQuestion);

  assert.equal(response.status, "answered");
  assert.match(response.answer, /8%/);
  assert.deepEqual(citationTitles(response), ["02_sales_guide.md"]);
}

async function testMixedDocumentsCiteOnlySales() {
  const runtime = await createRuntime(["hr", "sales", "product"]);
  const response = await runtime.ask(discountQuestion);

  assert.equal(response.status, "answered");
  assert.match(response.answer, /8%/);
  assert.deepEqual(citationTitles(response), ["02_sales_guide.md"]);
  assert.doesNotMatch(response.answer, /nghi phep|990000|2490000|AGENT-ADDON/i);
  assert.deepEqual(
    runtime.composerCalls.at(-1).evidence.map((item) => item.documentTitle),
    ["02_sales_guide.md"]
  );
}

async function createRuntime(assignedKeys) {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const grantRepository = new InMemoryKnowledgeAccessGrantRepository();
  const accessPolicy = new KnowledgeBaseRagAccessPolicy(grantRepository);

  for (const key of Object.keys(DOCUMENTS)) {
    await seedDocument(documentRepository, DOCUMENTS[key]);
  }
  for (const key of assignedKeys) {
    await grantRepository.saveAccessGrant({
      knowledgeAccessGrantId: `grant-${key}`,
      workspaceId,
      documentId: DOCUMENTS[key].documentId,
      agentId,
      status: "active",
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z"
    });
  }

  const vectorRecords = Object.keys(DOCUMENTS).map((key, index) => ({
    workspaceId,
    documentId: DOCUMENTS[key].documentId,
    chunkId: DOCUMENTS[key].chunkId,
    chunkIndex: 0,
    score: 0.99 - index * 0.01,
    metadata: { sourceLocator: "text:0" }
  }));
  const retrievalSearchUseCase = new KnowledgeRetrievalSearchUseCase({
    documentRepository,
    accessPolicy,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding(input) {
        return { workspaceId: input.workspaceId, embedding: [1, 0, 0] };
      }
    },
    vectorQueryAdapter: {
      async query(input) {
        return vectorRecords
          .filter((record) => record.workspaceId === input.workspaceId)
          .filter(
            (record) =>
              !input.documentIds || input.documentIds.includes(record.documentId)
          )
          .slice(0, input.topK);
      }
    }
  });
  const retrievalTool = new AgentKnowledgeRetrievalTool({
    retrievalSearchUseCase,
    agentLookup: {
      async existsInWorkspace(targetWorkspaceId, targetAgentId) {
        return targetWorkspaceId === workspaceId && targetAgentId === agentId;
      }
    }
  });
  const composerCalls = [];
  const orchestration = new AgentKnowledgeOrchestrationUseCase({
    knowledgeRetrievalTool: retrievalTool,
    responseComposer: {
      async compose(input) {
        composerCalls.push(input);
        return input.evidence.map((item) => item.snippet.split(".").at(-2)?.trim() ?? item.snippet).join(" ");
      }
    }
  });

  return {
    composerCalls,
    ask(message) {
      return orchestration.ask(workspaceId, agentId, { message, topK: 5 });
    }
  };
}

async function seedDocument(repository, document) {
  await repository.saveDocument({
    documentId: document.documentId,
    workspaceId,
    uploadedByUserId: "user-a",
    displayName: document.title,
    fileName: document.title,
    mimeType: document.mimeType,
    fileType: document.fileType,
    sizeBytes: document.text.length,
    sourceType: "upload",
    storageKey: `/private/${workspaceId}/${document.documentId}`,
    status: "ready",
    ingestionStatus: "ready",
    indexingStatus: "ready",
    chunkCount: 1,
    indexedChunkCount: 1,
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z"
  });
  await repository.saveDocumentChunk({
    chunkId: document.chunkId,
    workspaceId,
    documentId: document.documentId,
    chunkIndex: 0,
    contentText: document.text,
    embeddingStatus: "ready",
    vectorRef: `vector-${document.chunkId}`,
    sourceLocator: "text:0",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z"
  });
}

function citationTitles(response) {
  return response.citations.map((citation) => citation.documentTitle);
}

function assertFallback(response) {
  assert.deepEqual(response, {
    status: "insufficient_evidence",
    answer: AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
    citations: [],
    warnings: ["insufficient_evidence"]
  });
}

const DOCUMENTS = {
  hr: {
    documentId: "document-hr",
    chunkId: "chunk-hr",
    title: "01_hr_policy.txt",
    mimeType: "text/plain",
    fileType: "txt",
    text:
      "Chinh sach nhan su noi bo - Workspace Demo. Nhan vien duoc nghi phep nam toi da 12 ngay lam viec moi nam. Neu muon nghi phep, nhan vien phai gui yeu cau truoc it nhat 3 ngay lam viec."
  },
  sales: {
    documentId: "document-sales",
    chunkId: "chunk-sales",
    title: "02_sales_guide.md",
    mimeType: "text/markdown",
    fileType: "md",
    text:
      "Sales Guide - Workspace Demo. Khach hang doanh nghiep duoc ap dung muc chiet khau tieu chuan la 8%."
  },
  product: {
    documentId: "document-product",
    chunkId: "chunk-product",
    title: "03_product_catalog.csv",
    mimeType: "text/csv",
    fileType: "csv",
    text:
      "product_code,product_name,category,monthly_price_vnd,warranty_months,note VCP-STD,Virtual Company Standard,Subscription,990000,0,Goi tieu chuan cho nhom nho VCP-PRO,Virtual Company Pro,Subscription,2490000,0,Goi nang cao cho team can nhieu agent AGENT-ADDON,Additional Agent Add-on,Add-on,300000,0,Them mot agent hoat dong trong workspace"
  },
  finance: {
    documentId: "document-finance",
    chunkId: "chunk-finance",
    title: "04_finance_approval_policy.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileType: "docx",
    text:
      "Finance Approval Policy - Workspace Demo. Tai lieu nay mo ta quy tac phe duyet chi phi noi bo. Cac khoan chi tren 500 USD can phe duyet boi Finance Manager."
  },
  onboarding: {
    documentId: "document-onboarding",
    chunkId: "chunk-onboarding",
    title: "05_onboarding_manual.pdf",
    mimeType: "application/pdf",
    fileType: "pdf",
    text:
      "Onboarding Manual - Workspace Demo. Nhan vien moi can hoan tat quy trinh onboarding trong vong 7 ngay dau tien."
  }
};

await testRelevantHrDocumentAnswers();
await testIrrelevantHrDocumentFallsBack();
await testManyIrrelevantDocumentsStillFallback();
await testRelevantSalesDocumentAnswers();
await testMixedDocumentsCiteOnlySales();

console.log("KB/RAG agent answer relevance checks passed");
