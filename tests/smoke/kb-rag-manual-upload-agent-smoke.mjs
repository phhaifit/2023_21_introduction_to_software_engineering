import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AgentLifecycleUseCases } from "@vcp/backend/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, "..", "fixtures", "kb-rag-e2e");
const workspaceId = "workspace-kb-rag-smoke";
const actorId = "user-kb-rag-smoke";
const storageRoot = await mkdtemp(join(tmpdir(), "kb-rag-manual-agent-smoke-"));
const HR_QUESTION = "Nhan vien muon nghi phep phai bao truoc bao nhieu ngay?";
const SALES_QUESTION =
  "Muc chiet khau tieu chuan cho khach hang doanh nghiep la bao nhieu?";

try {
  await runSmoke();
  console.log("KB/RAG manual upload agent smoke checks passed");
} finally {
  await rm(storageRoot, { recursive: true, force: true });
}

async function runSmoke() {
  const runtime = createRuntime();
  const uploads = await uploadAndIndexFixtures(runtime);
  const agent = await createResearchAgent(runtime);
  const agentId = agent.agent.agentId;

  await assignOnly(runtime, agentId, [uploads.hr.documentId]);
  const hrAnswer = await runtime.ask(agentId, HR_QUESTION);
  assert.equal(hrAnswer.status, "answered");
  assert.match(hrAnswer.answer, /3 ngay lam viec/i);
  assert.deepEqual(citationTitles(hrAnswer), ["01_hr_policy.txt"]);
  assert.doesNotMatch(hrAnswer.answer, /8%|chiet khau/i);

  const hrOnlySales = await runtime.ask(agentId, SALES_QUESTION);
  assertFallback(hrOnlySales);
  assert.doesNotMatch(JSON.stringify(hrOnlySales), /8%|01_hr_policy\.txt|nghi phep/i);

  await assignOnly(runtime, agentId, [uploads.sales.documentId]);
  const salesAnswer = await runtime.ask(agentId, SALES_QUESTION);
  assert.equal(salesAnswer.status, "answered");
  assert.match(salesAnswer.answer, /8%/);
  assert.deepEqual(citationTitles(salesAnswer), ["02_sales_guide.md"]);

  await assignOnly(runtime, agentId, [
    uploads.hr.documentId,
    uploads.product.documentId
  ]);
  const irrelevantOnly = await runtime.ask(agentId, SALES_QUESTION);
  assertFallback(irrelevantOnly);
  assert.doesNotMatch(
    JSON.stringify(irrelevantOnly),
    /8%|990000|2490000|nghi phep|01_hr_policy\.txt|03_product_catalog\.csv/i
  );

  await assignOnly(runtime, agentId, [
    uploads.hr.documentId,
    uploads.sales.documentId,
    uploads.product.documentId
  ]);
  const mixed = await runtime.ask(agentId, SALES_QUESTION);
  assert.equal(mixed.status, "answered");
  assert.match(mixed.answer, /8%/);
  assert.deepEqual(citationTitles(mixed), ["02_sales_guide.md"]);
  assert.doesNotMatch(mixed.answer, /nghi phep|990000|2490000|AGENT-ADDON/i);

  assertSafe({
    uploads,
    hrAnswer,
    hrOnlySales,
    salesAnswer,
    irrelevantOnly,
    mixed
  });
}

async function uploadAndIndexFixtures(runtime) {
  const fixtureFiles = [
    {
      key: "hr",
      clientFileId: "fixture-hr",
      fileName: "01_hr_policy.txt",
      mediaType: "text/plain"
    },
    {
      key: "sales",
      clientFileId: "fixture-sales",
      fileName: "02_sales_guide.md",
      mediaType: "text/markdown"
    },
    {
      key: "product",
      clientFileId: "fixture-product",
      fileName: "03_product_catalog.csv",
      mediaType: "text/csv"
    }
  ];
  const files = await Promise.all(
    fixtureFiles.map(async (file) => ({
      ...file,
      content: await readFile(join(fixtureRoot, file.fileName))
    }))
  );

  const validation = await runtime.uploadUseCases.validateUploadCandidates(
    workspaceId,
    {
      files: files.map((file) => ({
        clientFileId: file.clientFileId,
        fileName: file.fileName,
        mediaType: file.mediaType,
        sizeBytes: file.content.byteLength
      }))
    }
  );
  assert.equal(validation.acceptedCount, files.length);
  assert.equal(validation.rejectedCount, 0);
  assert.ok(validation.results.every((result) => result.status === "accepted"));

  const uploaded = await runtime.uploadUseCases.uploadDocuments(
    workspaceId,
    actorId,
    files
  );
  assert.equal(uploaded.documents.length, files.length);
  assert.equal(uploaded.ingestionJobs.length, files.length);

  const byName = new Map();
  for (const document of uploaded.documents) {
    assert.equal(document.status, "ready");
    assert.ok(document.chunkCount >= 1);
    assert.ok(document.indexedChunkCount >= 1);
    const persisted = await runtime.documentRepository.getDocumentById(
      workspaceId,
      document.documentId
    );
    assert.equal(persisted.ingestionStatus, "ready");
    assert.equal(persisted.indexingStatus, "ready");
    const chunks = await runtime.documentRepository.listDocumentChunks(
      workspaceId,
      document.documentId
    );
    assert.ok(chunks.total >= 1);
    assert.ok(chunks.items.every((chunk) => chunk.embeddingStatus === "ready"));
    byName.set(document.name, document);
  }

  return {
    hr: byName.get("01_hr_policy.txt"),
    sales: byName.get("02_sales_guide.md"),
    product: byName.get("03_product_catalog.csv")
  };
}

