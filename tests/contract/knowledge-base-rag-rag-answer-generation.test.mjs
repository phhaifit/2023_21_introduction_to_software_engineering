import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";

import { createKnowledgeBaseRagRouter } from "@vcp/backend/modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import {
  MAX_RAG_MAX_ANSWER_LENGTH,
  KnowledgeRagAnswerUseCase
} from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-rag-answer-use-case.ts";
import { KnowledgeBaseRagValidationError } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-base-rag-errors.ts";
import {
  KnowledgeRagProviderError,
  OpenAICompatibleKnowledgeRagAnswerProvider,
  readKnowledgeRagConfig
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/openai-compatible-knowledge-rag-answer-provider.ts";

const evidence = createEvidence();
let retrievalResults = [evidence];
const retrievalCalls = [];
const providerCalls = [];
const useCase = new KnowledgeRagAnswerUseCase({
  retrievalSearchUseCase: {
    async search(workspaceId, request) {
      retrievalCalls.push({ workspaceId, request });
      return { results: retrievalResults, total: retrievalResults.length };
    }
  },
  answerProvider: {
    async generateAnswer(input) {
      providerCalls.push(input);
      return {
        answer: "Escalations must be sent to the support lead. [E1]",
        citationIds: ["E1", "E999"]
      };
    }
  },
  generateAnswerId: () => "answer-1"
});

await testGroundedAnswer();
await testInsufficientEvidence();
await testProviderFallbacks();
await testValidation();
await testOpenAiCompatibleProvider();
await testHttpRoute();

console.log("knowledge-base-rag RAG answer generation checks passed");

async function testGroundedAnswer() {
  retrievalResults = [evidence];
  const response = await useCase.answer("workspace-a", {
    query: "  Who handles escalations?  ",
    topK: 3,
    filters: { documentIds: ["document-a"], statuses: ["ready"] },
    answerOptions: { maxAnswerLength: 600, includeCitations: true }
  });

  assert.equal(response.status, "answered");
  assert.equal(response.answerId, "answer-1");
  assert.equal(response.citations.length, 1);
  assert.equal(response.citations[0].citationId, "E1");
  assert.equal(response.citations[0].evidenceId, evidence.evidenceId);
  assert.deepEqual(response.evidence, [evidence]);
  assert.deepEqual(retrievalCalls.at(-1), {
    workspaceId: "workspace-a",
    request: {
      query: "Who handles escalations?",
      topK: 3,
      filters: { documentIds: ["document-a"], statuses: ["ready"] }
    }
  });
  assert.equal(providerCalls.at(-1).evidence[0].citationId, "E1");
  assertSafePublicValue(response);

  const noProviderCitation = new KnowledgeRagAnswerUseCase({
    retrievalSearchUseCase: {
      async search() {
        return { results: [evidence], total: 1 };
      }
    },
    answerProvider: {
      async generateAnswer() {
        return { answer: "Grounded answer.", citationIds: [] };
      }
    },
    generateAnswerId: () => "answer-2"
  });
  const cautious = await noProviderCitation.answer("workspace-a", {
    query: "Who handles escalations?"
  });
  assert.equal(cautious.status, "answered_with_caution");
  assert.equal(cautious.citations[0].citationId, "E1");
}

async function testInsufficientEvidence() {
  const callsBefore = providerCalls.length;
  retrievalResults = [];
  const empty = await useCase.answer("workspace-a", { query: "unknown" });
  assert.equal(empty.status, "insufficient_evidence");
  assert.deepEqual(empty.citations, []);
  assert.deepEqual(empty.evidence, []);
  assert.equal(providerCalls.length, callsBefore);

  retrievalResults = [{ ...evidence, score: 0.49 }];
  const weak = await useCase.answer("workspace-a", { query: "weak" });
  assert.equal(weak.status, "insufficient_evidence");
  assert.equal(providerCalls.length, callsBefore);
}

async function testProviderFallbacks() {
  retrievalResults = [evidence];
  for (const answerProvider of [
    {
      async generateAnswer() {
        throw new Error("rawProvider secret-token rawPrompt");
      }
    },
    {
      async generateAnswer() {
        return { answer: "", citationIds: ["E1"] };
      }
    },
    {
      async generateAnswer() {
        return { answer: "Grounded answer.", citationIds: null };
      }
    }
  ]) {
    const failing = new KnowledgeRagAnswerUseCase({
      retrievalSearchUseCase: {
        async search() {
          return { results: [evidence], total: 1 };
        }
      },
      answerProvider,
      generateAnswerId: () => "answer-fallback"
    });
    const response = await failing.answer("workspace-a", {
      query: "Who handles escalations?"
    });
    assert.equal(response.status, "provider_error");
    assertSafePublicValue(response);
  }

  const retrievalFailure = new KnowledgeRagAnswerUseCase({
    retrievalSearchUseCase: {
      async search() {
        throw new Error("pgvector rawVector storageKey");
      }
    },
    answerProvider: {
      async generateAnswer() {
        throw new Error("must not run");
      }
    },
    generateAnswerId: () => "answer-failure"
  });
  await assert.rejects(
    () => retrievalFailure.answer("workspace-a", { query: "policy" }),
    (error) => {
      assert.equal(error.errorCode, "knowledge.rag_retrieval_failed");
      assertSafePublicValue(error);
      return true;
    }
  );
}

async function testValidation() {
  for (const request of [
    { query: "" },
    { query: "x".repeat(2_001) },
    { query: "valid", topK: 0 },
    { query: "valid", topK: 21 },
    {
      query: "valid",
      answerOptions: { maxAnswerLength: MAX_RAG_MAX_ANSWER_LENGTH + 1 }
    },
    { query: "valid", answerOptions: { maxAnswerLength: 99 } },
    { query: "valid", answerOptions: { includeCitations: "yes" } }
  ]) {
    await assert.rejects(
      () => useCase.answer("workspace-a", request),
      KnowledgeBaseRagValidationError
    );
  }
}

async function testOpenAiCompatibleProvider() {
  assert.throws(
    () =>
      readKnowledgeRagConfig({
        KNOWLEDGE_RAG_PROVIDER: "openai-compatible",
        KNOWLEDGE_RAG_BASE_URL: "https://provider.example/v1",
        KNOWLEDGE_RAG_MODEL: "safe-model"
      }),
    KnowledgeRagProviderError
  );

  let captured;
  const provider = new OpenAICompatibleKnowledgeRagAnswerProvider(
    {
      provider: "openai-compatible",
      baseUrl: "https://provider.example/v1",
      apiKey: "test-only-key",
      model: "safe-model",
      timeoutMs: 1_000,
      maxOutputTokens: 500
    },
    async (url, init) => {
      captured = { url: String(url), init };
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: "Grounded provider answer. [E1]",
                  citationIds: ["E1"]
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  );
  const result = await provider.generateAnswer({
    query: "Who handles escalations?",
    evidence: [
      {
        citationId: "E1",
        evidenceId: evidence.evidenceId,
        documentTitle: evidence.documentTitle,
        snippet: evidence.snippet,
        rank: evidence.rank,
        source: evidence.source
      }
    ],
    maxAnswerLength: 600
  });
  assert.deepEqual(result.citationIds, ["E1"]);
  assert.equal(captured.url, "https://provider.example/v1/chat/completions");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, "safe-model");
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /only from the supplied workspace evidence/i);
  assert.doesNotMatch(JSON.stringify(result), /test-only-key|rawPrompt|systemPrompt/i);

  const malformed = new OpenAICompatibleKnowledgeRagAnswerProvider(
    {
      provider: "openai-compatible",
      baseUrl: "https://provider.example/v1",
      apiKey: "test-only-key",
      model: "safe-model",
      timeoutMs: 1_000,
      maxOutputTokens: 500
    },
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }))
  );
  await assert.rejects(
    () =>
      malformed.generateAnswer({
        query: "policy",
        evidence: [
          {
            citationId: "E1",
            evidenceId: evidence.evidenceId,
            documentTitle: evidence.documentTitle,
            snippet: evidence.snippet,
            rank: evidence.rank,
            source: evidence.source
          }
        ],
        maxAnswerLength: 600
      }),
    KnowledgeRagProviderError
  );
}

async function testHttpRoute() {
  retrievalResults = [evidence];
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.context = {
      requestId: "rag-request",
      user: { userId: "user-a", email: "user@example.com" },
      workspace: {
        workspaceId: "workspace-a",
        memberId: "member-a",
        role: "viewer"
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
      ragAnswerUseCase: useCase
    })
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const success = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/knowledge/rag/answer",
      {
        query: "Who handles escalations?",
        topK: 3,
        answerOptions: { maxAnswerLength: 600, includeCitations: true }
      }
    );
    assert.equal(success.status, 200);
    assert.equal(success.body.data.status, "answered");
    assertSafePublicValue(success.body.data);

    const invalid = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/knowledge/rag/answer",
      { query: "policy", rawPrompt: "leak" }
    );
    assert.equal(invalid.status, 422);

    const crossWorkspace = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-b/knowledge/rag/answer",
      { query: "policy" }
    );
    assert.equal(crossWorkspace.status, 403);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function createEvidence() {
  return {
    evidenceId: "evidence:document-a:chunk-a",
    rank: 1,
    score: 0.92,
    documentId: "document-a",
    chunkId: "chunk-a",
    documentTitle: "Escalation Policy.txt",
    snippet: "Escalations must be sent to the support lead.",
    source: { type: "upload", locator: "text:0" },
    metadata: { chunkIndex: 0 }
  };
}

function assertSafePublicValue(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /rawPrompt|systemPrompt|developerPrompt|chainOfThought|providerPayload|rawProvider|rawEmbedding|rawVector|vectorRef|storageKey|privateUrl|filePath|queuePayload|secret-token|test-only-key|stackTrace/i
  );
}

async function requestJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