async function createResearchAgent(runtime) {
  const result = await runtime.agentUseCases.createAgent({
    workspaceId,
    name: "Research Agent",
    role: "Research assistant",
    model: "gemini-2.5-flash",
    instructions:
      "Answer only from assigned knowledge. If evidence is insufficient, say so."
  });
  assert.equal(result.agent.name, "Research Agent");
  assert.equal(result.agent.status, "enabled");
  assert.match(result.skillConfiguration, /Answer only from assigned knowledge/i);
  return result;
}

async function assignOnly(runtime, agentId, documentIds) {
  for (const current of await runtime.accessPolicy.listAgentDocumentIds(
    workspaceId,
    agentId
  )) {
    if (!documentIds.includes(current)) {
      await runtime.assignmentUseCase.revokeDocument(
        workspaceId,
        agentId,
        current,
        "admin"
      );
    }
  }
  for (const documentId of documentIds) {
    const assignment = await runtime.assignmentUseCase.assignDocument(
      workspaceId,
      agentId,
      documentId,
      "admin"
    );
    assert.equal(assignment.grantStatus, "active");
    assert.equal(assignment.document.documentId, documentId);
  }
  assert.deepEqual(
    await runtime.accessPolicy.listAgentDocumentIds(workspaceId, agentId),
    documentIds
  );
}

function createRuntime() {
  const documentRepository = new InMemoryKnowledgeDocumentRepository();
  const ingestionJobRepository = new InMemoryKnowledgeIngestionJobRepository();
  const accessGrantRepository = new InMemoryKnowledgeAccessGrantRepository();
  const accessPolicy = new KnowledgeBaseRagAccessPolicy(accessGrantRepository);
  const fileStorage = new LocalKnowledgeFileStorage(storageRoot);
  const agentRepository = new InMemoryAgentRepository();
  const vectorRecords = [];
  let sequence = 0;
  let documentSequence = 0;
  let jobSequence = 0;
  let grantSequence = 0;
  let agentSequence = 0;
  const now = () =>
    new Date(Date.UTC(2026, 6, 8, 0, 0, sequence++)).toISOString();

  const runner = createKnowledgeBaseRagLocalFlowRunner({
    documentRepository,
    ingestionJobRepository,
    contentReader: new StoredKnowledgeDocumentContentReader(
      fileStorage,
      new RuntimeKnowledgeDocumentTextExtractor()
    ),
    embeddingAdapter: {
      async generateEmbedding(input) {
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
        vectorRecords.push(input);
        return {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef: `internal-vector-${input.documentId}-${input.chunkIndex}`
        };
      }
    },
    now,
    generateChunkId: ({ documentId, chunkIndex }) =>
      `${documentId}:chunk:${chunkIndex}`,
    generateEventId: () => `event-${++sequence}`
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

  const agentLookup = {
    async existsInWorkspace(targetWorkspaceId, agentId) {
      const agent = await agentRepository.findById(targetWorkspaceId, agentId);
      return Boolean(agent && agent.status === "enabled");
    }
  };
  const retrievalTool = new AgentKnowledgeRetrievalTool({
    retrievalSearchUseCase,
    agentLookup
  });
  const orchestration = new AgentKnowledgeOrchestrationUseCase({
    knowledgeRetrievalTool: retrievalTool
  });
  const agentUseCases = new AgentLifecycleUseCases({
    repository: agentRepository,
    now,
    generateAgentId: () => `agent-${++agentSequence}`
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
    agentUseCases,
    assignmentUseCase,
    documentRepository,
    uploadUseCases,
    ask(agentId, message) {
      return orchestration.ask(workspaceId, agentId, { message, topK: 5 });
    }
  };
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

function assertSafe(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|privateUrl|filePath|absolutePath|localPath|rawEmbedding|rawVector|vectorRef|providerPayload|rawPrompt|systemPrompt|developerPrompt|queuePayload|workerPayload|toolPayload|toolRuntime|runtimeInternals|stackTrace|apiKey|Bearer|credential|secret/i
  );
}
